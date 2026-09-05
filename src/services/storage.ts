import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
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
} from "@env-butler/core";

const BASE_DIR = join(homedir(), ".env-butler");
const REGISTRY_FILE = join(BASE_DIR, "registry.json");
const SHELL_CONFIG_FILE = join(BASE_DIR, "shell.json");
const SHELL_SCRIPT_FILE = join(BASE_DIR, "shell.sh");
const SNAPSHOTS_DIR = join(BASE_DIR, "snapshots");

export function getBaseDir(): string {
  return BASE_DIR;
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
 * 把 source 那一行追加到用户的 shell 配置文件末尾(仅追加,不改动已有任何内容)
 * 用一段带标记的注释包住,方便用户日后自己识别/手动删除
 */
export async function appendShellSourceLine(rcPath: string, sourceLine: string): Promise<void> {
  const block = `# Added by Env Butler\n${sourceLine}\n`;

  if (!existsSync(rcPath)) {
    const dir = dirname(rcPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(rcPath, block, "utf8");
    return;
  }

  const content = await readFile(rcPath, "utf8");
  const separator = content === "" || content.endsWith("\n") ? "\n" : "\n\n";
  await writeFile(rcPath, content + separator + block, "utf8");
}

/**
 * 从 shell 配置文件里移除 source shell.sh 那一行(与 appendShellSourceLine 对称)。
 * 匹配"含 .env-butler/shell.sh 的行",不管当初是自动写入还是用户手动加的都能识别;
 * 顺手删掉紧邻在它前面的 "# Added by Env Butler" 标记注释,并收敛删除后留下的多余空行。
 */
export async function removeShellSourceLine(rcPath: string): Promise<{ removed: boolean }> {
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

  await writeFile(rcPath, collapsed.length > 0 ? collapsed.join("\n") + "\n" : "", "utf8");
  return { removed: true };
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
export async function loadRegistry(): Promise<RegistryData> {
  await ensureStorageDirs();
  if (!existsSync(REGISTRY_FILE)) {
    const empty = createEmptyRegistry();
    await writeFile(REGISTRY_FILE, formatRegistry(empty), "utf8");
    return empty;
  }
  try {
    const content = await readFile(REGISTRY_FILE, "utf8");
    return parseRegistry(content);
  } catch {
    return createEmptyRegistry();
  }
}

/**
 * 保存项目注册表
 */
export async function saveRegistry(registry: RegistryData): Promise<void> {
  await ensureStorageDirs();
  await writeFile(REGISTRY_FILE, formatRegistry(registry), "utf8");
}

/**
 * 读取全局 Shell 配置
 */
export async function loadShellConfig(): Promise<ShellConfig> {
  await ensureStorageDirs();
  if (!existsSync(SHELL_CONFIG_FILE)) {
    const empty = createEmptyShellConfig();
    await writeFile(SHELL_CONFIG_FILE, formatShellConfig(empty), "utf8");
    return empty;
  }
  try {
    const content = await readFile(SHELL_CONFIG_FILE, "utf8");
    return parseShellConfig(content);
  } catch {
    return createEmptyShellConfig();
  }
}

/**
 * 保存 Shell 配置并同步生成 ~/.env-butler/shell.sh (设置可执行权限)
 */
export async function saveShellConfig(config: ShellConfig): Promise<void> {
  await ensureStorageDirs();
  await writeFile(SHELL_CONFIG_FILE, formatShellConfig(config), "utf8");
  const scriptContent = generateShellScript(config.snippets);
  await writeFile(SHELL_SCRIPT_FILE, scriptContent, { encoding: "utf8", mode: 0o755 });
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
  await writeFile(filePath, "", "utf8");
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
  if (existsSync(envFilePath)) {
    const oldContent = await readFile(envFilePath, "utf8");
    const safeProjectName = projectName.replace(/[/\\?%*:|"<>]/g, "_");
    const projectSnapshotDir = join(SNAPSHOTS_DIR, safeProjectName);
    if (!existsSync(projectSnapshotDir)) {
      await mkdir(projectSnapshotDir, { recursive: true });
    }

    const snapshotFilename = generateSnapshotFilename(basename(envFilePath));
    snapshotPath = join(projectSnapshotDir, snapshotFilename);
    await writeFile(snapshotPath, oldContent, "utf8");
  }

  // 3. 写入新文件内容
  const dir = dirname(envFilePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(envFilePath, newContent, "utf8");
  const newFingerprint = computeFingerprint(newContent);

  return {
    success: true,
    snapshotPath,
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
