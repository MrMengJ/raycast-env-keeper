import { Action, ActionPanel, Color, Icon, List, showToast, Toast } from "@raycast/api";
import { join } from "node:path";
import { useEffect, useState } from "react";
import {
  extractShellAssignments,
  isEncryptedValue,
  isSecretKey,
  maskSecret,
  parseEnv,
  type ProjectMeta,
} from "@env-butler/core";
import { t } from "./i18n.js";
import { detectProjectEnvFiles, loadRegistry, loadShellConfig, readEnvFile } from "./services/storage.js";
import { ProjectDetailView } from "./views/ProjectDetailView.js";
import { ShellTrackView } from "./views/ShellTrackView.js";

interface MatchedVariable {
  key: string;
  value: string;
  disabled: boolean;
  /** 展示用的来源:项目名 或 Shell 轨的片段名 */
  sourceLabel: string;
  /** 项目轨才有;Shell 轨的变量没有对应文件 */
  project?: ProjectMeta;
  envFilePath?: string;
}

export default function Command() {
  const [allVars, setAllVars] = useState<MatchedVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadAllVars() {
      setLoading(true);
      try {
        // 项目和文件都并行扫。原先是嵌套 for + await 串行,
        // 10 个项目 × 3 个文件就是 30 次排队等待的磁盘往返
        const [{ data: reg }, shell] = await Promise.all([loadRegistry(), loadShellConfig()]);

        const perProject = await Promise.all(
          reg.projects.map(async (project) => {
            const files = await detectProjectEnvFiles(project.path);
            const perFile = await Promise.all(
              files.map(async (f) => {
                const fullPath = join(project.path, f);
                try {
                  // 搜索只读内容,不需要冲突检测用的指纹,省掉每个文件一次哈希
                  const { content, exists } = await readEnvFile(fullPath, { withFingerprint: false });
                  if (!exists) return [];
                  return parseEnv(content)
                    .filter((l): l is Extract<typeof l, { type: "kv" }> => l.type === "kv")
                    .map<MatchedVariable>((l) => ({
                      key: l.key,
                      value: l.value,
                      disabled: l.disabled,
                      sourceLabel: `${project.name} / ${f}`,
                      project,
                      envFilePath: fullPath,
                    }));
                } catch {
                  // 单个文件读不了就跳过,不影响其余结果
                  return [];
                }
              }),
            );
            return perFile.flat();
          }),
        );

        // Shell 轨里存的同样是环境变量,搜 JAVA_HOME 却搜不到会被当成 bug
        const shellVars = shell.data.snippets.flatMap((snippet) =>
          extractShellAssignments(snippet.content).map<MatchedVariable>((a) => ({
            key: a.key,
            value: a.value,
            disabled: !snippet.enabled,
            sourceLabel: t("search.shellSource", { name: snippet.name }),
          })),
        );

        setAllVars([...perProject.flat(), ...shellVars]);
      } catch (e) {
        await showToast({
          style: Toast.Style.Failure,
          title: t("search.loadFailedTitle"),
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setLoading(false);
      }
    }
    loadAllVars();
  }, []);

  const toggleReveal = (id: string) => {
    setRevealedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = allVars.filter((v) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      v.key.toLowerCase().includes(q) ||
      v.sourceLabel.toLowerCase().includes(q) ||
      // 敏感值不参与按值搜索:否则在搜索框里逐字试探就能反推出密钥
      (!isSecretKey(v.key, v.project?.customSecrets) && v.value.toLowerCase().includes(q))
    );
  });
  const projectVars = filtered.filter((v) => v.project);
  const shellVars = filtered.filter((v) => !v.project);

  const renderSection = (title: string, items: MatchedVariable[]) => {
    if (items.length === 0) return null;
    return (
      <List.Section title={title} subtitle={t("search.sectionSubtitle", { count: items.length })}>
        {items.map((item, idx) => {
          const uniqueId = `${item.project?.id ?? "shell"}_${item.sourceLabel}_${item.key}_${idx}`;
          const isSecret = isSecretKey(item.key, item.project?.customSecrets);
          const isEncrypted = isEncryptedValue(item.value);
          const isRevealed = revealedSet.has(uniqueId);
          const displayVal = (isSecret || isEncrypted) && !isRevealed ? maskSecret(item.value) : item.value;

          return (
            <List.Item
              key={uniqueId}
              title={item.key}
              subtitle={displayVal}
              accessories={[
                { text: item.sourceLabel },
                ...(isEncrypted ? [{ tag: { value: "encrypted", color: Color.Purple } }] : []),
                ...(isSecret
                  ? [{ icon: { source: Icon.Lock, tintColor: Color.Orange }, tooltip: t("search.lockTooltip") }]
                  : []),
                ...(item.disabled ? [{ tag: { value: t("pd.disabledTag"), color: Color.SecondaryText } }] : []),
              ]}
              actions={
                <ActionPanel>
                  {item.project ? (
                    <Action.Push
                      title={t("search.actionGoto")}
                      icon={Icon.ArrowRight}
                      target={<ProjectDetailView project={item.project} />}
                    />
                  ) : (
                    <Action.Push title={t("search.actionGotoShell")} icon={Icon.Terminal} target={<ShellTrackView />} />
                  )}
                  {(isSecret || isEncrypted) && (
                    <Action
                      title={isRevealed ? t("search.actionHide") : t("search.actionReveal")}
                      icon={isRevealed ? Icon.EyeDisabled : Icon.Eye}
                      onAction={() => toggleReveal(uniqueId)}
                    />
                  )}
                  <Action.CopyToClipboard title={t("search.actionCopyValue")} content={item.value} concealed />
                  <Action.CopyToClipboard title={t("search.actionCopyKey")} content={item.key} />
                  {item.envFilePath && <Action.OpenWith title={t("mv.actionOpenWith")} path={item.envFilePath} />}
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    );
  };

  return (
    <List
      isLoading={loading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={t("search.placeholder")}
    >
      {renderSection(t("search.sectionTitle"), projectVars)}
      {renderSection(t("search.sectionShell"), shellVars)}

      {filtered.length === 0 && !loading && (
        <List.EmptyView title={t("search.emptyTitle")} description={t("search.emptyDesc")} />
      )}
    </List>
  );
}
