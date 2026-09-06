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
  useNavigation,
} from "@raycast/api";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { useEffect, useState } from "react";
import {
  type EnvLine,
  parseEnv,
  serializeEnv,
  addEnvVariable,
  removeEnvVariable,
  toggleEnvVariable,
  mergeExampleEnv,
  isSecretKey,
  formatKVRaw,
  isEncryptedValue,
  maskSecret,
  type ProjectMeta,
  setEnvrcNoticeDismissed,
  toggleProjectSecret,
} from "@env-butler/core";
import { snapshotLimitHint, t } from "../i18n.js";
import {
  checkEnvrcExists,
  detectProjectEnvFiles,
  loadRegistry,
  readEnvFile,
  saveRegistry,
  writeEnvFileWithSnapshot,
} from "../services/storage.js";
import { CreateEnvFileForm } from "./CreateEnvFileForm.js";
import { EditVariableForm, type VariableFormData } from "./EditVariableForm.js";
import { SnapshotHistoryView } from "./SnapshotHistoryView.js";

interface ProjectDetailViewProps {
  project: ProjectMeta;
  onProjectUpdated?: (project: ProjectMeta) => void;
  /** 从全局搜索跳过来时,直接停在搜到的那个环境文件上,而不是默认的 .env */
  initialEnvFile?: string;
  /** 从全局搜索跳过来时,直接选中搜到的那个变量 */
  initialSelectedKey?: string;
}

/**
 * 下拉框里"新建环境文件"那一项的哨兵值。
 * Raycast 的 List.Dropdown 是"选中即触发",没有单独的按钮位,
 * 所以只能放一个假选项:选中它时不更新当前值(受控值会自己弹回去),直接把表单推上来。
 * 放在这里是因为"我要换个环境"和"我要建一个环境"本来就是同一个语境,
 * 藏在 ⌘K 里太隐蔽了。
 */
const CREATE_ENV_FILE_VALUE = "__env_butler_create_env_file__";

export function ProjectDetailView({
  project,
  onProjectUpdated,
  initialEnvFile,
  initialSelectedKey,
}: ProjectDetailViewProps) {
  const { push } = useNavigation();
  const [currentProject, setCurrentProject] = useState<ProjectMeta>(project);
  const [envFiles, setEnvFiles] = useState<string[]>([]);
  const [selectedEnvFile, setSelectedEnvFile] = useState<string>(initialEnvFile ?? ".env");
  // 只有从全局搜索跳过来时才接管选中项;平时交给 Raycast 自己管,免得跟它的选中逻辑打架
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(initialSelectedKey);
  const [lines, setLines] = useState<EnvLine[]>([]);
  const [currentFingerprint, setCurrentFingerprint] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [hasEnvrc, setHasEnvrc] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const currentEnvFilePath = join(currentProject.path, selectedEnvFile);

  // 初始化探测环境文件与 .envrc(若用户已针对本项目关闭提示,则即使检测到也不再展示)
  const refreshEnvFiles = async () => {
    const files = await detectProjectEnvFiles(currentProject.path);
    setEnvFiles(files);
    if (!files.includes(selectedEnvFile)) {
      setSelectedEnvFile(files[0] ?? ".env");
    }
    const envrc = (await checkEnvrcExists(currentProject.path)) && !currentProject.dismissedEnvrcNotice;
    setHasEnvrc(envrc);
  };

  // 读取当前选中的环境文件
  const loadCurrentEnvContent = async () => {
    setLoading(true);
    try {
      const { content, fingerprint } = await readEnvFile(currentEnvFilePath);
      setLines(parseEnv(content));
      setCurrentFingerprint(fingerprint);
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: t("pd.readFailedTitle"),
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshEnvFiles();
  }, [currentProject.path]);

  useEffect(() => {
    if (selectedEnvFile) {
      loadCurrentEnvContent();
    }
  }, [selectedEnvFile, currentProject.path]);

  // 安全保存并打快照
  const saveLines = async (newLines: EnvLine[], force = false): Promise<boolean> => {
    const serialized = serializeEnv(newLines);
    const result = await writeEnvFileWithSnapshot({
      projectName: currentProject.name,
      envFilePath: currentEnvFilePath,
      newContent: serialized,
      expectedFingerprint: currentFingerprint,
      force,
    });

    if (result.conflict) {
      const confirmed = await confirmAlert({
        title: t("pd.conflictTitle"),
        message: t("pd.conflictMessage", { file: selectedEnvFile }),
        primaryAction: {
          title: t("pd.conflictOverwrite"),
          style: Alert.ActionStyle.Destructive,
        },
        dismissAction: {
          title: t("pd.conflictDiscardMine"),
        },
      });

      if (confirmed) {
        return saveLines(newLines, true);
      } else {
        await loadCurrentEnvContent();
        return false;
      }
    }

    if (result.success && result.newFingerprint) {
      setLines(newLines);
      setCurrentFingerprint(result.newFingerprint);
      await showToast({
        style: Toast.Style.Success,
        title: t("pd.savedToast"),
        message: snapshotLimitHint(result),
      });
      return true;
    }

    return false;
  };

  // 关闭该项目的 .envrc 提示(写入 registry,仅影响本项目)
  const handleDismissEnvrc = async () => {
    const { data: registry } = await loadRegistry();
    const updated = setEnvrcNoticeDismissed(registry, currentProject.id, true);
    await saveRegistry(updated);
    const p = updated.projects.find((item) => item.id === currentProject.id);
    if (p) {
      setCurrentProject(p);
      onProjectUpdated?.(p);
    }
    setHasEnvrc(false);
    await showToast({ style: Toast.Style.Success, title: t("pd.envrcDismissedToast") });
  };

  // 切换变量敏感状态（保存到 registry，不污染 .env）
  const handleToggleSecret = async (key: string) => {
    const wasSecret = isSecretKey(key, currentProject.customSecrets);
    const { data: registry } = await loadRegistry();
    const updated = toggleProjectSecret(registry, currentProject.id, key);
    await saveRegistry(updated);
    const p = updated.projects.find((item) => item.id === currentProject.id);
    if (p) {
      setCurrentProject(p);
      onProjectUpdated?.(p);
    }
    await showToast({
      style: Toast.Style.Success,
      title: wasSecret ? t("pd.secretOffToast") : t("pd.secretOnToast"),
    });
  };

  // 保存变量表单编辑
  const handleSaveVariable = async (data: VariableFormData, oldKey?: string) => {
    let updatedLines = lines;
    if (oldKey && oldKey !== data.key) {
      updatedLines = removeEnvVariable(updatedLines, oldKey);
    }

    updatedLines = addEnvVariable(updatedLines, data.key, data.value, {
      quote: data.quote,
      disabled: data.disabled,
      comment: data.comment,
    });

    // 如果用户在表单里勾选了自定义敏感
    const isCurrentlySecret = isSecretKey(data.key, currentProject.customSecrets);
    if (data.isSecret !== isCurrentlySecret) {
      await handleToggleSecret(data.key);
    }

    await saveLines(updatedLines);
  };

  // 切换行启用/禁用 (# KEY=val)
  const handleToggleEnable = async (key: string) => {
    const updated = toggleEnvVariable(lines, key);
    await saveLines(updated);
  };

  // 删除变量
  const handleDeleteVariable = async (key: string) => {
    const confirmed = await confirmAlert({
      title: t("pd.deleteConfirmTitle", { key }),
      message: t("pd.deleteConfirmMessage", { file: selectedEnvFile, key }),
      primaryAction: {
        title: t("common.delete"),
        style: Alert.ActionStyle.Destructive,
      },
      dismissAction: {
        title: t("common.cancel"),
      },
    });

    if (!confirmed) return;
    const updated = removeEnvVariable(lines, key);
    await saveLines(updated);
  };

  // 生成/更新 .env.example
  // 不是整个重新生成,而是把当前 .env 的键合并进已有模板。
  // .env.example 是提交进 git、给团队看的东西,上面经常有人手写补充说明,
  // 整体重生成会把那些内容全冲掉;而且它此前不在快照体系里,冲掉了毫无退路
  const handleGenerateExample = async () => {
    const examplePath = join(currentProject.path, ".env.example");
    const exists = existsSync(examplePath);
    const existingContent = exists ? await readFile(examplePath, "utf8") : "";
    const merged = mergeExampleEnv(parseEnv(existingContent), lines);

    const summary = t("pd.exampleSummary", {
      added: merged.added.length,
      removed: merged.removed.length,
      kept: merged.kept.length,
    });

    if (exists) {
      if (merged.content === existingContent) {
        await showToast({ style: Toast.Style.Success, title: t("pd.exampleNoChangeToast") });
        return;
      }
      const confirmed = await confirmAlert({
        title: t("pd.exampleConfirmTitle"),
        message: t("pd.exampleConfirmMessage", {
          added: merged.added.length,
          removed: merged.removed.length,
          kept: merged.kept.length,
        }),
        primaryAction: { title: t("pd.exampleConfirmAction") },
        dismissAction: { title: t("common.cancel") },
      });
      if (!confirmed) return;
    }

    // 走快照通道,和 .env 一样有退路
    const result = await writeEnvFileWithSnapshot({
      projectName: currentProject.name,
      envFilePath: examplePath,
      newContent: merged.content,
      force: true,
    });
    await refreshEnvFiles();
    await showToast({
      style: Toast.Style.Success,
      title: t("pd.exampleSuccessTitle"),
      message: [summary, snapshotLimitHint(result)].filter(Boolean).join(" · "),
    });
  };

  // 复制当前环境为 .env
  const handleCopyAsMainEnv = async () => {
    if (selectedEnvFile === ".env") {
      await showToast({ style: Toast.Style.Failure, title: t("pd.alreadyMainEnvToast") });
      return;
    }
    const targetPath = join(currentProject.path, ".env");

    // 目标 .env 已存在时先问一声。虽然覆盖前会自动打快照、内容捞得回来,
    // 但"按一下就把一整个文件换掉"不该在用户毫无察觉的情况下发生。
    // 这里直接查磁盘而不是查 envFiles 状态:文件可能在界面打开期间被外部创建
    if (existsSync(targetPath)) {
      const confirmed = await confirmAlert({
        title: t("pd.copyOverwriteConfirmTitle"),
        message: t("pd.copyOverwriteConfirmMessage", { file: selectedEnvFile }),
        primaryAction: {
          title: t("pd.copyOverwriteConfirmAction"),
          style: Alert.ActionStyle.Destructive,
        },
        dismissAction: {
          title: t("common.cancel"),
        },
      });
      if (!confirmed) return;
    }

    const currentContent = serializeEnv(lines);
    const result = await writeEnvFileWithSnapshot({
      projectName: currentProject.name,
      envFilePath: targetPath,
      newContent: currentContent,
      force: true,
    });
    await refreshEnvFiles();
    await showToast({
      style: Toast.Style.Success,
      title: t("pd.copiedAsMainEnvToast", { file: selectedEnvFile }),
      message: snapshotLimitHint(result),
    });
  };

  // 切换敏感明文显示
  const toggleRevealKey = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const kvLines = lines.filter((l): l is Extract<EnvLine, { type: "kv" }> => l.type === "kv");
  const enabledKvs = kvLines.filter((l) => !l.disabled);
  const disabledKvs = kvLines.filter((l) => l.disabled);

  return (
    <List
      isLoading={loading}
      searchBarPlaceholder={t("pd.searchPlaceholder", { file: selectedEnvFile })}
      {...(initialSelectedKey
        ? { selectedItemId, onSelectionChange: (id: string | null) => setSelectedItemId(id ?? undefined) }
        : {})}
      searchBarAccessory={
        // 文件列表还没探测出来之前不渲染下拉框:那一刻下拉里只剩"新建"这一个哨兵项,
        // 而下拉在挂载时会把当前选中项回调一次,于是一进项目就自己弹出了新建表单
        envFiles.length === 0 ? undefined : (
          <List.Dropdown
            tooltip={t("pd.switchEnvFileTooltip")}
            value={selectedEnvFile}
            onChange={(val) => {
              // 双保险:哨兵只在真有文件可选时才认,挂载期的回调一律忽略
              if (val === CREATE_ENV_FILE_VALUE && envFiles.length > 0) {
                push(
                  <CreateEnvFileForm
                    projectPath={currentProject.path}
                    onCreated={async (filename) => {
                      await refreshEnvFiles();
                      setSelectedEnvFile(filename);
                    }}
                  />,
                );
                return;
              }
              if (val === CREATE_ENV_FILE_VALUE) return;
              setSelectedEnvFile(val);
            }}
            placeholder={t("common.searchPlaceholder")}
          >
            <List.Dropdown.Section>
              {envFiles.map((f) => (
                <List.Dropdown.Item key={f} value={f} title={f} icon={Icon.Document} />
              ))}
            </List.Dropdown.Section>
            <List.Dropdown.Section>
              <List.Dropdown.Item
                value={CREATE_ENV_FILE_VALUE}
                title={t("pd.createEnvFileItem")}
                icon={Icon.NewDocument}
              />
            </List.Dropdown.Section>
          </List.Dropdown>
        )
      }
    >
      {hasEnvrc && (
        <List.Section title={t("pd.sectionEnvrc")}>
          <List.Item
            icon={{ source: Icon.Info, tintColor: Color.Yellow }}
            title={t("pd.envrcTitle")}
            subtitle={t("pd.envrcSubtitle")}
            actions={
              <ActionPanel>
                <Action.Push
                  title={t("pd.envrcLearnMore")}
                  icon={Icon.Info}
                  target={<Detail markdown={t("pd.envrcDetailMarkdown")} navigationTitle={t("pd.envrcTitle")} />}
                />
                <Action title={t("pd.envrcDismiss")} icon={Icon.EyeDisabled} onAction={handleDismissEnvrc} />
              </ActionPanel>
            }
          />
        </List.Section>
      )}

      <List.Section title={t("pd.sectionEnabled")} subtitle={t("pd.countItems", { count: enabledKvs.length })}>
        {enabledKvs.map((kv) => {
          const isSecret = isSecretKey(kv.key, currentProject.customSecrets);
          const isEncrypted = isEncryptedValue(kv.value);
          const isRevealed = revealedKeys.has(kv.key);
          const displayValue = (isSecret || isEncrypted) && !isRevealed ? maskSecret(kv.value) : kv.value;

          return (
            <List.Item
              key={kv.key}
              id={kv.key}
              title={kv.key}
              subtitle={displayValue}
              accessories={[
                ...(isEncrypted ? [{ tag: { value: "encrypted", color: Color.Purple } }] : []),
                ...(isSecret
                  ? [{ icon: { source: Icon.Lock, tintColor: Color.Orange }, tooltip: t("pd.lockTooltip") }]
                  : []),
                ...(kv.quote ? [{ tag: { value: kv.quote === '"' ? '""' : "''", color: Color.SecondaryText } }] : []),
                ...(kv.comment ? [{ icon: Icon.SpeechBubble, tooltip: kv.comment }] : []),
              ]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    {(isSecret || isEncrypted) && (
                      <Action
                        title={isRevealed ? t("pd.actionHide") : t("pd.actionReveal")}
                        icon={isRevealed ? Icon.EyeDisabled : Icon.Eye}
                        onAction={() => toggleRevealKey(kv.key)}
                      />
                    )}
                    {/* concealed:变量值可能是密钥,不该留在 Raycast 的剪贴板历史里被搜到 */}
                    <Action.CopyToClipboard title={t("pd.actionCopyValue")} content={kv.value} concealed />
                    <Action.CopyToClipboard title={t("pd.actionCopyKey")} content={kv.key} />
                    {/* 粘到别的 .env 或终端里最常用的其实是整行,不该逼人复制两次再自己拼 */}
                    <Action.CopyToClipboard
                      title={t("pd.actionCopyPair")}
                      content={formatKVRaw(kv.key, kv.value, { quote: kv.quote, comment: kv.comment, end: "" })}
                      concealed
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section title={t("pd.sectionVariableActions")}>
                    <Action.Push
                      title={t("pd.actionEdit")}
                      icon={Icon.Pencil}
                      shortcut={Keyboard.Shortcut.Common.Edit}
                      target={
                        <EditVariableForm
                          initialData={{
                            key: kv.key,
                            value: kv.value,
                            quote: kv.quote,
                            disabled: kv.disabled,
                            comment: kv.comment,
                          }}
                          customSecrets={currentProject.customSecrets}
                          onSave={(data) => handleSaveVariable(data, kv.key)}
                        />
                      }
                    />
                    <Action.Push
                      title={t("pd.actionNew")}
                      icon={Icon.Plus}
                      shortcut={Keyboard.Shortcut.Common.New}
                      target={
                        <EditVariableForm
                          customSecrets={currentProject.customSecrets}
                          onSave={(data) => handleSaveVariable(data)}
                        />
                      }
                    />
                    <Action
                      title={t("pd.actionToggleOff")}
                      icon={Icon.Pause}
                      shortcut={{ modifiers: ["cmd"], key: "t" }}
                      onAction={() => handleToggleEnable(kv.key)}
                    />
                    <Action
                      title={isSecret ? t("pd.actionSecretOff") : t("pd.actionSecretOn")}
                      icon={Icon.Lock}
                      shortcut={{ modifiers: ["cmd"], key: "m" }}
                      onAction={() => handleToggleSecret(kv.key)}
                    />
                    <Action
                      title={t("pd.actionDelete")}
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                      onAction={() => handleDeleteVariable(kv.key)}
                    />
                  </ActionPanel.Section>

                  <ActionPanel.Section title={t("pd.sectionEnvAndSnapshot")}>
                    <Action.Push
                      title={t("pd.actionSnapshotHistory")}
                      icon={Icon.Clock}
                      shortcut={Keyboard.Shortcut.Common.Duplicate}
                      target={
                        <SnapshotHistoryView
                          projectName={currentProject.name}
                          envFilename={selectedEnvFile}
                          envFilePath={currentEnvFilePath}
                          currentContent={serializeEnv(lines)}
                          customSecrets={currentProject.customSecrets}
                          onRestored={loadCurrentEnvContent}
                        />
                      }
                    />
                    <Action
                      title={t("pd.actionGenerateExample")}
                      icon={Icon.Document}
                      shortcut={{ modifiers: ["cmd"], key: "g" }}
                      onAction={handleGenerateExample}
                    />
                    {selectedEnvFile !== ".env" && (
                      <Action
                        title={t("pd.actionCopyAsMainEnv")}
                        icon={Icon.Duplicate}
                        shortcut={Keyboard.Shortcut.Common.Copy}
                        onAction={handleCopyAsMainEnv}
                      />
                    )}
                    <Action.Push
                      title={t("pd.createEnvFileItem")}
                      icon={Icon.NewDocument}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
                      target={
                        <CreateEnvFileForm
                          projectPath={currentProject.path}
                          onCreated={async (filename) => {
                            await refreshEnvFiles();
                            setSelectedEnvFile(filename);
                          }}
                        />
                      }
                    />
                    <Action.OpenWith title={t("mv.actionOpenWith")} path={currentEnvFilePath} />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>

      {disabledKvs.length > 0 && (
        <List.Section title={t("pd.sectionDisabled")} subtitle={t("pd.countItems", { count: disabledKvs.length })}>
          {disabledKvs.map((kv) => {
            const isSecret = isSecretKey(kv.key, currentProject.customSecrets);
            const isEncrypted = isEncryptedValue(kv.value);
            const isRevealed = revealedKeys.has(kv.key);
            // 禁用不等于不敏感:被注释掉的 PASSWORD 仍然是密码,打码规则必须跟启用项一致
            const displayValue = (isSecret || isEncrypted) && !isRevealed ? maskSecret(kv.value) : kv.value;

            return (
              <List.Item
                key={kv.key}
                id={kv.key}
                title={kv.key}
                subtitle={displayValue}
                accessories={[
                  ...(isSecret
                    ? [{ icon: { source: Icon.Lock, tintColor: Color.Orange }, tooltip: t("pd.lockTooltip") }]
                    : []),
                  { tag: { value: t("pd.disabledTag"), color: Color.SecondaryText } },
                ]}
                actions={
                  <ActionPanel>
                    <Action
                      title={t("pd.actionToggleOn")}
                      icon={Icon.Play}
                      shortcut={{ modifiers: ["cmd"], key: "t" }}
                      onAction={() => handleToggleEnable(kv.key)}
                    />
                    {(isSecret || isEncrypted) && (
                      <Action
                        title={isRevealed ? t("pd.actionHide") : t("pd.actionReveal")}
                        icon={isRevealed ? Icon.EyeDisabled : Icon.Eye}
                        onAction={() => toggleRevealKey(kv.key)}
                      />
                    )}
                    <Action.CopyToClipboard title={t("pd.actionCopyValue")} content={kv.value} concealed />
                    <Action.CopyToClipboard title={t("pd.actionCopyKey")} content={kv.key} />
                    <Action.Push
                      title={t("pd.actionEdit")}
                      icon={Icon.Pencil}
                      shortcut={Keyboard.Shortcut.Common.Edit}
                      target={
                        <EditVariableForm
                          initialData={{
                            key: kv.key,
                            value: kv.value,
                            quote: kv.quote,
                            disabled: kv.disabled,
                            comment: kv.comment,
                          }}
                          customSecrets={currentProject.customSecrets}
                          onSave={(data) => handleSaveVariable(data, kv.key)}
                        />
                      }
                    />
                    <Action
                      title={t("pd.actionDelete")}
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                      onAction={() => handleDeleteVariable(kv.key)}
                    />
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      )}

      {kvLines.length === 0 && !loading && (
        <List.EmptyView
          title={t("pd.emptyTitle")}
          description={t("pd.emptyDesc", { path: currentEnvFilePath })}
          actions={
            <ActionPanel>
              <Action.Push
                title={t("pd.actionNew")}
                icon={Icon.Plus}
                target={
                  <EditVariableForm
                    customSecrets={currentProject.customSecrets}
                    onSave={(data) => handleSaveVariable(data)}
                  />
                }
              />
              <Action.Push
                title={t("pd.createEnvFileItem")}
                icon={Icon.NewDocument}
                shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
                target={
                  <CreateEnvFileForm
                    projectPath={currentProject.path}
                    onCreated={async (filename) => {
                      await refreshEnvFiles();
                      setSelectedEnvFile(filename);
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
