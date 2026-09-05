import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { matchesDeclaredType, type ShellSnippet, type ShellSnippetType } from "@env-butler/core";
import { t } from "../i18n.js";
import { validateShellSyntax, type ValidatableShell } from "../services/shellValidator.js";

interface EditShellSnippetFormProps {
  initialData?: ShellSnippet;
  /** 探测到的用户真实登录 shell,用来决定拿 zsh -n 还是 bash -n 校验;识别不出来(如 fish)传 undefined,直接跳过语法校验 */
  shellKind: ValidatableShell | undefined;
  onSave: (data: Omit<ShellSnippet, "id">) => Promise<void>;
}

export function EditShellSnippetForm({ initialData, shellKind, onSave }: EditShellSnippetFormProps) {
  const { pop } = useNavigation();

  const [name, setName] = useState(initialData?.name ?? "");
  const [type, setType] = useState<ShellSnippetType>(initialData?.type ?? "export");
  const [content, setContent] = useState(initialData?.content ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [nameError, setNameError] = useState<string | undefined>();
  const [contentError, setContentError] = useState<string | undefined>();

  const handleTypeChange = (newType: string) => {
    const nextType = newType as ShellSnippetType;
    setType(nextType);
    // 自动给出模板提示
    if (!content) {
      if (nextType === "export") setContent('export MY_VAR="value"');
      else if (nextType === "alias") setContent('alias my_cmd="command"');
    }
  };

  // 内容跟声明的类型对不上时,给一个不阻止保存的温和提示(export/alias 才检查,snippet 类型不限制)
  const typeMismatch = content.trim() !== "" && !matchesDeclaredType(type, content);
  const typeMismatchHint = type === "export" ? t("es.exportMismatchHint") : t("es.aliasMismatchHint");

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t("es.nameEmptyError"));
      return;
    }
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setContentError(t("es.contentEmptyError"));
      return;
    }

    // 用探测到的真实 shell 类型做语法校验(zsh -n / bash -n);识别不出来则跳过,不阻断保存
    const validation = await validateShellSyntax(trimmedContent, shellKind);
    if (!validation.valid) {
      await showToast({
        style: Toast.Style.Failure,
        title: t("es.syntaxFailedTitle", { shell: shellKind ?? "shell" }),
        message: validation.error,
      });
      setContentError(validation.error);
      return;
    }

    try {
      await onSave({
        name: trimmedName,
        type,
        content: trimmedContent,
        description: description.trim() || undefined,
        enabled,
      });
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
      actions={
        <ActionPanel>
          <Action.SubmitForm title={t("es.submitTitle")} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title={t("es.nameTitle")}
        placeholder={t("es.namePlaceholder")}
        value={name}
        onChange={(val) => {
          setName(val);
          setNameError(undefined);
        }}
        error={nameError}
      />
      <Form.Dropdown
        id="type"
        title={t("es.typeTitle")}
        value={type}
        onChange={handleTypeChange}
        placeholder={t("common.searchPlaceholder")}
      >
        <Form.Dropdown.Item value="export" title={t("es.typeExport")} />
        <Form.Dropdown.Item value="alias" title={t("es.typeAlias")} />
        <Form.Dropdown.Item value="snippet" title={t("es.typeSnippet")} />
      </Form.Dropdown>
      <Form.TextArea
        id="content"
        title={t("es.contentTitle")}
        placeholder='export JAVA_HOME="/Library/Java/Home"'
        value={content}
        onChange={(val) => {
          setContent(val);
          setContentError(undefined);
        }}
        error={contentError}
      />
      {typeMismatch && <Form.Description text={typeMismatchHint} />}
      <Form.TextField
        id="description"
        title={t("es.descTitle")}
        placeholder={t("es.descPlaceholder")}
        value={description}
        onChange={setDescription}
      />
      <Form.Checkbox id="enabled" label={t("es.enabledLabel")} value={enabled} onChange={setEnabled} />
    </Form>
  );
}
