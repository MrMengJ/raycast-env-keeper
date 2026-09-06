import { Action, ActionPanel, Alert, confirmAlert, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { t } from "../i18n.js";

const KEEP_OPTIONS = [50, 20, 10, 5, 0];

/**
 * 批量清理历史记录。项目轨的 .env 快照和 Shell 配置历史共用这一个表单——
 * 两边都是"按时间排好的一串文件",没有理由做成两套。
 *
 * 有了 500 份软上限提示却只能一份份删,等于把问题丢回给用户;
 * 但历史记录是安全网,所以这里绝不自动清理——只在用户明确来清理时才动手,
 * 而且要先把"会删掉几份"摆在眼前。
 */
export function SnapshotCleanupForm({
  navTitle,
  unit,
  description,
  snapshots,
  onDelete,
  onCleaned,
}: {
  navTitle: string;
  /** 这一串东西叫什么(快照 / 历史记录),用在确认框和提示里 */
  unit: string;
  /** 说明这次清理会影响什么范围 */
  description: string;
  /** 已按时间倒序排好(最新在前) */
  snapshots: { filePath: string }[];
  onDelete: (filePath: string) => Promise<void>;
  onCleaned: () => void;
}) {
  const { pop } = useNavigation();
  const [keep, setKeep] = useState<string>("20");
  const [busy, setBusy] = useState(false);

  const keepCount = Number(keep);
  const toDelete = snapshots.slice(keepCount);

  const handleSubmit = async () => {
    if (toDelete.length === 0) return;

    const confirmed = await confirmAlert({
      title: t("sh.cleanupConfirmTitle", { count: toDelete.length, unit }),
      message: t("sh.cleanupConfirmMessage", { kept: snapshots.length - toDelete.length }),
      primaryAction: { title: t("common.delete"), style: Alert.ActionStyle.Destructive },
      dismissAction: { title: t("common.cancel") },
    });
    if (!confirmed) return;

    setBusy(true);
    for (const item of toDelete) {
      await onDelete(item.filePath);
    }
    setBusy(false);
    await showToast({ style: Toast.Style.Success, title: t("sh.cleanupDoneToast", { count: toDelete.length, unit }) });
    onCleaned();
    pop();
  };

  return (
    <Form
      isLoading={busy}
      navigationTitle={navTitle}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={t("sh.cleanupSubmit")} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text={description} />
      <Form.Dropdown
        id="keep"
        title={t("sh.cleanupKeepTitle")}
        value={keep}
        onChange={setKeep}
        placeholder={t("sh.cleanupKeepPlaceholder")}
      >
        {KEEP_OPTIONS.map((n) => (
          <Form.Dropdown.Item
            key={n}
            value={String(n)}
            title={n === 0 ? t("sh.cleanupKeepNone") : t("sh.cleanupKeepOption", { count: n })}
          />
        ))}
      </Form.Dropdown>
      <Form.Description
        text={
          toDelete.length === 0
            ? t("sh.cleanupNothing", { total: snapshots.length })
            : t("sh.cleanupPreview", { total: snapshots.length, count: toDelete.length })
        }
      />
    </Form>
  );
}
