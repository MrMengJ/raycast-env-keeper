import { Action, ActionPanel, Alert, confirmAlert, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { t } from "../i18n.js";
import { deleteSnapshot, type SnapshotItem } from "../services/storage.js";

const KEEP_OPTIONS = [50, 20, 10, 5, 0];

/**
 * 批量清理快照。
 *
 * 有了 500 份软上限提示却只能一份份删,等于把问题丢回给用户;
 * 但快照是安全网,所以这里绝不自动清理——只在用户明确来清理时才动手,
 * 而且要先把"会删掉几份"摆在眼前。
 */
export function SnapshotCleanupForm({
  envFilename,
  snapshots,
  onCleaned,
}: {
  envFilename: string;
  /** 已按时间倒序排好(最新在前) */
  snapshots: SnapshotItem[];
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
      title: t("sh.cleanupConfirmTitle", { count: toDelete.length }),
      message: t("sh.cleanupConfirmMessage", { kept: snapshots.length - toDelete.length }),
      primaryAction: { title: t("common.delete"), style: Alert.ActionStyle.Destructive },
      dismissAction: { title: t("common.cancel") },
    });
    if (!confirmed) return;

    setBusy(true);
    for (const item of toDelete) {
      await deleteSnapshot(item.filePath);
    }
    setBusy(false);
    await showToast({ style: Toast.Style.Success, title: t("sh.cleanupDoneToast", { count: toDelete.length }) });
    onCleaned();
    pop();
  };

  return (
    <Form
      isLoading={busy}
      navigationTitle={t("sh.cleanupNavTitle")}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={t("sh.cleanupSubmit")} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text={t("sh.cleanupDescription", { file: envFilename })} />
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
