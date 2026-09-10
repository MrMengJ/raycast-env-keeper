import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import type { Preset } from "@env-butler/core";
import { t } from "../i18n.js";
import { formatEnvContentMasked } from "./diffFormat.js";

export interface PresetMetaData {
  name: string;
  note?: string;
  group?: string;
  /** 只在 editableContent 模式下有值 */
  content?: string;
}

interface PresetMetaFormProps {
  /** 有值 = 编辑已有方案的名字/备注/分组;没有 = 新建 */
  initialData?: Pick<Preset, "name" | "note" | "group">;
  /** 本项目已经用过的分组名,列在下拉框里供选 */
  existingGroups: string[];
  /**
   * 新建时提供:要存进去的内容,只读预览且打码。
   * 这一步不给改——改内容的入口在「管理方案」里,那里用户是明确要看明文的
   */
  contentPreview?: { content: string; sourceFile: string; customSecrets?: string[] };
  /**
   * 新建**空白**方案时提供:直接给一个明文编辑框从零写。
   * 跟 contentPreview 互斥——预览打码是因为那里装的是现有密钥,空白新建没这个顾虑
   */
  editableContent?: boolean;
  /** 表单标题;不传就按"新建/编辑"取默认 */
  navTitle?: string;
  onSave: (data: PresetMetaData) => Promise<void>;
}

/**
 * 分组的填写方式(设计决议 §十一.6):Raycast 表单没有"既能选又能打字"的控件,
 * 所以拆成两个——下拉框列出已有分组,文本框用来新建;文本框填了就以它为准。
 * 这样填的时候看得到现在有哪些分组,不会瞎打字造出一堆同义的组
 */
export function PresetMetaForm({
  initialData,
  existingGroups,
  contentPreview,
  editableContent,
  navTitle,
  onSave,
}: PresetMetaFormProps) {
  const { pop } = useNavigation();
  const [name, setName] = useState(initialData?.name ?? "");
  const [note, setNote] = useState(initialData?.note ?? "");
  const [content, setContent] = useState("");
  // 已有分组不在列表里(比如刚被别的方案改没了)时,当成"新建"填进文本框,别悄悄丢掉
  const initialGroup = initialData?.group ?? "";
  const initialInList = initialGroup !== "" && existingGroups.includes(initialGroup);
  const [selectedGroup, setSelectedGroup] = useState(initialInList ? initialGroup : "");
  const [newGroup, setNewGroup] = useState(initialInList ? "" : initialGroup);
  const [nameError, setNameError] = useState<string | undefined>();

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t("ps.nameEmptyError"));
      return;
    }
    const group = newGroup.trim() || selectedGroup || undefined;
    try {
      await onSave({
        name: trimmedName,
        note: note.trim() || undefined,
        group,
        ...(editableContent ? { content } : {}),
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

  const previewText = contentPreview
    ? formatEnvContentMasked(contentPreview.content, contentPreview.customSecrets)
    : undefined;

  return (
    <Form
      navigationTitle={navTitle ?? (initialData ? t("ps.formNavEdit") : t("ps.formNavCreate"))}
      actions={
        <ActionPanel>
          <Action.SubmitForm title={initialData ? t("ps.submitEdit") : t("ps.submitCreate")} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title={t("ps.nameTitle")}
        placeholder={t("ps.namePlaceholder")}
        value={name}
        onChange={(v) => {
          setName(v);
          setNameError(undefined);
        }}
        error={nameError}
      />
      <Form.TextField
        id="note"
        title={t("ps.noteTitle")}
        placeholder={t("ps.notePlaceholder")}
        value={note}
        onChange={setNote}
      />
      {/* 下拉框选了就清不掉,所以必须有一项代表"不分组";一个分组都还没有时整个下拉框都不出现 */}
      {existingGroups.length > 0 && (
        <Form.Dropdown
          id="existingGroup"
          title={t("ps.groupExistingTitle")}
          value={selectedGroup}
          onChange={setSelectedGroup}
          placeholder={t("common.searchPlaceholder")}
        >
          <Form.Dropdown.Item value="" title={t("ps.groupNone")} />
          {existingGroups.map((g) => (
            <Form.Dropdown.Item key={g} value={g} title={g} />
          ))}
        </Form.Dropdown>
      )}
      <Form.TextField
        id="newGroup"
        title={t("ps.groupNewTitle")}
        placeholder={t("ps.groupNewPlaceholder")}
        value={newGroup}
        onChange={setNewGroup}
      />
      {editableContent && (
        <>
          <Form.Separator />
          <Form.TextArea
            id="content"
            title={t("ps.contentTitle")}
            placeholder={t("ps.blankContentPlaceholder")}
            value={content}
            onChange={setContent}
          />
          <Form.Description text={t("ps.contentHint")} />
        </>
      )}
      {contentPreview && (
        <>
          <Form.Separator />
          <Form.Description
            title={t("ps.contentPreviewTitle")}
            text={previewText?.trim() ? previewText : t("ps.contentPreviewEmpty")}
          />
          <Form.Description text={t("ps.contentPreviewHint", { file: contentPreview.sourceFile })} />
        </>
      )}
    </Form>
  );
}
