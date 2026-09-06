import { copyFile, mkdir, readdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  type RegistryData,
  createEmptyRegistry,
  formatRegistry,
  parseRegistry,
  type ShellConfig,
  createEmptyShellConfig,
  formatShellConfig,
  generateShellScript,
  parseShellConfig,
  computeFingerprint,
  generateSnapshotFilename,
  parseSnapshotFilename,
  formatSnapshotTimestamp,
  checkSnapshotSoftLimit,
  SNAPSHOT_SOFT_LIMIT,
  ConfigFileError,
  type ConfigFailureReason,
  CURRENT_REGISTRY_VERSION,
  CURRENT_SHELL_CONFIG_VERSION,
} from "@env-butler/core";

const BASE_DIR = join(homedir(), ".env-butler");
const REGISTRY_FILE = join(BASE_DIR, "registry.json");
const SHELL_CONFIG_FILE = join(BASE_DIR, "shell.json");
const SHELL_SCRIPT_FILE = join(BASE_DIR, "shell.sh");
const SNAPSHOTS_DIR = join(BASE_DIR, "snapshots");
const BACKUPS_DIR = join(BASE_DIR, "backups");
// 扩展自己那两个配置文件(shell.json / registry.json)的历史。
// 不塞进 snapshots/ 是因为那层目录是按项目名寻址的,真有个项目叫 _shell 就会撞上
const CONFIG_HISTORY_DIR = join(BASE_DIR, "config-history");

export function getBaseDir(): string {
  return BASE_DIR;
}

/** 给隔离文件/备份文件用的时间戳后缀,和快照命名保持同一种可读格式 */
function fileTimestamp(date = new Date()): string {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

/**
 * 原子写:先写同目录下的临时文件,再 rename 覆盖目标。
 * 同一文件系统内 rename 是原子的——读到的要么是完整的旧文件、要么是完整的新文件,
 * 不会出现"写到一半进程被杀"留下的残缺内容(Raycast 被系统内存回收过,这不是假想)。
 *
 * 两个必须处理的细节:
 * - 目标是符号链接时先解析真实路径,否则 rename 会把链接本身换掉
 * - 保留原文件权限:用户可能把 .env chmod 600 过,不能因为一次保存又放开成 644
 */
export async function writeFileAtomic(filePath: string, content: string, explicitMode?: number): Promise<void> {
  let target = filePath;
  if (existsSync(filePath)) {
    try {
      target = await realpath(filePath);
    } catch {
      // 解析不了就按原路径写
    }
  }

  let mode = explicitMode;
  if (mode === undefined && existsSync(target)) {
    try {
      mode = (await stat(target)).mode & 0o777;
    } catch {
      // 拿不到就用系统默认
    }
  }

  const dir = dirname(target);
  const tmpPath = join(dir, `.${basename(target)}.env-butler-tmp-${process.pid}-${Date.now()}`);
  try {
    await writeFile(tmpPath, content, mode === undefined ? { encoding: "utf8" } : { encoding: "utf8", mode });
    await rename(tmpPath, target);
  } catch (e) {
    try {
      await unlink(tmpPath);
    } catch {
      // 临时文件清不掉不影响主流程
    }
    throw e;
  }
}

/**
 * 时间戳只精确到秒,同一秒内连续保存(快速切开关、连按上移)会撞名,
 * 直接写就会把上一份历史覆盖掉。撞上就在时间戳后面补 -2 / -3。
 */
async function uniqueSnapshotPath(dir: string, filename: string): Promise<string> {
  const first = join(dir, filename);
  if (!existsSync(first)) return first;

  const dot = filename.indexOf(".");
  const stamp = dot < 0 ? filename : filename.slice(0, dot);
  const rest = dot < 0 ? "" : filename.slice(dot);
  for (let i = 2; i < 1000; i++) {
    const candidate = join(dir, `${stamp}-${i}${rest}`);
    if (!existsSync(candidate)) return candidate;
  }
  return first;
}

/** 扩展自己的两份配置文件,各自有一条历史线 */
export type ConfigKind = "shell" | "registry";

export interface ConfigSnapshotItem {
  filename: string;
  filePath: string;
  /** 形如 2026-09-06-094028 */
  timestampStr: string;
  size: number;
  mtime: Date;
}

export interface ConfigSnapshotResult {
  /** 本次是否真的打了快照(内容没变就不打) */
  taken: boolean;
  snapshotCount?: number;
  snapshotLimitExceeded?: boolean;
  snapshotLimit?: number;
}

function configHistoryDir(kind: ConfigKind): string {
  return join(CONFIG_HISTORY_DIR, kind);
}

function configFileName(kind: ConfigKind): string {
  return kind === "shell" ? "shell.json" : "registry.json";
}

/**
 * 写入前把旧内容存一份。
 *
 * 为什么 Shell 轨比项目轨更需要这个:.env 至少可能在 git 里有副本,
 * 而片段只存在 shell.json 这一处,改错、删错都没有任何退路。
 * 内容没变就不打,避免反复切同一个开关把历史灌满。
 */
async function snapshotConfigBeforeWrite(
  kind: ConfigKind,
  filePath: string,
  nextContent: string,
): Promise<ConfigSnapshotResult> {
  if (!existsSync(filePath)) return { taken: false };

  let oldContent: string;
  try {
    oldContent = await readFile(filePath, "utf8");
  } catch {
    return { taken: false };
  }
  if (oldContent === nextContent) return { taken: false };

  const dir = configHistoryDir(kind);
  try {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const snapshotPath = await uniqueSnapshotPath(dir, `${formatSnapshotTimestamp()}.${configFileName(kind)}`);
    await writeFileAtomic(snapshotPath, oldContent);

    const entries = await readdir(dir, { withFileTypes: true });
    const count = entries.filter((e) => e.isFile()).length;
    return {
      taken: true,
      snapshotCount: count,
      snapshotLimitExceeded: checkSnapshotSoftLimit(count).exceeded,
      snapshotLimit: SNAPSHOT_SOFT_LIMIT,
    };
  } catch {
    // 存不下历史不该拖累这次保存本身
    return { taken: false };
  }
}

/** 某份配置的历史列表,最新在前 */
export async function listConfigSnapshots(kind: ConfigKind): Promise<ConfigSnapshotItem[]> {
  const dir = configHistoryDir(kind);
  if (!existsSync(dir)) return [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const items: ConfigSnapshotItem[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = /^(\d{4}-\d{2}-\d{2}-\d{6})(?:-\d+)?\./.exec(entry.name);
      if (!match?.[1]) continue;
      const filePath = join(dir, entry.name);
      const fileStat = await stat(filePath);
      items.push({
        filename: entry.name,
        filePath,
        timestampStr: match[1],
        size: fileStat.size,
        mtime: fileStat.mtime,
      });
    }
    return items.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch {
    return [];
  }
}

export async function readConfigSnapshot(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function deleteConfigSnapshot(filePath: string): Promise<void> {
  if (existsSync(filePath)) await unlink(filePath);
}

/** 配置文件读不出来时的情况说明,交给界面告诉用户发生了什么 */
export interface ConfigLoadProblem {
  reason: ConfigFailureReason;
  /** 原文件被挪到了哪里(绝对路径),数据还在里面 */
  backupPath: string;
  /** 仅 tooNew 时有值:文件里声明的版本号 */
  fileVersion?: number;
  /** 当前扩展支持到的版本,给界面组织提示文案用 */
  currentVersion: number;
}

export interface LoadResult<T> {
  data: T;
  problem?: ConfigLoadProblem;
}

/**
 * 读不出来的配置文件挪到一边,绝不原地覆盖。
 * 这是整条链路的关键:只要原文件还在,用户就有机会自己修个逗号救回来。
 */
async function quarantineConfigFile(
  filePath: string,
  error: unknown,
  currentVersion: number,
): Promise<ConfigLoadProblem> {
  const reason: ConfigFailureReason = error instanceof ConfigFileError ? error.reason : "malformed";
  const suffix = reason === "tooNew" ? "unsupported" : "corrupted";
  const backupPath = `${filePath}.${suffix}-${fileTimestamp()}`;
  try {
    await rename(filePath, backupPath);
  } catch {
    // 连改名都失败(权限等),至少把路径报出去让用户自己看
  }
  return {
    reason,
    backupPath,
    fileVersion: error instanceof ConfigFileError ? error.fileVersion : undefined,
    currentVersion,
  };
}

export function getShellScriptPath(): string {
  return SHELL_SCRIPT_FILE;
}

export interface ShellRcInfo {
  /** 探测到的登录 shell 类型;unknown 表示既不是 zsh 也不是 bash(如 fish),无法给出确定建议 */
  shellName: "zsh" | "bash" | "unknown";
  /** 建议添加 source 行的目标文件绝对路径 */
  rcPath: string;
  /** 给用户看的短路径,如 ~/.zshrc */
  rcLabel: string;
  /** 该文件里是否已经包含 source shell.sh 的配置(不区分写的是 ~ 还是绝对路径) */
  isSourced: boolean;
}

/**
 * 探测用户的登录 shell(读系统用户记录,不依赖当前进程的 $SHELL,更可靠),
 * 给出该精确添加 source 配置到哪个文件,以及是否已经添加过。
 */
export async function detectShellRc(): Promise<ShellRcInfo> {
  const loginShell = userInfo().shell || "";
  const home = homedir();

  let shellName: ShellRcInfo["shellName"] = "unknown";
  let rcPath = join(home, ".zshrc");

  if (loginShell.includes("zsh")) {
    shellName = "zsh";
    rcPath = join(home, ".zshrc");
  } else if (loginShell.includes("bash")) {
    shellName = "bash";
    // macOS 下 Terminal.app 默认起登录 shell,bash 登录 shell 读的是 .bash_profile 而非 .bashrc
    rcPath = join(home, ".bash_profile");
  }

  let isSourced = false;
  if (existsSync(rcPath)) {
    try {
      const content = await readFile(rcPath, "utf8");
      isSourced = content.includes(".env-butler/shell.sh");
    } catch {
      isSourced = false;
    }
  }

  return {
    shellName,
    rcPath,
    rcLabel: rcPath.replace(home, "~"),
    isSourced,
  };
}

/**
 * 动用户的 shell 配置文件之前先存一份副本。
 * .zshrc 不是普通文件——它每开一个终端都会执行,写坏了的表现是"以后每次开终端都报错",
 * 而且用户很难联想到是这个扩展干的。一次 copyFile 的成本换这个保险很划算。
 * 返回备份路径(存不了就返回 undefined,不阻断主流程)。
 */
export async function backupShellRc(rcPath: string): Promise<string | undefined> {
  if (!existsSync(rcPath)) return undefined;
  try {
    await mkdir(BACKUPS_DIR, { recursive: true });
    const backupPath = join(BACKUPS_DIR, `${basename(rcPath)}-${fileTimestamp()}`);
    await copyFile(rcPath, backupPath);
    return backupPath;
  } catch {
    return undefined;
  }
}

/**
 * 把 source 那一行追加到用户的 shell 配置文件末尾(仅追加,不改动已有任何内容)
 * 用一段带标记的注释包住,方便用户日后自己识别/手动删除
 */
export async function appendShellSourceLine(rcPath: string, sourceLine: string): Promise<{ backupPath?: string }> {
  const block = `# Added by Env Butler\n${sourceLine}\n`;
  const backupPath = await backupShellRc(rcPath);

  if (!existsSync(rcPath)) {
    const dir = dirname(rcPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFileAtomic(rcPath, block);
    return { backupPath };
  }

  const content = await readFile(rcPath, "utf8");
  const separator = content === "" || content.endsWith("\n") ? "\n" : "\n\n";
  await writeFileAtomic(rcPath, content + separator + block);
  return { backupPath };
}

/**
 * 从 shell 配置文件里移除 source shell.sh 那一行(与 appendShellSourceLine 对称)。
 * 匹配"含 .env-butler/shell.sh 的行",不管当初是自动写入还是用户手动加的都能识别;
 * 顺手删掉紧邻在它前面的 "# Added by Env Butler" 标记注释,并收敛删除后留下的多余空行。
 */
export async function removeShellSourceLine(rcPath: string): Promise<{ removed: boolean; backupPath?: string }> {
  if (!existsSync(rcPath)) return { removed: false };

  const content = await readFile(rcPath, "utf8");
  const rawLines = content.split("\n");
  const kept: string[] = [];
  let removed = false;

  for (const line of rawLines) {
    if (line.includes(".env-butler/shell.sh")) {
      removed = true;
      if (kept[kept.length - 1]?.trim() === "# Added by Env Butler") {
        kept.pop();
      }
      continue;
    }
    kept.push(line);
  }

  if (!removed) return { removed: false };

  // 收敛连续空行(压缩成最多 1 行),文件末尾不留多余空行
  const collapsed: string[] = [];
  for (const line of kept) {
    if (line.trim() === "" && collapsed[collapsed.length - 1]?.trim() === "") continue;
    collapsed.push(line);
  }
  while (collapsed.length > 0 && collapsed[collapsed.length - 1]?.trim() === "") {
    collapsed.pop();
  }

  const backupPath = await backupShellRc(rcPath);
  await writeFileAtomic(rcPath, collapsed.length > 0 ? collapsed.join("\n") + "\n" : "");
  return { removed: true, backupPath };
}

/**
 * 确保 ~/.env-butler 及其子目录存在
 */
export async function ensureStorageDirs(): Promise<void> {
  if (!existsSync(BASE_DIR)) {
    await mkdir(BASE_DIR, { recursive: true });
  }
  if (!existsSync(SNAPSHOTS_DIR)) {
    await mkdir(SNAPSHOTS_DIR, { recursive: true });
  }
}

/**
 * 读取项目注册表
 */
export async function loadRegistry(): Promise<LoadResult<RegistryData>> {
  await ensureStorageDirs();
  if (!existsSync(REGISTRY_FILE)) {
    const empty = createEmptyRegistry();
    await writeFileAtomic(REGISTRY_FILE, formatRegistry(empty));
    return { data: empty };
  }

  let content: string;
  try {
    content = await readFile(REGISTRY_FILE, "utf8");
  } catch {
    // 读不到文件(权限等)不等于文件坏了,不隔离,直接当空处理
    return { data: createEmptyRegistry() };
  }

  try {
    return { data: parseRegistry(content) };
  } catch (e) {
    // 内容有问题:把原文件挪到一边保住数据,再把情况报给界面
    return {
      data: createEmptyRegistry(),
      problem: await quarantineConfigFile(REGISTRY_FILE, e, CURRENT_REGISTRY_VERSION),
    };
  }
}

/**
 * 保存项目注册表
 */
export async function saveRegistry(registry: RegistryData): Promise<ConfigSnapshotResult> {
  await ensureStorageDirs();
  const next = formatRegistry(registry);
  const snapshot = await snapshotConfigBeforeWrite("registry", REGISTRY_FILE, next);
  await writeFileAtomic(REGISTRY_FILE, next);
  return snapshot;
}

/**
 * 读取全局 Shell 配置
 */
export async function loadShellConfig(): Promise<LoadResult<ShellConfig>> {
  await ensureStorageDirs();
  if (!existsSync(SHELL_CONFIG_FILE)) {
    const empty = createEmptyShellConfig();
    await writeFileAtomic(SHELL_CONFIG_FILE, formatShellConfig(empty));
    return { data: empty };
  }

  let content: string;
  try {
    content = await readFile(SHELL_CONFIG_FILE, "utf8");
  } catch {
    return { data: createEmptyShellConfig() };
  }

  try {
    return { data: parseShellConfig(content) };
  } catch (e) {
    return {
      data: createEmptyShellConfig(),
      problem: await quarantineConfigFile(SHELL_CONFIG_FILE, e, CURRENT_SHELL_CONFIG_VERSION),
    };
  }
}

/**
 * 保存 Shell 配置并同步生成 ~/.env-butler/shell.sh (设置可执行权限)
 */
export async function saveShellConfig(config: ShellConfig): Promise<ConfigSnapshotResult> {
  await ensureStorageDirs();
  const next = formatShellConfig(config);
  const snapshot = await snapshotConfigBeforeWrite("shell", SHELL_CONFIG_FILE, next);
  await writeFileAtomic(SHELL_CONFIG_FILE, next);
  const scriptContent = generateShellScript(config.snippets);
  // shell.sh 必须显式带上可执行位:走临时文件 + rename 的话权限跟的是临时文件,
  // 不显式指定就会丢掉 0o755
  await writeFileAtomic(SHELL_SCRIPT_FILE, scriptContent, 0o755);
  return snapshot;
}

/**
 * 读取已生成的 ~/.env-butler/shell.sh 原文,用于给用户预览"实际生成了什么、按什么顺序"。
 * 界面上片段是按类型分组显示的,和文件里的真实先后并不一致,所以需要这个出口。
 */
export async function readShellScript(): Promise<string> {
  if (!existsSync(SHELL_SCRIPT_FILE)) return "";
  try {
    return await readFile(SHELL_SCRIPT_FILE, "utf8");
  } catch {
    return "";
  }
}

/**
 * 扫描项目根目录下的所有 .env* 文件
 */
export async function detectProjectEnvFiles(projectPath: string): Promise<string[]> {
  if (!existsSync(projectPath)) return [];
  try {
    const entries = await readdir(projectPath, { withFileTypes: true });
    const envFiles = entries
      .filter((e) => e.isFile() && e.name.startsWith(".env") && e.name !== ".env.example")
      .map((e) => e.name);

    if (!envFiles.includes(".env")) {
      envFiles.unshift(".env");
    }
    return envFiles;
  } catch {
    return [".env"];
  }
}

/**
 * 在项目目录下新建一个空的环境文件（如 .env.development）
 * 若文件已存在则不覆盖，返回 created: false
 */
export async function createEnvFile(projectPath: string, filename: string): Promise<{ created: boolean }> {
  const filePath = join(projectPath, filename);
  if (existsSync(filePath)) {
    return { created: false };
  }
  if (!existsSync(projectPath)) {
    await mkdir(projectPath, { recursive: true });
  }
  await writeFileAtomic(filePath, "");
  return { created: true };
}

/**
 * 检查项目目录下是否存在 .envrc (direnv)
 */
export async function checkEnvrcExists(projectPath: string): Promise<boolean> {
  return existsSync(join(projectPath, ".envrc"));
}

/**
 * 读取特定环境文件内容及指纹
 */
export async function readEnvFile(
  filePath: string,
): Promise<{ content: string; fingerprint: string; exists: boolean }> {
  if (!existsSync(filePath)) {
    return { content: "", fingerprint: computeFingerprint(""), exists: false };
  }
  const content = await readFile(filePath, "utf8");
  return {
    content,
    fingerprint: computeFingerprint(content),
    exists: true,
  };
}

export interface WriteEnvResult {
  success: boolean;
  conflict?: boolean;
  snapshotPath?: string;
  /** 本次写入后,该项目累计的快照份数(原文件不存在、没打快照时为 undefined) */
  snapshotCount?: number;
  /** 快照份数是否已达软上限。达到后只提示,绝不自动清理(设计决议 Q12) */
  snapshotLimitExceeded?: boolean;
  /** 软上限值,交给界面组织提示文案,避免界面层再 import core 常量 */
  snapshotLimit?: number;
  newFingerprint?: string;
  error?: string;
}

/**
 * 写入环境文件（包含冲突检测 + 自动快照备份）
 */
export async function writeEnvFileWithSnapshot(options: {
  projectName: string;
  envFilePath: string;
  newContent: string;
  expectedFingerprint?: string;
  force?: boolean;
}): Promise<WriteEnvResult> {
  const { projectName, envFilePath, newContent, expectedFingerprint, force = false } = options;

  await ensureStorageDirs();

  // 1. 冲突检测：检查现有文件是否被外部修改
  if (existsSync(envFilePath) && expectedFingerprint && !force) {
    const currentContent = await readFile(envFilePath, "utf8");
    const currentFingerprint = computeFingerprint(currentContent);
    if (currentFingerprint !== expectedFingerprint) {
      return { success: false, conflict: true };
    }
  }

  // 2. 自动生成快照备份（若原文件存在）
  let snapshotPath: string | undefined;
  let snapshotCount: number | undefined;
  let snapshotLimitExceeded = false;
  if (existsSync(envFilePath)) {
    const oldContent = await readFile(envFilePath, "utf8");
    const safeProjectName = projectName.replace(/[/\\?%*:|"<>]/g, "_");
    const projectSnapshotDir = join(SNAPSHOTS_DIR, safeProjectName);
    if (!existsSync(projectSnapshotDir)) {
      await mkdir(projectSnapshotDir, { recursive: true });
    }

    const snapshotFilename = generateSnapshotFilename(basename(envFilePath));
    snapshotPath = await uniqueSnapshotPath(projectSnapshotDir, snapshotFilename);
    await writeFileAtomic(snapshotPath, oldContent);

    // 打完快照后数一下这个项目累计了多少份。超过软上限只是提示用户按需清理,
    // 不自动删除——快照是安全网,自动清理与这个定位相冲突(设计决议 Q12)
    try {
      const entries = await readdir(projectSnapshotDir, { withFileTypes: true });
      snapshotCount = entries.filter((e) => e.isFile() && parseSnapshotFilename(e.name) !== null).length;
      snapshotLimitExceeded = checkSnapshotSoftLimit(snapshotCount).exceeded;
    } catch {
      // 数不出来不影响本次写入,静默跳过提示
    }
  }

  // 3. 写入新文件内容
  const dir = dirname(envFilePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFileAtomic(envFilePath, newContent);
  const newFingerprint = computeFingerprint(newContent);

  return {
    success: true,
    snapshotPath,
    snapshotCount,
    snapshotLimitExceeded,
    snapshotLimit: SNAPSHOT_SOFT_LIMIT,
    newFingerprint,
  };
}

export interface SnapshotItem {
  filename: string;
  filePath: string;
  timestampStr: string;
  envFilename: string;
  size: number;
  mtime: Date;
}

/**
 * 获取指定项目的所有快照
 */
export async function listSnapshots(projectName: string, targetEnvFilename?: string): Promise<SnapshotItem[]> {
  const safeProjectName = projectName.replace(/[/\\?%*:|"<>]/g, "_");
  const projectSnapshotDir = join(SNAPSHOTS_DIR, safeProjectName);
  if (!existsSync(projectSnapshotDir)) return [];

  try {
    const entries = await readdir(projectSnapshotDir, { withFileTypes: true });
    const items: SnapshotItem[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const parsed = parseSnapshotFilename(entry.name);
      if (!parsed) continue;

      if (targetEnvFilename && parsed.envFilename !== targetEnvFilename) {
        continue;
      }

      const filePath = join(projectSnapshotDir, entry.name);
      const fileStat = await stat(filePath);
      items.push({
        filename: entry.name,
        filePath,
        timestampStr: parsed.timestampStr,
        envFilename: parsed.envFilename,
        size: fileStat.size,
        mtime: fileStat.mtime,
      });
    }

    // 按最新时间倒序排列
    return items.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch {
    return [];
  }
}

/**
 * 从指定快照回滚到目标环境文件（回滚前自动给当前文件打一份安全快照）
 */
export async function restoreSnapshot(options: {
  projectName: string;
  snapshotFilePath: string;
  targetEnvFilePath: string;
}): Promise<WriteEnvResult> {
  const { projectName, snapshotFilePath, targetEnvFilePath } = options;
  if (!existsSync(snapshotFilePath)) {
    return { success: false, error: "快照文件不存在" };
  }
  const snapshotContent = await readFile(snapshotFilePath, "utf8");
  return writeEnvFileWithSnapshot({
    projectName,
    envFilePath: targetEnvFilePath,
    newContent: snapshotContent,
    force: true, // 回滚为明确用户操作，强制覆盖
  });
}

/**
 * 删除单个快照
 */
export async function deleteSnapshot(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}
