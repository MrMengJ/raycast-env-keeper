import { Action, ActionPanel, Alert, confirmAlert, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { readFile } from "node:fs/promises";
import { useEffect, useState } from "react";
import { diffEnvVariables, isSecretKey, maskSecret, parseEnv } from "@env-butler/core";
import { t } from "../i18n.js";
import { deleteSnapshot, listSnapshots, restoreSnapshot, type SnapshotItem } from "../services/storage.js";

interface SnapshotHistoryViewProps {
  projectName: string;
  envFilename: string;
  envFilePath: string;
  /** 当前(磁盘上最新保存)的完整文件内容,用于跟快照做差异对比 */
  currentContent: string;
  customSecrets?: string[];
  onRestored: () => void;
}

export function SnapshotHistoryView({
  projectName,
  envFilename,
  envFilePath,
  currentContent,
  customSecrets,
  onRestored,
}: SnapshotHistoryViewProps) {
  const { pop } = useNavigation();
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");

  const refreshSnapshots = async () => {
    setLoading(true);
    try {
      const items = await listSnapshots(projectName, envFilename);
      setSnapshots(items);
      if (items.length > 0 && !selectedSnapshot) {
        const first = items[0];
        if (first) {
          setSelectedSnapshot(first);
          const c = await readFile(first.filePath, "utf8");
          setPreviewContent(c);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSnapshots();
  }, [projectName, envFilename]);

  const handleSelectionChange = async (id: string | null) => {
    const item = snapshots.find((s) => s.filename === id);
    if (item) {
      setSelectedSnapshot(item);
      try {
        const c = await readFile(item.filePath, "utf8");
        setPreviewContent(c);
      } catch {
        setPreviewContent(t("sh.unreadableContent"));
      }
    }
  };

  const handleRestore = async (item: SnapshotItem) => {
    const confirmed = await confirmAlert({
      title: t("sh.restoreConfirmTitle", { timestamp: item.timestampStr }),
      message: t("sh.restoreConfirmMessage", { file: envFilename }),
      primaryAction: {
        title: t("sh.restoreConfirmAction"),
        style: Alert.ActionStyle.Destructive,
      },
      dismissAction: {
        title: t("common.cancel"),
      },
    });

    if (!confirmed) return;

    try {
      const result = await restoreSnapshot({
        projectName,
        snapshotFilePath: item.filePath,
        targetEnvFilePath: envFilePath,
      });

      if (result.success) {
        await showToast({ style: Toast.Style.Success, title: t("sh.restoredToast") });
        onRestored();
        pop();
      } else {
        await showToast({ style: Toast.Style.Failure, title: t("sh.restoreFailedTitle"), message: result.error });
      }
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: t("sh.restoreErrorTitle"),
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleDelete = async (item: SnapshotItem) => {
    const confirmed = await confirmAlert({
      title: t("sh.deleteConfirmTitle"),
      message: t("sh.deleteConfirmMessage", { filename: item.filename }),
      primaryAction: {
        title: t("common.delete"),
        style: Alert.ActionStyle.Destructive,
      },
      dismissAction: {
        title: t("common.cancel"),
      },
    });
    if (!confirmed) return;

    await deleteSnapshot(item.filePath);
    await showToast({ style: Toast.Style.Success, title: t("sh.deletedToast") });
    await refreshSnapshots();
  };

  const displayVal = (key: string, value: string | undefined) => {
    if (value === undefined) return "";
    return isSecretKey(key, customSecrets) ? maskSecret(value) : value;
  };

  // 快照内容:注释行、空行原样保留(比结构化展示更贴近原文),只把敏感值打码——
  // 跟 App 其他地方一致,不在这里把密钥明文倒出来。
  const contentText = parseEnv(previewContent)
    .map((line) => {
      if (line.type !== "kv") return line.raw.trimEnd();
      return `${line.disabled ? "# " : ""}${line.key}=${displayVal(line.key, line.value)}`;
    })
    .join("\n");

  // 快照(旧) vs 当前文件(新) 的差异;只挑改动的行,一致的不列出来。
  // markdown 正文没法上色,用彩色 emoji 当颜色载体(🟢 新增 / 🔴 删除 / 🟡 改动),
  // 这是在 CommonMark 里唯一能带颜色信号的办法。
  const diffText = (() => {
    const entries = diffEnvVariables(parseEnv(previewContent), parseEnv(currentContent)).filter(
      (e) => e.type !== "unchanged",
    );

    return entries
      .map((e) => {
        if (e.type === "added") {
          return `- ${t("sh.diffAdded")}: \`${e.key}\` = \`${displayVal(e.key, e.targetValue)}\``;
        }
        if (e.type === "removed") {
          return `- ${t("sh.diffRemoved")}: \`${e.key}\` = \`${displayVal(e.key, e.baseValue)}\``;
        }
        return `- ${t("sh.diffChanged")}: \`${e.key}\`: \`${displayVal(e.key, e.baseValue)}\` → \`${displayVal(e.key, e.targetValue)}\``;
      })
      .join("\n");
  })();

  const buildMarkdown = (item: SnapshotItem): string =>
    [
      `### ${t("sh.infoHeading")}`,
      `- **${t("sh.infoTargetFile")}**: \`${item.envFilename}\``,
      `- **${t("sh.infoRecordedAt")}**: \`${item.timestampStr}\``,
      `- **${t("sh.infoFileSize")}**: \`${item.size} bytes\``,
      "",
      "---",
      "",
      `### ${t("sh.diffHeading")}`,
      "",
      diffText || t("sh.diffNone"),
      "",
      "---",
      "",
      `### ${t("sh.contentHeading")}`,
      "",
      contentText.trim() ? `\`\`\`dotenv\n${contentText}\n\`\`\`` : t("sh.contentEmpty"),
    ].join("\n");

  return (
    <List
      isLoading={loading}
      isShowingDetail={snapshots.length > 0}
      onSelectionChange={handleSelectionChange}
      searchBarPlaceholder={t("sh.searchPlaceholder")}
    >
      <List.Section
        title={t("sh.sectionTitle", { file: envFilename })}
        subtitle={t("sh.sectionSubtitle", { count: snapshots.length })}
      >
        {snapshots.map((item) => (
          <List.Item
            key={item.filename}
            id={item.filename}
            title={item.timestampStr}
            detail={<List.Item.Detail markdown={buildMarkdown(item)} />}
            actions={
              <ActionPanel>
                <Action title={t("sh.actionRestore")} icon={Icon.Undo} onAction={() => handleRestore(item)} />
                <Action.CopyToClipboard title={t("sh.actionCopyContent")} content={previewContent} />
                <Action
                  title={t("sh.actionDelete")}
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
      {snapshots.length === 0 && <List.EmptyView title={t("sh.emptyTitle")} description={t("sh.emptyDesc")} />}
    </List>
  );
}
