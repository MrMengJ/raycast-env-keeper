import { Action, ActionPanel, Color, Icon, List, showToast, Toast } from "@raycast/api";
import { join } from "node:path";
import { useEffect, useState } from "react";
import { isEncryptedValue, isSecretKey, maskSecret, parseEnv, type ProjectMeta } from "@env-butler/core";
import { t } from "./i18n.js";
import { detectProjectEnvFiles, loadRegistry, readEnvFile } from "./services/storage.js";
import { ProjectDetailView } from "./views/ProjectDetailView.js";

interface MatchedVariable {
  key: string;
  value: string;
  quote: "'" | '"' | null;
  disabled: boolean;
  projectName: string;
  project: ProjectMeta;
  envFilename: string;
  envFilePath: string;
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
        const { data: reg } = await loadRegistry();
        const collected: MatchedVariable[] = [];

        for (const project of reg.projects) {
          const files = await detectProjectEnvFiles(project.path);
          for (const f of files) {
            const fullPath = join(project.path, f);
            try {
              const { content, exists } = await readEnvFile(fullPath);
              if (!exists) continue;
              const lines = parseEnv(content);
              for (const l of lines) {
                if (l.type === "kv") {
                  collected.push({
                    key: l.key,
                    value: l.value,
                    quote: l.quote,
                    disabled: l.disabled,
                    projectName: project.name,
                    project,
                    envFilename: f,
                    envFilePath: fullPath,
                  });
                }
              }
            } catch {
              // ignore single unreadable file
            }
          }
        }
        setAllVars(collected);
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
      v.projectName.toLowerCase().includes(q) ||
      v.envFilename.toLowerCase().includes(q) ||
      (!isSecretKey(v.key, v.project.customSecrets) && v.value.toLowerCase().includes(q))
    );
  });

  return (
    <List
      isLoading={loading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={t("search.placeholder")}
    >
      <List.Section title={t("search.sectionTitle")} subtitle={t("search.sectionSubtitle", { count: filtered.length })}>
        {filtered.map((item, idx) => {
          const uniqueId = `${item.project.id}_${item.envFilename}_${item.key}_${idx}`;
          const isSecret = isSecretKey(item.key, item.project.customSecrets);
          const isEncrypted = isEncryptedValue(item.value);
          const isRevealed = revealedSet.has(uniqueId);
          const displayVal = (isSecret || isEncrypted) && !isRevealed ? maskSecret(item.value) : item.value;

          return (
            <List.Item
              key={uniqueId}
              title={item.key}
              subtitle={displayVal}
              accessories={[
                { text: `${item.projectName} / ${item.envFilename}` },
                ...(isEncrypted ? [{ tag: { value: "encrypted", color: Color.Purple } }] : []),
                ...(isSecret
                  ? [{ icon: { source: Icon.Lock, tintColor: Color.Orange }, tooltip: t("search.lockTooltip") }]
                  : []),
                ...(item.disabled ? [{ tag: { value: t("pd.disabledTag"), color: Color.SecondaryText } }] : []),
              ]}
              actions={
                <ActionPanel>
                  <Action.Push
                    title={t("search.actionGoto")}
                    icon={Icon.ArrowRight}
                    target={<ProjectDetailView project={item.project} />}
                  />
                  {(isSecret || isEncrypted) && (
                    <Action
                      title={isRevealed ? t("search.actionHide") : t("search.actionReveal")}
                      icon={isRevealed ? Icon.EyeDisabled : Icon.Eye}
                      onAction={() => toggleReveal(uniqueId)}
                    />
                  )}
                  <Action.CopyToClipboard title={t("search.actionCopyValue")} content={item.value} concealed />
                  <Action.CopyToClipboard title={t("search.actionCopyKey")} content={item.key} />
                  <Action.OpenWith title={t("mv.actionOpenWith")} path={item.envFilePath} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>

      {filtered.length === 0 && !loading && (
        <List.EmptyView title={t("search.emptyTitle")} description={t("search.emptyDesc")} />
      )}
    </List>
  );
}
