import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { basename } from "node:path";
import { t } from "../i18n.js";
import type { ConfigLoadProblem } from "../services/storage.js";

/**
 * 配置文件读不出来时,列表顶部的提示条。
 *
 * 必须说清三件事:出了什么问题、原数据还在不在、怎么救回来。
 * 静默显示一个空列表是最坏的做法——用户会以为"我从没配过",
 * 然后重新添加、保存,把还留着原始数据的坏文件覆盖掉。
 */
export function ConfigProblemItem({ problem }: { problem: ConfigLoadProblem }) {
  const name = basename(problem.backupPath);
  const isTooNew = problem.reason === "tooNew";
  const isUnreadable = problem.reason === "unreadable";

  // 三种情况要说清:读不出来(文件还在原位、检查权限)/ 坏了但已挪开(去修)/ 坏了且没挪开(修好前不会写入)
  const title = isUnreadable ? t("cfg.unreadableTitle") : isTooNew ? t("cfg.tooNewTitle") : t("cfg.corruptedTitle");
  const subtitle = isUnreadable
    ? t("cfg.unreadableSubtitle", { name })
    : !problem.quarantined
      ? t("cfg.notQuarantinedSubtitle", { name })
      : isTooNew
        ? t("cfg.tooNewSubtitle", {
            version: problem.fileVersion ?? "?",
            current: problem.currentVersion,
            name,
          })
        : t("cfg.corruptedSubtitle", { name });

  return (
    <List.Item
      icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
      title={title}
      subtitle={subtitle}
      actions={
        <ActionPanel>
          <Action.ShowInFinder title={t("cfg.showBackup")} path={problem.backupPath} />
        </ActionPanel>
      }
    />
  );
}
