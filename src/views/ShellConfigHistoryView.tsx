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
import { diffSection, formatShellDiff } from "./diffFormat.js";
import { SnapshotCleanupForm } from "./SnapshotCleanupForm.js";

interface ShellConfigHistoryViewProps {
  /** 当前生效的配置,用来跟历史记录做差异对比 */
  currentConfig: ShellConfig;
  onRestored: () => void;
  /**
   * 只看某一个片段的变更历史。
   * 这是只读的筛选视图:回滚仍然是整份配置回滚——单独把一个片段回滚回去,
   * 很容易凑出一个从来没存在过的组合(比如 A 回到旧值、B 还是新值,而两者本来是配套的)。
   */
  focusSnippet?: { id: string; name: string };
}

/** 判断两个版本里的同一个片段是否一模一样(都不存在也算一样) */
function sameSnippet(a: ShellSnippet | undefined, b: ShellSnippet | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.name === b.name &&
    a.type === b.type &&
    a.content === b.content &&
    a.enabled === b.enabled &&
    a.containsSecret === b.containsSecret &&
    a.description === b.description
  );
}

/**
 * Shell 配置的历史记录。
 *
 * 为什么 Shell 轨比项目轨更需要它:.env 至少可能在 git 里留着副本,
 * 而片段只存在 shell.json 这一处——改错、删错、或者配置文件损坏,
 * 在这个页面出现之前是完全没有退路的。
 */
export function ShellConfigHistoryView({ currentConfig, onRestored, focusSnippet }: ShellConfigHistoryViewProps) {
  const { pop } = useNavigation();
  const [items, setItems] = useState<ConfigSnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  /** 选中项再往前一份的内容;null 表示这已经是最早的一份 */
  const [prevText, setPrevText] = useState<string | null>(null);
  /** 只在"看单个片段"时用:要判断哪几版动过这个片段,必须把每一版都读出来 */
  const [allContents, setAllContents] = useState<Map<string, string>>(new Map());

  const refresh = async () => {
    setLoading(true);
    const list = await listConfigSnapshots("shell");
    setItems(list);

    if (focusSnippet) {
      const map = new Map<string, string>();
      await Promise.all(
        list.map(async (i) => {
          try {
            map.set(i.filename, await readConfigSnapshot(i.filePath));
          } catch {
            // 单份读不出来不影响其他版本
          }
        }),
      );
      setAllContents(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [focusSnippet?.id]);

  const parseOrNull = (text: string): ShellConfig | null => {
    try {
      return parseShellConfig(text);
    } catch {
      // 历史文件自己也可能坏掉,读不出来就照实说,不要假装是"空配置"
      return null;
    }
  };

  const snippetIn = (text: string | undefined): ShellSnippet | undefined => {
    if (!text || !focusSnippet) return undefined;
    return parseOrNull(text)?.snippets.find((s) => s.id === focusSnippet.id);
  };

  // 看单个片段时,只留下"这一版动过它"的记录;整份看时不过滤
  const visibleItems = focusSnippet
    ? items.filter((item, idx) => {
        const older = items[idx + 1];
        return !sameSnippet(
          snippetIn(allContents.get(item.filename)),
          snippetIn(older && allContents.get(older.filename)),
        );
      })
    : items;

  // 选中哪份就读哪份,顺带把更早的一份也读进来——差异区第一个要回答的问题是
  // "这一次保存改了什么",只跟当前配置比是答不出来的
  const handleSelectionChange = async (id: string | null) => {
    setSelectedId(id);
    if (!id) return;
    const idx = visibleItems.findIndex((i) => i.filename === id);
    const item = visibleItems[idx];
    if (!item) return;

    try {
      setPreviewText(await readConfigSnapshot(item.filePath));
    } catch {
      setPreviewText("");
    }

    // 在整份视图里"上一版"就是列表的下一项;在片段视图里同样取筛选后的下一项,
    // 那正是"这个片段上一次的样子"
    const older = visibleItems[idx + 1];
    if (!older) {
      setPrevText(null);
      return;
    }
    try {
      setPrevText(await readConfigSnapshot(older.filePath));
    } catch {
      setPrevText(null);
    }
  };

  const handleRestore = async (item: ConfigSnapshotItem) => {
    const config = parseOrNull(previewText);
    if (!config) {
      await showToast({ style: Toast.Style.Failure, title: t("sch.restoreFailedTitle"), message: t("sch.unreadable") });
      return;
    }

    // 在"某个片段的变更历史"里点恢复,恢复的仍然是**整份配置**——
    // 页面标题只提一个片段,动作却会把别的片段一起带回去,这是最容易伤到人的地方,
    // 所以确认框里必须点名还有哪些片段会跟着变
    const alsoAffected = focusSnippet
      ? diffShellSnippets(currentConfig.snippets, config.snippets)
          .filter((e) => e.type !== "unchanged" && e.id !== focusSnippet.id)
          .map((e) => e.name)
      : [];

    const confirmed = await confirmAlert({
      title: t("sch.restoreConfirmTitle", { time: item.timestampStr }),
      message: !focusSnippet
        ? t("sch.restoreConfirmMessage")
        : alsoAffected.length === 0
          ? t("sch.focusRestoreOnlyThis", { name: focusSnippet.name })
          : t("sch.focusRestoreAlsoAffects", {
              name: focusSnippet.name,
              others: alsoAffected.join("、"),
              count: alsoAffected.length,
            }),
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

  const snippetBlock = (s: ShellSnippet): string => {
    const state = s.enabled ? t("st.enabledTag") : t("st.disabledTag");
    // 历史记录同样要打码——安全策略不能因为"这是旧数据"就放松
    const body = maskShellContent(s.content, { maskAll: s.containsSecret });
    return [`**${s.name}** · ${state}`, "", "```bash", body.trim(), "```"].join("\n");
  };

  /** 只看一个片段时的差异描述:它在两个版本之间是新增、删除、改动还是没动 */
  const focusDiffText = (fromText: string | null, toText: string): string => {
    if (fromText === null) return t("diff.noPrev");
    const from = snippetIn(fromText);
    const to = snippetIn(toText);
    if (sameSnippet(from, to)) return t("sch.focusUnchanged");
    if (!from && to) return `${t("diff.added")} \`${to.name}\``;
    if (from && !to) return `${t("diff.removed")} \`${from.name}\``;
    const renamed = from && to && from.name !== to.name ? ` ${t("diff.renamed", { name: from.name })}` : "";
    return `${t("diff.changed")} \`${to?.name ?? focusSnippet?.name ?? ""}\`${renamed}`;
  };

  const buildMarkdown = (item: ConfigSnapshotItem): string => {
    const snapshot = parseOrNull(previewText);
    if (!snapshot) return t("sch.unreadable");

    const info = [
      `### ${t("sch.infoHeading")}`,
      "",
      `**${t("sch.infoRecordedAt")}**: \`${item.timestampStr}\``,
      "",
      `**${t("sch.infoSnippetCount")}**: \`${snapshot.snippets.length}\``,
      "",
      `**${t("sch.infoFileSize")}**: \`${item.size} bytes\``,
    ];

    if (focusSnippet) {
      const here = snippetIn(previewText);
      return [
        ...info,
        "",
        "---",
        "",
        diffSection("fromPrev", focusDiffText(prevText, previewText)),
        "",
        "---",
        "",
        diffSection("toCurrent", focusDiffText(previewText, JSON.stringify(currentConfig))),
        "",
        "---",
        "",
        `### ${t("sch.contentHeading")}`,
        "",
        here ? snippetBlock(here) : t("sch.focusAbsent"),
      ].join("\n");
    }

    const prevSnapshot = prevText === null ? null : parseOrNull(prevText);
    const diffFromPrev =
      prevText === null
        ? t("diff.noPrev")
        : prevSnapshot
          ? formatShellDiff(diffShellSnippets(prevSnapshot.snippets, snapshot.snippets))
          : t("sch.unreadable");

    return [
      ...info,
      "",
      "---",
      "",
      diffSection("fromPrev", diffFromPrev),
      "",
      "---",
      "",
      diffSection("toCurrent", formatShellDiff(diffShellSnippets(snapshot.snippets, currentConfig.snippets))),
      "",
      "---",
      "",
      `### ${t("sch.contentHeading")}`,
      "",
      snapshot.snippets.length === 0 ? t("sch.contentEmpty") : snapshot.snippets.map(snippetBlock).join("\n\n"),
    ].join("\n");
  };

  return (
    <List
      isLoading={loading}
      isShowingDetail={visibleItems.length > 0}
      onSelectionChange={handleSelectionChange}
      navigationTitle={focusSnippet ? t("sch.focusNavTitle", { name: focusSnippet.name }) : t("sch.navTitle")}
      searchBarPlaceholder={t("sch.searchPlaceholder")}
    >
      <List.Section
        title={focusSnippet ? t("sch.focusSectionTitle", { name: focusSnippet.name }) : t("sch.sectionTitle")}
        subtitle={t("sch.sectionSubtitle", { count: visibleItems.length })}
      >
        {visibleItems.map((item) => (
          <List.Item
            key={item.filename}
            id={item.filename}
            icon={Icon.Clock}
            title={item.timestampStr}
            detail={<List.Item.Detail markdown={selectedId === item.filename ? buildMarkdown(item) : ""} />}
            actions={
              <ActionPanel>
                <Action
                  title={focusSnippet ? t("sch.focusActionRestore") : t("sch.actionRestore")}
                  icon={Icon.Undo}
                  onAction={() => handleRestore(item)}
                />
                {/* 配置里可能带明文密钥,不该留在 Raycast 的剪贴板历史里被搜到 */}
                <Action.CopyToClipboard title={t("sch.actionCopy")} content={previewText} concealed />
                <Action
                  title={t("sch.actionDelete")}
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                  onAction={() => handleDelete(item)}
                />
                <Action.Push
                  title={t("sch.actionCleanup")}
                  icon={Icon.DeleteDocument}
                  target={
                    <SnapshotCleanupForm
                      navTitle={t("sch.actionCleanup")}
                      unit={t("sch.cleanupUnit")}
                      description={t("sch.cleanupDescription")}
                      snapshots={items}
                      onDelete={deleteConfigSnapshot}
                      onCleaned={refresh}
                    />
                  }
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {visibleItems.length === 0 && !loading && (
        <List.EmptyView
          title={focusSnippet ? t("sch.focusEmptyTitle") : t("sch.emptyTitle")}
          description={focusSnippet ? t("sch.focusEmptyDesc") : t("sch.emptyDesc")}
        />
      )}
    </List>
  );
}
