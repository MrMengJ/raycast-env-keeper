import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Icon,
  Keyboard,
  List,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { existsSync } from "node:fs";
import { useEffect, useState } from "react";
import { type ProjectMeta, removeProject, sortProjectsByRecent, touchProject } from "@env-butler/core";
import { t } from "./i18n.js";
import {
  type ConfigLoadProblem,
  detectProjectEnvFiles,
  getBaseDir,
  loadRegistry,
  saveRegistry,
} from "./services/storage.js";
import { ConfigProblemItem } from "./views/ConfigProblemItem.js";
import { RelocateProjectForm } from "./views/RelocateProjectForm.js";
import { AddProjectForm } from "./views/AddProjectForm.js";
import { ProjectDetailView } from "./views/ProjectDetailView.js";
import { ShellTrackView } from "./views/ShellTrackView.js";

type ActiveTrack = "projects" | "shell";

// Raycast LocalStorage(扩展私有的小型键值存储,只存界面偏好,不是"真相源"数据)里记住上次打开的轨道
const LAST_TRACK_KEY = "lastActiveTrack";

export default function Command() {
  const [activeTrack, setActiveTrack] = useState<ActiveTrack>("projects");
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [envCounts, setEnvCounts] = useState<Record<string, number>>({});
  const [configProblem, setConfigProblem] = useState<ConfigLoadProblem | undefined>();
  const [missingPaths, setMissingPaths] = useState<Record<string, boolean>>({});

  // 启动时读取上次打开的轨道
  useEffect(() => {
    LocalStorage.getItem<string>(LAST_TRACK_KEY).then((saved) => {
      if (saved === "shell" || saved === "projects") {
        setActiveTrack(saved);
      }
    });
  }, []);

  const handleTrackChange = (val: string) => {
    const next = val as ActiveTrack;
    setActiveTrack(next);
    LocalStorage.setItem(LAST_TRACK_KEY, next);
  };

  const refreshProjects = async () => {
    setLoading(true);
    try {
      const { data: reg, problem } = await loadRegistry();
      setConfigProblem(problem);
      const sorted = sortProjectsByRecent(reg);
      setProjects(sorted);

      // 探测每个项目下的环境文件数,顺便记下哪些项目的目录已经不在了
      // (目录被改名或搬走时,继续显示成正常项目会让人点进去才发现打不开)
      const counts: Record<string, number> = {};
      const missing: Record<string, boolean> = {};
      await Promise.all(
        sorted.map(async (p) => {
          missing[p.id] = !existsSync(p.path);
          const files = await detectProjectEnvFiles(p.path);
          counts[p.id] = files.length;
        }),
      );
      setEnvCounts(counts);
      setMissingPaths(missing);
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: t("mv.loadRegistryFailedTitle"),
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  const handleOpenProject = async (p: ProjectMeta) => {
    const { data: reg } = await loadRegistry();
    const updated = touchProject(reg, p.id);
    await saveRegistry(updated);
  };

  const handleRemoveProject = async (p: ProjectMeta) => {
    const confirmed = await confirmAlert({
      title: t("mv.removeConfirmTitle", { name: p.name }),
      message: t("mv.removeConfirmMessage"),
      primaryAction: {
        title: t("mv.removeConfirmAction"),
        style: Alert.ActionStyle.Destructive,
      },
      dismissAction: {
        title: t("common.cancel"),
      },
    });

    if (!confirmed) return;

    const { data: reg } = await loadRegistry();
    const updated = removeProject(reg, p.id);
    await saveRegistry(updated);
    await refreshProjects();
    await showToast({ style: Toast.Style.Success, title: t("mv.removedToastTitle", { name: p.name }) });
  };

  const trackDropdown = (
    <List.Dropdown
      tooltip={t("mv.trackTooltip")}
      value={activeTrack}
      onChange={handleTrackChange}
      placeholder={t("common.searchPlaceholder")}
    >
      <List.Dropdown.Item value="projects" title={t("mv.trackProjects")} icon={Icon.Folder} />
      <List.Dropdown.Item value="shell" title={t("mv.trackShell")} icon={Icon.Terminal} />
    </List.Dropdown>
  );

  if (activeTrack === "shell") {
    // 注意:ShellTrackView 自己就是一个完整的 <List>,这里不能再包一层 <List>
    // (Raycast 的 List 组件子元素只能是 List.Item/List.Section/List.EmptyView,
    //  嵌套另一个 List 会导致内容渲染不出来,只显示兜底的 "No Results")
    return <ShellTrackView searchBarAccessory={trackDropdown} />;
  }

  return (
    <List
      isLoading={loading}
      searchBarPlaceholder={t("mv.searchPlaceholderProjects")}
      searchBarAccessory={trackDropdown}
    >
      {configProblem && (
        <List.Section title={t("cfg.sectionTitle")}>
          <ConfigProblemItem problem={configProblem} />
        </List.Section>
      )}

      <List.Section title={t("mv.sectionTitle")} subtitle={t("mv.sectionSubtitle", { count: projects.length })}>
        {projects.map((p) => {
          const envCount = envCounts[p.id] ?? 1;
          const dateStr = new Date(p.lastOpenedAt).toLocaleDateString();
          const isMissing = missingPaths[p.id] === true;

          return (
            <List.Item
              key={p.id}
              icon={
                isMissing
                  ? { source: Icon.QuestionMarkCircle, tintColor: Color.SecondaryText }
                  : { source: Icon.Folder, tintColor: Color.Blue }
              }
              title={p.name}
              subtitle={p.path}
              accessories={
                isMissing
                  ? [{ tag: { value: t("mv.missingTag"), color: Color.Orange }, tooltip: t("mv.missingTooltip") }]
                  : [
                      { text: t("mv.envCountAccessory", { count: envCount }) },
                      { text: t("mv.lastOpenedAccessory", { date: dateStr }) },
                    ]
              }
              actions={
                <ActionPanel>
                  {/* 目录已经不在时,首要动作换成"重新指过去",而不是让人点进一个打不开的项目 */}
                  {isMissing ? (
                    <Action.Push
                      title={t("mv.actionRelocate")}
                      icon={Icon.ArrowRight}
                      target={<RelocateProjectForm project={p} onDone={() => refreshProjects()} />}
                    />
                  ) : (
                    <Action.Push
                      title={t("mv.actionManage")}
                      icon={Icon.Gear}
                      target={<ProjectDetailView project={p} onProjectUpdated={() => refreshProjects()} />}
                      onPush={() => handleOpenProject(p)}
                    />
                  )}
                  <Action.Push
                    title={t("mv.actionAddProject")}
                    icon={Icon.Plus}
                    shortcut={Keyboard.Shortcut.Common.New}
                    target={<AddProjectForm onProjectAdded={() => refreshProjects()} />}
                  />
                  <Action.OpenWith
                    title={t("mv.actionOpenWith")}
                    path={p.path}
                    shortcut={Keyboard.Shortcut.Common.Open}
                  />
                  <Action
                    title={t("mv.actionRemove")}
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                    onAction={() => handleRemoveProject(p)}
                  />
                  {/* 设计决议说"换机 = 拷目录",但界面里从没告诉过用户目录在哪 */}
                  <Action.ShowInFinder title={t("common.showDataDir")} path={getBaseDir()} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>

      {projects.length === 0 && !loading && (
        <List.EmptyView
          title={t("mv.emptyTitle")}
          description={t("mv.emptyDesc")}
          actions={
            <ActionPanel>
              <Action.Push
                title={t("mv.actionAddProject")}
                icon={Icon.Plus}
                target={<AddProjectForm onProjectAdded={() => refreshProjects()} />}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
