import { Action, ActionPanel, Alert, confirmAlert, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useEffect, useState } from "react";
import {
  diffShellSnippets,
  maskShellContent,
  parseShellConfig,
  type ShellConfig,
  type ShellSnippet,
} from "@env-butler/core";
import { snapshotLimitHint, t } from "../i18n.js";
import {
  type ConfigSnapshotItem,
  deleteConfigSnapshot,
  listConfigSnapshots,
  readConfigSnapshot,
  saveShellConfig,
} from "../services/storage.js";

interface ShellConfigHistoryViewProps {
  /** 当前生效的配置,用来跟历史记录做差异对比 */
  currentConfig: ShellConfig;
  onRestored: () => void;
}

/**
 * Shell 配置的历史记录。
 *
 * 为什么 Shell 轨比项目轨更需要它:.env 至少可能在 git 里留着副本,
 * 而片段只存在 shell.json 这一处——改错、删错、或者配置文件损坏,
 * 在这个页面出现之前是完全没有退路的。
 */
export function ShellConfigHistoryView({ currentConfig, onRestored }: ShellConfigHistoryViewProps) {
  const { pop } = useNavigation();
  const [items, setItems] = useState<ConfigSnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");

  const refresh = async () => {
    setLoading(true);
    const list = await listConfigSnapshots("shell");
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  // 选中项变化时才读文件,避免一次性把所有历史都读进内存
  const handleSelectionChange = async (id: string | null) => {
    setSelectedId(id);
    if (!id) return;
    const item = items.find((i) => i.filename === id);
    if (!item) return;
    try {
      setPreviewText(await readConfigSnapshot(item.filePath));
    } catch {
      setPreviewText("");
    }
  };

  const parsedPreview = (): ShellConfig | null => {
    try {
      return parseShellConfig(previewText);
    } catch {
      // 历史文件自己也可能坏掉,读不出来就照实说,不要假装是"空配置"
      return null;
    }
  };

  const handleRestore = async (item: ConfigSnapshotItem) => {
    const config = parsedPreview();
    if (!config) {
      await showToast({ style: Toast.Style.Failure, title: t("sch.restoreFailedTitle"), message: t("sch.unreadable") });
      return;
    }

    const confirmed = await confirmAlert({
      title: t("sch.restoreConfirmTitle", { time: item.timestampStr }),
      message: t("sch.restoreConfirmMessage"),
      primaryAction: { title: t("sch.restoreConfirmAction"), style: Alert.ActionStyle.Destructive },
      dismissAction: { title: t("common.cancel") },
    });
    if (!confirmed) return;

    try {
      // saveShellConfig 会先把"当前配置"存成一份新记录,所以恢复本身也是可撤销的
      const snapshot = await saveShellConfig(config);
      await showToast({
        style: Toast.Style.Success,
        title: t("sch.restoredToast"),
        message: snapshotLimitHint(snapshot),
      });
      onRestored();
      pop();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: t("sch.restoreFailedTitle"),
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleDelete = async (item: ConfigSnapshotItem) => {
    const confirmed = await confirmAlert({
      title: t("sch.deleteConfirmTitle"),
      message: t("sch.deleteConfirmMessage", { filename: item.filename }),
      primaryAction: { title: t("common.delete"), style: Alert.ActionStyle.Destructive },
      dismissAction: { title: t("common.cancel") },
    });
    if (!confirmed) return;

    await deleteConfigSnapshot(item.filePath);
    await showToast({ style: Toast.Style.Success, title: t("sch.deletedToast") });
    await refresh();
  };

  // 历史(旧) vs 当前(新)。markdown 正文没法上色,用彩色 emoji 当颜色载体,
  // 跟 .env 快照那边保持同一套视觉语言
  const buildDiffText = (snapshot: ShellConfig): string => {
    const entries = diffShellSnippets(snapshot.snippets, currentConfig.snippets).filter((e) => e.type !== "unchanged");
    if (entries.length === 0) return t("sch.diffNone");

    return entries
      .map((e) => {
        const renamed = e.previousName ? ` ${t("sch.diffRenamed", { name: e.previousName })}` : "";
        if (e.type === "added") return `- ${t("sch.diffAdded")}: \`${e.name}\``;
        if (e.type === "removed") return `- ${t("sch.diffRemoved")}: \`${e.name}\``;
        return `- ${t("sch.diffChanged")}: \`${e.name}\`${renamed}`;
      })
      .join("\n");
  };

  const snippetBlock = (s: ShellSnippet): string => {
    const state = s.enabled ? t("st.enabledTag") : t("st.disabledTag");
    // 历史记录同样要打码——安全策略不能因为"这是旧数据"就放松
    const body = maskShellContent(s.content, { maskAll: s.containsSecret });
    return [`**${s.name}** · ${state}`, "", "```bash", body.trim(), "```"].join("\n");
  };

  const buildMarkdown = (item: ConfigSnapshotItem): string => {
    const snapshot = parsedPreview();
    if (!snapshot) return t("sch.unreadable");

    return [
      t("sch.infoHeading"),
      `- **${t("sch.infoRecordedAt")}**: \`${item.timestampStr}\``,
      `- **${t("sch.infoSnippetCount")}**: \`${snapshot.snippets.length}\``,
      `- **${t("sch.infoFileSize")}**: \`${item.size} bytes\``,
      "",
      "---",
      "",
      t("sch.diffHeading"),
      "",
      buildDiffText(snapshot),
      "",
      "---",
      "",
      t("sch.contentHeading"),
      "",
      snapshot.snippets.length === 0 ? t("sch.contentEmpty") : snapshot.snippets.map(snippetBlock).join("\n\n"),
    ].join("\n");
  };

  return (
    <List
      isLoading={loading}
      isShowingDetail={items.length > 0}
      onSelectionChange={handleSelectionChange}
      navigationTitle={t("sch.navTitle")}
      searchBarPlaceholder={t("sch.searchPlaceholder")}
    >
      <List.Section title={t("sch.sectionTitle")} subtitle={t("sch.sectionSubtitle", { count: items.length })}>
        {items.map((item) => (
          <List.Item
            key={item.filename}
            id={item.filename}
            icon={Icon.Clock}
            title={item.timestampStr}
            detail={<List.Item.Detail markdown={selectedId === item.filename ? buildMarkdown(item) : ""} />}
            actions={
              <ActionPanel>
                <Action title={t("sch.actionRestore")} icon={Icon.Undo} onAction={() => handleRestore(item)} />
                <Action
                  title={t("sch.actionDelete")}
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                  onAction={() => handleDelete(item)}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {items.length === 0 && !loading && (
        <List.EmptyView title={t("sch.emptyTitle")} description={t("sch.emptyDesc")} />
      )}
    </List>
  );
}
