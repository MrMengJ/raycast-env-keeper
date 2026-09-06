import { exec } from "node:child_process";

/** 只支持能做 `<shell> -n` 语法检查的两种 shell;探测不出具体是哪种(如 fish)时不做校验 */
export type ValidatableShell = "zsh" | "bash";

/**
 * 用真实探测到的 shell 类型做语法校验(`zsh -n` 或 `bash -n`)。
 * 传 undefined(探测不出具体 shell,如 fish)时直接跳过校验、不阻断保存——
 * 校验用的是用户实际的登录 shell,而不是写死 zsh:zsh/bash 语法并不完全通用
 * (例如 zsh 的 `repeat n do ... done` 循环,bash -n 会直接语法报错)。
 */
export async function validateShellSyntax(
  scriptContent: string,
  shellKind: ValidatableShell | undefined,
): Promise<{ valid: boolean; error?: string }> {
  if (!scriptContent || scriptContent.trim() === "") {
    return { valid: true };
  }
  if (!shellKind) {
    return { valid: true };
  }

  try {
    // 通过 stdin 将内容喂给 `<shell> -n`;shellKind 只可能是 "zsh"/"bash" 字面量,非用户输入,拼接安全
    const child = exec(`${shellKind} -n`);
    // 存成局部常量:直接用 child.stdin 的话,类型收窄进不了下面的 Promise 闭包
    const stdin = child.stdin;
    if (!stdin) {
      return { valid: true };
    }

    return await new Promise<{ valid: boolean; error?: string }>((resolve) => {
      let stderr = "";
      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ valid: true });
        } else {
          resolve({ valid: false, error: stderr.trim() || `${shellKind} syntax error (exit code ${code})` });
        }
      });

      child.on("error", (err) => {
        // 如果系统没有该 shell 或执行异常,不阻断保存
        resolve({ valid: true, error: err.message });
      });

      stdin.write(scriptContent);
      stdin.end();
    });
  } catch {
    return { valid: true };
  }
}
