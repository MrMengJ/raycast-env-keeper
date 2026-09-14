/**
 * 测试用的 @raycast/api 桩。真实模块在 Raycast 进程外导入会炸。
 *
 * - getPreferenceValues:i18n 读偏好决定界面语言,返回空对象即按英文走,和真实环境里没设偏好时一致
 * - trash:storage 删快照/历史/备份时把文件移进废纸篓;测试里没有废纸篓,直接删掉,行为等价
 */
import { rm } from "node:fs/promises";

export function getPreferenceValues<T = Record<string, unknown>>(): T {
  return {} as T;
}

export async function trash(path: string | string[]): Promise<void> {
  for (const p of Array.isArray(path) ? path : [path]) await rm(p, { force: true });
}
