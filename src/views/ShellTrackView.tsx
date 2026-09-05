import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Detail,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { type ReactNode, useEffect, useState } from "react";
import {
  type ShellConfig,
  type ShellSnippet,
  addShellSnippet,
  removeShellSnippet,
  toggleShellSnippet,
  updateShellSnippet,
} from "@env-butler/core";
import { t } from "../i18n.js";
import type { ValidatableShell } from "../services/shellValidator.js";
import {
  appendShellSourceLine,
  detectShellRc,
  getShellScriptPath,
  loadShellConfig,
  removeShellSourceLine,
  saveShellConfig,
  type ShellRcInfo,
} from "../services/storage.js";
import { EditShellSnippetForm } from "./EditShellSnippetForm.js";

interface ShellTrackViewProps {
  /** 轨道切换下拉框,由 manage-envs.tsx 传入,挂在这里唯一的 <List> 上(不要在外层再包一层 List) */
  searchBarAccessory?: ReactNode;
}

export function ShellTrackView({ searchBarAccessory }: ShellTrackViewProps) {
  const [config, setConfig] = useState<ShellConfig>({ version: 1, snippets: [] });
  const [loading, setLoading] = useState(true);
  const [rcInfo, setRcInfo] = useState<ShellRcInfo | null>(null);

  const refreshConfig = async () => {
    setLoading(true);
    try {
      const [c, rc] = await Promise.all([loadShellConfig(), detectShellRc()]);
      setConfig(c);
      setRcInfo(rc);
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: t("st.loadFailedTitle"),
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshConfig();
  }, []);

  // 启用 Shell 集成:把 source 那一行写入用户的 shell 配置文件(先弹确认框讲清楚会发生什么,确认后才写)
  const handleEnableIntegration = async (rc: ShellRcInfo, sourceLine: string) => {
    const confirmed = await confirmAlert({
      title: t("st.enableConfirmTitle"),
      message: t("st.enableConfirmMessage", { file: rc.rcLabel, sourceLine }),
      primaryAction: {
        title: t("st.enableConfirmAction"),
      },
      dismissAction: {
        title: t("common.cancel"),
      },
    });
    if (!confirmed) return;

    try {
      await appendShellSourceLine(rc.rcPath, sourceLine);
      await showToast({ style: Toast.Style.Success, title: t("st.enabledIntegrationToast") });
      await refreshConfig();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: t("st.enableFailedTitle"),
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  // 禁用 Shell 集成:与启用对称,从配置文件里干净移除那一行(先确认,防止手误)
  const handleDisableIntegration = async (rc: ShellRcInfo, sourceLine: string) => {
    const confirmed = await confirmAlert({
      title: t("st.disableConfirmTitle"),
      message: t("st.disableConfirmMessage", { file: rc.rcLabel, sourceLine }),
      primaryAction: {
        title: t("st.disableConfirmAction"),
        style: Alert.ActionStyle.Destructive,
      },
      dismissAction: {
        title: t("common.cancel"),
      },
    });
    if (!confirmed) return;

    try {
      await removeShellSourceLine(rc.rcPath);
      await showToast({ style: Toast.Style.Success, title: t("st.disabledIntegrationToast", { file: rc.rcLabel }) });
      await refreshConfig();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: t("st.disableFailedTitle"),
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleToggle = async (id: string) => {
    const updated = toggleShellSnippet(config, id);
    await saveShellConfig(updated);
    setConfig(updated);
    await showToast({ style: Toast.Style.Success, title: t("st.toggledToast") });
  };

  const handleAdd = async (data: Omit<ShellSnippet, "id">) => {
    const { config: updated } = addShellSnippet(config, data);
    await saveShellConfig(updated);
    setConfig(updated);
    await showToast({ style: Toast.Style.Success, title: t("st.addedToast") });
  };

  const handleEdit = async (id: string, data: Omit<ShellSnippet, "id">) => {
    const updated = updateShellSnippet(config, id, data);
    await saveShellConfig(updated);
    setConfig(updated);
    await showToast({ style: Toast.Style.Success, title: t("st.updatedToast") });
  };

  const handleDelete = async (item: ShellSnippet) => {
    const confirmed = await confirmAlert({
      title: t("st.deleteConfirmTitle", { name: item.name }),
      message: t("st.deleteConfirmMessage"),
      primaryAction: {
        title: t("common.delete"),
        style: Alert.ActionStyle.Destructive,
      },
      dismissAction: {
        title: t("common.cancel"),
      },
    });
    if (!confirmed) return;

    const updated = removeShellSnippet(config, item.id);
    await saveShellConfig(updated);
    setConfig(updated);
    await showToast({ style: Toast.Style.Success, title: t("st.deletedToast") });
  };

  const shellPath = getShellScriptPath();
  const sourceLine = `source ${shellPath}`;
  // 只在明确探测到 zsh/bash 时才做语法校验;识别不出来(如 fish)就传 undefined,EditShellSnippetForm 会自动跳过校验
  const shellKind: ValidatableShell | undefined =
    rcInfo && rcInfo.shellName !== "unknown" ? rcInfo.shellName : undefined;
  const exports = config.snippets.filter((s) => s.type === "export");
  const aliases = config.snippets.filter((s) => s.type === "alias");
  const others = config.snippets.filter((s) => s.type === "snippet");

  // 首次引导条:探测到已经 source 过就显示"已就绪",没探测到 shell 类型(如 fish)就给保守的手动提示
  const bootstrapTitle = !rcInfo
    ? ""
    : rcInfo.isSourced
      ? t("st.bootstrapReadyTitle")
      : rcInfo.shellName === "unknown"
        ? t("st.bootstrapUnknownTitle")
        : t("st.bootstrapPendingTitle", { file: rcInfo.rcLabel });
  const bootstrapSubtitle = rcInfo?.isSourced ? t("st.bootstrapReadySubtitle", { file: rcInfo.rcLabel }) : sourceLine;

  // 有片段时才开详情预览面板(没有片段就没什么可预览的,保持紧凑列表更合适)
  const isShowingDetail = config.snippets.length > 0;

  return (
    <List
      isLoading={loading}
      isShowingDetail={isShowingDetail}
      searchBarPlaceholder={t("st.searchPlaceholder")}
      searchBarAccessory={searchBarAccessory}
    >
      {rcInfo && (
        <List.Section title={t("st.bootstrapSection")}>
          <List.Item
            id="bootstrap"
            icon={{
              source: rcInfo.isSourced ? Icon.CheckCircle : Icon.Terminal,
              tintColor: rcInfo.isSourced ? Color.Green : Color.Blue,
            }}
            title={bootstrapTitle}
            subtitle={isShowingDetail ? undefined : bootstrapSubtitle}
            detail={
              isShowingDetail ? (
                <List.Item.Detail
                  markdown={t("st.bootstrapDetailMarkdown", {
                    sourceLine,
                    file: rcInfo.rcLabel,
                    rcPath: rcInfo.rcLabel,
                  })}
                />
              ) : undefined
            }
            actions={
              <ActionPanel>
                {!rcInfo.isSourced && rcInfo.shellName !== "unknown" && (
                  <Action
                    title={t("st.actionEnableIntegration", { file: rcInfo.rcLabel })}
                    icon={Icon.Bolt}
                    onAction={() => handleEnableIntegration(rcInfo, sourceLine)}
                  />
                )}
                {rcInfo.isSourced && (
                  <Action
                    title={t("st.actionDisableIntegration", { file: rcInfo.rcLabel })}
                    icon={Icon.XMarkCircle}
                    style={Action.Style.Destructive}
                    onAction={() => handleDisableIntegration(rcInfo, sourceLine)}
                  />
                )}
                <Action.CopyToClipboard title={t("st.copySourceCommand")} content={sourceLine} />
                {!isShowingDetail && (
                  <Action.Push
                    title={t("st.bootstrapLearnMore")}
                    icon={Icon.Info}
                    target={
                      <Detail
                        markdown={t("st.bootstrapDetailMarkdown", {
                          sourceLine,
                          file: rcInfo.rcLabel,
                          rcPath: rcInfo.rcLabel,
                        })}
                        navigationTitle={t("st.bootstrapSection")}
                      />
                    }
                  />
                )}
                <Action.Push
                  title={t("st.actionNewSnippet")}
                  icon={Icon.Plus}
                  shortcut={Keyboard.Shortcut.Common.New}
                  target={<EditShellSnippetForm shellKind={shellKind} onSave={handleAdd} />}
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}

      {exports.length > 0 && (
        <List.Section title={t("st.sectionExports")} subtitle={t("pd.countItems", { count: exports.length })}>
          {exports.map((item) => (
            <SnippetListItem
              key={item.id}
              item={item}
              shellKind={shellKind}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
          ))}
        </List.Section>
      )}

      {aliases.length > 0 && (
        <List.Section title={t("st.sectionAliases")} subtitle={t("pd.countItems", { count: aliases.length })}>
          {aliases.map((item) => (
            <SnippetListItem
              key={item.id}
              item={item}
              shellKind={shellKind}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
          ))}
        </List.Section>
      )}

      {others.length > 0 && (
        <List.Section title={t("st.sectionOthers")} subtitle={t("pd.countItems", { count: others.length })}>
          {others.map((item) => (
            <SnippetListItem
              key={item.id}
              item={item}
              shellKind={shellKind}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
          ))}
        </List.Section>
      )}

      {config.snippets.length === 0 && !loading && (
        <List.EmptyView
          title={t("st.emptyTitle")}
          description={t("st.emptyDesc")}
          actions={
            <ActionPanel>
              <Action.Push
                title={t("st.actionNewSnippet")}
                icon={Icon.Plus}
                target={<EditShellSnippetForm shellKind={shellKind} onSave={handleAdd} />}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}

// 片段类型对应的展示文案(复用编辑表单下拉框已有的翻译,避免再造一套)
function snippetTypeLabel(type: ShellSnippet["type"]): string {
  if (type === "export") return t("es.typeExport");
  if (type === "alias") return t("es.typeAlias");
  return t("es.typeSnippet");
}

// 详情面板内容:元信息(类型/状态/备注) + 完整代码,不用再进编辑表单才能看全
function buildSnippetDetailMarkdown(item: ShellSnippet): string {
  const statusLabel = item.enabled ? t("st.enabledTag") : t("st.disabledTag");
  const descriptionLabel = item.description || t("st.detailNone");

  return `${t("st.detailHeading")}
- **${t("st.detailType")}**: ${snippetTypeLabel(item.type)}
- **${t("st.detailStatus")}**: ${statusLabel}
- **${t("st.detailDescription")}**: ${descriptionLabel}

---

\`\`\`bash
${item.content}
\`\`\``;
}

function SnippetListItem({
  item,
  shellKind,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
}: {
  item: ShellSnippet;
  shellKind: ValidatableShell | undefined;
  onToggle: (id: string) => void;
  onEdit: (id: string, data: Omit<ShellSnippet, "id">) => Promise<void>;
  onDelete: (item: ShellSnippet) => void;
  onAdd: (data: Omit<ShellSnippet, "id">) => Promise<void>;
}) {
  return (
    <List.Item
      id={item.id}
      title={item.name}
      detail={<List.Item.Detail markdown={buildSnippetDetailMarkdown(item)} />}
      actions={
        <ActionPanel>
          <Action
            title={item.enabled ? t("st.actionDisable") : t("st.actionEnable")}
            icon={item.enabled ? Icon.Pause : Icon.Play}
            onAction={() => onToggle(item.id)}
          />
          <Action.Push
            title={t("st.actionEdit")}
            icon={Icon.Pencil}
            shortcut={Keyboard.Shortcut.Common.Edit}
            target={
              <EditShellSnippetForm initialData={item} shellKind={shellKind} onSave={(data) => onEdit(item.id, data)} />
            }
          />
          <Action.Push
            title={t("st.actionNew")}
            icon={Icon.Plus}
            shortcut={Keyboard.Shortcut.Common.New}
            target={<EditShellSnippetForm shellKind={shellKind} onSave={onAdd} />}
          />
          <Action.CopyToClipboard title={t("st.actionCopyContent")} content={item.content} />
          <Action
            title={t("st.actionDelete")}
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["cmd"], key: "backspace" }}
            onAction={() => onDelete(item)}
          />
        </ActionPanel>
      }
    />
  );
}
