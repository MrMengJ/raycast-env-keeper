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
  moveShellSnippet,
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
  readShellScript,
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

  // 调整片段在 shell.sh 里的先后。列表是按类型分组显示的,分组顺序跟文件里的真实顺序对不上,
  // 所以移动后用 toast 报一下新位置,再配合"查看生成的 shell.sh"让用户能核对
  const handleMove = async (id: string, direction: "up" | "down") => {
    const updated = moveShellSnippet(config, id, direction);
    if (updated === config) return; // 已经在最前/最后,moveShellSnippet 原样返回
    await saveShellConfig(updated);
    setConfig(updated);
    const index = updated.snippets.findIndex((s) => s.id === id) + 1;
    await showToast({
      style: Toast.Style.Success,
      title: t("st.movedToast", { index, total: updated.snippets.length }),
    });
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

  // 三个分组渲染的是同一种条目,props 也完全一样,抽出来避免抄三遍
  const renderSnippet = (item: ShellSnippet) => (
    <SnippetListItem
      key={item.id}
      item={item}
      orderIndex={config.snippets.findIndex((s) => s.id === item.id) + 1}
      orderTotal={config.snippets.length}
      shellKind={shellKind}
      onToggle={handleToggle}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onAdd={handleAdd}
      onMove={handleMove}
    />
  );

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
                <Action.Push title={t("st.actionPreviewScript")} icon={Icon.Document} target={<ShellScriptPreview />} />
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
          {exports.map(renderSnippet)}
        </List.Section>
      )}

      {aliases.length > 0 && (
        <List.Section title={t("st.sectionAliases")} subtitle={t("pd.countItems", { count: aliases.length })}>
          {aliases.map(renderSnippet)}
        </List.Section>
      )}

      {others.length > 0 && (
        <List.Section title={t("st.sectionOthers")} subtitle={t("pd.countItems", { count: others.length })}>
          {others.map(renderSnippet)}
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

// 生成文件的预览页:列表按类型分组,看不出真实先后,这里把 shell.sh 原样摊开
function ShellScriptPreview() {
  const [content, setContent] = useState<string | null>(null);
  const scriptPath = getShellScriptPath();

  useEffect(() => {
    readShellScript().then(setContent);
  }, []);

  let markdown = "";
  if (content !== null) {
    markdown =
      content.trim() === ""
        ? t("st.previewEmpty")
        : [
            t("st.previewIntro"),
            "",
            `**${t("st.previewPathLabel")}**: \`${scriptPath}\``,
            "",
            "---",
            "",
            "```bash",
            content,
            "```",
          ].join("\n");
  }

  return (
    <Detail
      isLoading={content === null}
      navigationTitle={t("st.previewTitle")}
      markdown={markdown}
      actions={
        content ? (
          <ActionPanel>
            <Action.CopyToClipboard title={t("st.previewCopy")} content={content} />
          </ActionPanel>
        ) : undefined
      }
    />
  );
}

// 详情面板内容:元信息(类型/状态/排列顺序/备注) + 完整代码,不用再进编辑表单才能看全
function buildSnippetDetailMarkdown(item: ShellSnippet, orderIndex: number, orderTotal: number): string {
  const statusLabel = item.enabled ? t("st.enabledTag") : t("st.disabledTag");
  const descriptionLabel = item.description || t("st.detailNone");

  return `${t("st.detailHeading")}
- **${t("st.detailType")}**: ${snippetTypeLabel(item.type)}
- **${t("st.detailStatus")}**: ${statusLabel}
- **${t("st.detailOrder")}**: ${t("st.detailOrderValue", { index: orderIndex, total: orderTotal })}
- **${t("st.detailDescription")}**: ${descriptionLabel}

---

\`\`\`bash
${item.content}
\`\`\``;
}

function SnippetListItem({
  item,
  orderIndex,
  orderTotal,
  shellKind,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  onMove,
}: {
  item: ShellSnippet;
  /** 该片段在 shell.sh 生成顺序里的位置,从 1 开始 */
  orderIndex: number;
  orderTotal: number;
  shellKind: ValidatableShell | undefined;
  onToggle: (id: string) => void;
  onEdit: (id: string, data: Omit<ShellSnippet, "id">) => Promise<void>;
  onDelete: (item: ShellSnippet) => void;
  onAdd: (data: Omit<ShellSnippet, "id">) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => void;
}) {
  return (
    <List.Item
      id={item.id}
      title={item.name}
      detail={<List.Item.Detail markdown={buildSnippetDetailMarkdown(item, orderIndex, orderTotal)} />}
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
          {orderIndex > 1 && (
            <Action
              title={t("st.actionMoveUp")}
              icon={Icon.ArrowUp}
              shortcut={Keyboard.Shortcut.Common.MoveUp}
              onAction={() => onMove(item.id, "up")}
            />
          )}
          {orderIndex < orderTotal && (
            <Action
              title={t("st.actionMoveDown")}
              icon={Icon.ArrowDown}
              shortcut={Keyboard.Shortcut.Common.MoveDown}
              onAction={() => onMove(item.id, "down")}
            />
          )}
          <Action.Push title={t("st.actionPreviewScript")} icon={Icon.Document} target={<ShellScriptPreview />} />
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
