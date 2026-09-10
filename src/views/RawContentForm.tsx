import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { t } from "../i18n.js";

interface RawContentFormProps {
  navTitle: string;
  initialContent: string;
  /** 编辑框下面的一句说明 */
  hint: string;
  submitTitle?: string;
  onSave: (content: string) => Promise<void>;
}

/**
 * 一整份文本直接改。给两处用:方案的内容、环境文件的原文。
 * 都是**明文**——可编辑的文本框没法打码,用户点进来就是明确要看的;
 * 所以这个表单不主动出现,只挂在"编辑内容/编辑整个文件"这种意图明确的动作后面
 */
export function RawContentForm({ navTitle, initialContent, hint, submitTitle, onSave }: RawContentFormProps) {
  const { pop } = useNavigation();
  const [content, setContent] = useState(initialContent);

  const handleSubmit = async () => {
    try {
      await onSave(content);
      pop();
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: t("common.saveFailedTitle"),
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <Form
      navigationTitle={navTitle}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={submitTitle ?? t("common.save")} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea id="content" title={t("raw.contentTitle")} value={content} onChange={setContent} />
      <Form.Description text={hint} />
    </Form>
  );
}
