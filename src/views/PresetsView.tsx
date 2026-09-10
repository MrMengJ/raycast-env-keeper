import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  createEmptyPresetsFile,
  groupPresets,
  listPresetGroups,
  addPreset,
  listPresetsForProject,
  parseEnv,
  type Preset,
  type PresetsFile,
  removePreset,
  updatePreset,
} from "@env-butler/core";
import { t } from "../i18n.js";
import { type ConfigLoadProblem, loadPresets, savePresets } from "../services/storage.js";
import { ConfigProblemItem } from "./ConfigProblemItem.js";
import { PresetContentForm } from "./PresetContentForm.js";
import { PresetDiffView } from "./PresetDiffView.js";
import { PresetMetaForm } from "./PresetMetaForm.js";
import { PresetsHistoryView } from "./PresetsHistoryView.js";

interface PresetsViewProps {
  projectId: string;
  projectName: string;
  /** 当前正在看的环境文件,"套用到 X""跟 X 比较"里的 X */
  envFilename: string;
  currentContent: string;
  customSecrets?: string[];
  /** 真正写文件的动作交给父页面(写入、记录套用状态);确认这一步由差异页承担,这里负责把人带过去 */
  onApply: (preset: Preset) => Promise<void>;
  /** 这里改了方案(改名/改内容/删除)之后通知父页面重读 */
  onChanged: () => void;
}

/**
 * 管理方案。按分组分段(组名字母序,未分组固定最后),每项可改名/改内容/看差异/删除。
 * 自己读 presets.json 而不是从父页面拿:这一页会反复改动方案,拿快照进来一改就旧了
 */
export function PresetsView({
  projectId,
  projectName,
  envFilename,
  currentContent,
  customSecrets,
  onApply,
  onChanged,
}: PresetsViewProps) {
  const { push, pop } = useNavigation();
  const [file, setFile] = useState<PresetsFile>(createEmptyPresetsFile());
  const [problem, setProblem] = useState<ConfigLoadProblem | undefined>();
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const result = await loadPresets();
    setFile(result.data);
    setProblem(result.problem);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const persist = async (next: PresetsFile) => {
    await savePresets(next);
    setFile(next);
    onChanged();
  };

  const presets = listPresetsForProject(file, projectId);
  const groups = listPresetGroups(file, projectId);
  const activeIds = new Set(presets.filter((p) => p.content === currentContent).map((p) => p.id));
  const varCount = (p: Preset) => parseEnv(p.content).filter((l) => l.type === "kv").length;

  const handleDelete = async (preset: Preset) => {
    const confirmed = await confirmAlert({
      title: t("ps.deleteConfirmTitle", { name: preset.name }),
      message: t("ps.deleteConfirmMessage"),
      primaryAction: { title: t("common.delete"), style: Alert.ActionStyle.Destructive },
      dismissAction: { title: t("common.cancel") },
    });
    if (!confirmed) return;
    await persist(removePreset(file, preset.id));
    await showToast({ style: Toast.Style.Success, title: t("ps.deletedToast", { name: preset.name }) });
  };

  return (
    <List
      isLoading={loading}
      navigationTitle={t("ps.navTitle", { project: projectName })}
      searchBarPlaceholder={t("ps.searchPlaceholder")}
    >
      {problem && (
        <List.Section title={t("cfg.sectionTitle")}>
          <ConfigProblemItem problem={problem} />
        </List.Section>
      )}

      {groupPresets(presets).map((bucket) => (
        <List.Section
          key={bucket.group ?? "__ungrouped__"}
          title={bucket.group ?? t("ps.ungroupedSection")}
          subtitle={String(bucket.presets.length)}
        >
          {bucket.presets.map((preset) => (
            <List.Item
              key={preset.id}
              id={preset.id}
              icon={Icon.Box}
              title={preset.name}
              subtitle={preset.note}
              accessories={[
                ...(activeIds.has(preset.id)
                  ? [{ tag: { value: t("ps.liveAccessory", { file: envFilename }), color: Color.Green } }]
                  : []),
                { text: t("ps.varCount", { count: varCount(preset) }) },
              ]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action
                      title={t("ps.actionApply", { file: envFilename })}
                      icon={Icon.Replace}
                      onAction={async () => {
                        // 套用完回到文件页看结果:这一页拿到的"当前内容"是进来时的快照,套完就旧了
                        if (currentContent.trim() === "") {
                          await onApply(preset);
                          pop();
                          return;
                        }
                        push(
                          <PresetDiffView
                            preset={preset}
                            envFilename={envFilename}
                            currentContent={currentContent}
                            customSecrets={customSecrets}
                            mode="apply"
                            onApply={async () => {
                              await onApply(preset);
                              pop();
                            }}
                          />,
                        );
                      }}
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section>
                    <Action.Push
                      title={t("ps.actionEditContent")}
                      icon={Icon.Pencil}
                      shortcut={Keyboard.Shortcut.Common.Edit}
                      target={
                        <PresetContentForm
                          preset={preset}
                          onSave={async (content) => {
                            await persist(updatePreset(file, preset.id, { content }));
                            await showToast({
                              style: Toast.Style.Success,
                              title: t("ps.updatedToast", { name: preset.name }),
                            });
                          }}
                        />
                      }
                    />
                    <Action.Push
                      title={t("ps.actionEditMeta")}
                      icon={Icon.Tag}
                      target={
                        <PresetMetaForm
                          initialData={preset}
                          existingGroups={groups}
                          onSave={async (data) => {
                            await persist(updatePreset(file, preset.id, data));
                            await showToast({
                              style: Toast.Style.Success,
                              title: t("ps.updatedToast", { name: data.name }),
                            });
                          }}
                        />
                      }
                    />
                    {/* 复制一份再改名,比从零写省事:同类方案多半只差两三个值。
                        内容沿用原件,不在这一步展示明文——要改值走「编辑内容」 */}
                    <Action.Push
                      title={t("ps.actionDuplicate")}
                      icon={Icon.Duplicate}
                      target={
                        <PresetMetaForm
                          navTitle={t("ps.actionDuplicate")}
                          initialData={{
                            name: t("ps.duplicateName", { name: preset.name }),
                            note: preset.note,
                            group: preset.group,
                          }}
                          existingGroups={groups}
                          contentPreview={{ content: preset.content, sourceFile: preset.name, customSecrets }}
                          onSave={async (data) => {
                            const { file: next, preset: copy } = addPreset(file, {
                              projectId,
                              name: data.name,
                              note: data.note,
                              group: data.group,
                              content: preset.content,
                            });
                            await persist(next);
                            await showToast({
                              style: Toast.Style.Success,
                              title: t("ps.savedToast", { name: copy.name }),
                            });
                          }}
                        />
                      }
                    />
                    {/* 方案内容可能带明文密钥,不进 Raycast 的剪贴板历史 */}
                    <Action.CopyToClipboard title={t("ps.actionCopy")} content={preset.content} concealed />
                    <Action
                      title={t("ps.actionDelete")}
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                      onAction={() => handleDelete(preset)}
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section>
                    <Action.Push
                      title={t("ps.actionFocusHistory")}
                      icon={Icon.Clock}
                      target={
                        <PresetsHistoryView
                          projectId={projectId}
                          projectName={projectName}
                          customSecrets={customSecrets}
                          focusPreset={{ id: preset.id, name: preset.name }}
                          onRestored={() => {
                            refresh();
                            onChanged();
                          }}
                        />
                      }
                    />
                    <Action.Push
                      title={t("ps.actionHistory")}
                      icon={Icon.Clock}
                      target={
                        <PresetsHistoryView
                          projectId={projectId}
                          projectName={projectName}
                          customSecrets={customSecrets}
                          onRestored={() => {
                            refresh();
                            onChanged();
                          }}
                        />
                      }
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}

      {presets.length === 0 && !loading && !problem && (
        <List.EmptyView
          title={t("ps.emptyTitle")}
          description={t("ps.emptyDesc")}
          actions={
            <ActionPanel>
              <Action.Push
                title={t("ps.actionHistory")}
                icon={Icon.Clock}
                target={
                  <PresetsHistoryView
                    projectId={projectId}
                    projectName={projectName}
                    customSecrets={customSecrets}
                    onRestored={() => {
                      refresh();
                      onChanged();
                    }}
                  />
                }
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
