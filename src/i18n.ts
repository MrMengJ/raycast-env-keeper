import { getPreferenceValues } from "@raycast/api";

/**
 * 极简 i18n(国际化,让界面按用户选择的语言显示不同文案)方案。
 * 不依赖第三方库:一份 key -> 文案 的字典 + 一个 t() 取词函数,
 * 用户在扩展偏好设置里选语言(package.json 的 preferences.language),
 * t() 读取该偏好决定用哪份字典,{name} 形式的占位符用 vars 参数替换。
 */

export type Lang = "zh" | "en";

const zh = {
  // ---- 通用 ----
  "common.save": "保存",
  "common.cancel": "取消",
  "common.delete": "删除",
  "common.confirm": "确认",
  "common.saveFailedTitle": "保存失败",
  "common.searchPlaceholder": "搜索...",
  "common.showDataDir": "在访达中显示数据目录（换机拷这个目录即可）",
  "common.snapshotLimitMessage": "已存了 {count} 份快照（建议不超过 {limit} 份），可以在快照历史里清理一些旧的",

  // ---- 配置文件异常提示 ----
  "cfg.sectionTitle": "需要你处理",
  "cfg.corruptedTitle": "配置文件读不出来，已保住原文件",
  "cfg.corruptedSubtitle": "原文件已改名为 {name}，里面的内容还在。把格式修好后改回原名就能恢复",
  "cfg.tooNewTitle": "配置文件来自更新版本的 Env Butler",
  "cfg.tooNewSubtitle":
    "文件版本 {version}，当前扩展只认到 {current}。原文件已改名为 {name}，升级扩展后改回原名即可恢复",
  "cfg.showBackup": "在访达中显示原文件",

  // ---- manage-envs 主命令 ----
  "mv.searchPlaceholderProjects": "搜索已登记的项目...",
  "mv.trackTooltip": "切换轨道",
  "mv.trackProjects": "项目轨 (Project Envs)",
  "mv.trackShell": "Shell 轨 (Global Shell / Alias)",
  "mv.sectionTitle": "已登记项目",
  "mv.sectionSubtitle": "{count} 个项目",
  "mv.envCountAccessory": "{count} 个环境文件",
  "mv.lastOpenedAccessory": "访问于 {date}",
  "mv.actionManage": "管理环境变量",
  "mv.actionAddProject": "登记新项目",
  "mv.actionOpenWith": "用其他应用打开",
  "mv.actionRemove": "不再管理此项目",
  "mv.missingTag": "路径不存在",
  "mv.missingTooltip": "这个目录已经不在了，可能被改名或搬走了",
  "mv.actionRelocate": "重新指向新目录",
  "mv.relocateNavTitle": "重新指向新目录",
  "mv.relocateDescription": "为「{name}」选择新的项目目录。之前标过的敏感字段、关掉的提示都会保留。",
  "mv.relocateOldPath": "原路径",
  "mv.relocatePathTitle": "新的项目目录",
  "mv.relocatePathError": "请选择一个目录",
  "mv.relocateSubmit": "指向这个目录",
  "mv.relocatedToast": "已重新指向新目录",
  "mv.removeConfirmTitle": "移除项目: {name}",
  "mv.removeConfirmMessage": "这仅会从 Env Butler 注册表中移除该项目的登记记录，绝不会删除本地实际目录或 .env 文件。",
  "mv.removeConfirmAction": "移除",
  "mv.loadRegistryFailedTitle": "加载项目注册表失败",
  "mv.removedToastTitle": "已移除项目: {name}",
  "mv.emptyTitle": "暂无已登记项目",
  "mv.emptyDesc": "点击回车或 ⌘N 添加你的第一个本地项目目录，开启环境变量安全管理。",

  // ---- 添加项目表单 ----
  "addProject.description": "选择本地项目根目录，Env Butler 将自动探测该目录下的 .env 文件并管理。",
  "addProject.pathTitle": "项目目录",
  "addProject.pathError": "请选择一个项目目录",
  "addProject.nameTitle": "项目显示名称",
  "addProject.namePlaceholder": "默认取文件夹名称",
  "addProject.submitTitle": "添加项目",
  "addProject.successToast": "已成功添加项目: {name}",
  "addProject.failToast": "添加项目失败",

  // ---- 项目详情页 ----
  "pd.readFailedTitle": "读取环境文件失败",
  "pd.secretOnToast": "已设为敏感字段",
  "pd.secretOffToast": "已取消敏感字段",
  "pd.conflictTitle": "检测到外部修改冲突",
  "pd.conflictMessage":
    "{file} 在你编辑期间被外部程序修改了。选择「放弃修改」会丢弃你刚才的改动、直接加载最新内容；选择「强制覆盖」会用你的改动覆盖外部的修改。",
  "pd.conflictOverwrite": "强制覆盖",
  "pd.conflictDiscardMine": "放弃修改",
  "pd.savedToast": "已保存并生成历史快照",
  "pd.exampleSuccessTitle": "已成功生成 .env.example",
  "pd.exampleConfirmTitle": "更新 .env.example？",
  "pd.exampleConfirmMessage":
    "会新增 {added} 个键、移除 {removed} 个键；另外 {kept} 个键在模板里的写法（包括手写的说明和占位值）原样保留。\n\n更新前会先存一份快照，随时可以从快照历史回滚。",
  "pd.exampleConfirmAction": "更新",
  "pd.exampleNoChangeToast": ".env.example 已经是最新的，没有需要改的",
  "pd.exampleSummary": "新增 {added} 个、移除 {removed} 个、保留 {kept} 个",
  "pd.alreadyMainEnvToast": "当前已经是 .env 文件",
  "pd.copyOverwriteConfirmTitle": "覆盖已有的 .env？",
  "pd.copyOverwriteConfirmMessage":
    "这个项目下已经有一个 .env 文件了。继续会用 {file} 的内容整个覆盖它。\n\n覆盖前会先给现在的 .env 存一份快照，随时可以从快照历史里找回来。",
  "pd.copyOverwriteConfirmAction": "覆盖",
  "pd.copiedAsMainEnvToast": "已将 {file} 复制为 .env",
  "pd.envrcTitle": "检测到项目中存在 .envrc (direnv)",
  "pd.envrcSubtitle": "Env Butler 不会修改 .envrc，请确保 direnv 配置与 .env 协同生效",
  "pd.envrcLearnMore": "了解详情",
  "pd.envrcDismiss": "不再提示此项目",
  "pd.envrcDismissedToast": "已关闭该项目的 .envrc 提示",
  "pd.envrcDetailMarkdown": `# .envrc 是什么？

**direnv** 是一个第三方 shell 工具（不是 Env Butler 的功能）。装了它之后，你 \`cd\` 进一个带 \`.envrc\` 文件的目录时，终端会自动加载这个文件里定义的环境变量；\`cd\` 离开时自动卸载。

有些项目会在 \`.envrc\` 里写类似 \`dotenv .env.development\` 的命令，让 direnv 把某个 .env 文件的内容自动灌进你的终端；也有项目只是单纯 \`export\` 几个变量，跟 .env 文件完全无关。

## 为什么 Env Butler 要提醒你

Env Butler 编辑的是磁盘上的 .env 文件本身，但你**终端里实际生效**的环境变量是由 direnv 决定的——两者可能不同步：改完 .env 存盘后，通常还需要在终端执行 \`direnv reload\`（或重新 \`cd\` 一次）才会让新内容真正生效。

## Env Butler 会怎么做

**绝不会**读取、解析或修改你的 .envrc 文件——具体逻辑完全由你和 direnv 掌控，这里只是提醒它的存在，避免你误以为"改完 .env 终端就自动同步了"。

---

不想再看到这条提示？用下方操作「不再提示此项目」即可关闭，只影响当前项目。`,
  "pd.searchPlaceholder": "在 {file} 中搜索变量...",
  "pd.switchEnvFileTooltip": "切换环境文件",
  "pd.createEnvFileItem": "➕ 新建环境文件...",
  "pd.sectionEnvrc": "环境提醒",
  "pd.sectionEnabled": "已启用的变量",
  "pd.sectionDisabled": "已禁用的变量 (注释行)",
  "pd.sectionVariableActions": "变量操作",
  "pd.sectionEnvAndSnapshot": "环境与快照",
  "pd.countItems": "{count} 项",
  "pd.actionHide": "隐藏明文打码",
  "pd.actionReveal": "显示明文值",
  "pd.actionCopyValue": "复制变量值",
  "pd.actionCopyKey": "复制变量名 (KEY)",
  "pd.actionCopyPair": "复制整行 (KEY=VALUE)",
  "pd.actionEdit": "编辑变量",
  "pd.actionNew": "新建变量",
  "pd.actionToggleOff": "注释/禁用该变量",
  "pd.actionToggleOn": "启用该变量",
  "pd.actionSecretOff": "取消敏感标记",
  "pd.actionSecretOn": "标记为敏感字段",
  "pd.actionDelete": "删除变量",
  "pd.actionSnapshotHistory": "查看快照历史",
  "pd.actionGenerateExample": "生成/更新 .env.example",
  "pd.actionCopyAsMainEnv": "复制当前环境为 .env",
  "pd.lockTooltip": "敏感字段 (已打码)",
  "pd.disabledTag": "已注释",
  "pd.deleteConfirmTitle": "删除变量: {key}",
  "pd.deleteConfirmMessage": "确定要从 {file} 中移除 {key} 吗？修改前将自动创建备份快照。",
  "pd.emptyTitle": "该环境中暂无变量",
  "pd.emptyDesc": "文件路径: {path}\n按下 ⌘N 新建第一个环境变量",

  // ---- 变量编辑表单 ----
  "ev.keyEmptyError": "变量名不能为空",
  "ev.keyInvalidError": "变量名不合法，必须以字母或下划线开头，仅包含字母数字下划线",
  "ev.keyTitle": "变量名 (KEY)",
  "ev.keyPlaceholder": "例如: DATABASE_URL, PORT",
  "ev.valueTitle": "变量值 (VALUE)",
  "ev.valuePlaceholder": "变量值...",
  "ev.commentTitle": "行内注释",
  "ev.commentPlaceholder": "例如：本地开发用",
  "ev.commentInfo":
    "写在这一行末尾的说明，保存后是 KEY=值 # 说明 的形式。生成 .env.example 时会一起保留下来。留空表示不要注释。",
  "ev.quoteTitle": "包裹引号",
  "ev.quoteNone": "无引号 (无特殊字符推荐)",
  "ev.quoteDouble": '双引号 "..."',
  "ev.quoteSingle": "单引号 '...'",
  "ev.disabledLabel": "注释禁用此变量 (在 .env 中以前缀 # 存储)",
  "ev.secretLabel": "标记为敏感字段 (在列表中自动脱敏打码)",
  "ev.encryptedWarning":
    "⚠️ 该值由 dotenvx 加密 (encrypted: 前缀)。直接在此修改会破坏加密数据，通常应改用 dotenvx 命令行工具重新加密，而不是手动改明文。",
  "ev.encryptedOverrideLabel": "我了解风险，仍要用明文覆盖这个加密值",
  "ev.encryptedBlockedError": "该变量是 dotenvx 加密值，请先勾选上方确认框再保存，或不要改动它",
  "ev.submitEdit": "保存修改",
  "ev.submitCreate": "创建变量",

  // ---- 新建环境文件表单 ----
  "cf.description": "在项目目录下新建一个空的环境文件，创建后会自动切换过去。",
  "cf.suffixTitle": "环境名称",
  "cf.suffixPlaceholder": "例如: development, staging, feature_x",
  "cf.suffixEmptyError": "请输入环境名称",
  "cf.suffixInvalidError": "环境名称只能包含字母、数字、下划线、短横线",
  "cf.previewFilename": "将创建文件: {filename}",
  "cf.alreadyExistsError": "{filename} 已存在，请换一个名称",
  "cf.submitTitle": "新建环境文件",
  "cf.successToast": "已创建 {filename}",
  "cf.failToast": "创建环境文件失败",

  // ---- Shell 轨 ----
  "st.searchPlaceholder": "搜索 Shell 片段与 alias...",
  "st.loadFailedTitle": "读取 Shell 配置失败",
  "st.toggledToast": "已更新片段状态并重新生成 shell.sh",
  "st.addedToast": "已添加片段并写入 shell.sh",
  "st.updatedToast": "已更新片段并同步 shell.sh",
  "st.deletedToast": "已删除片段",
  "st.movedToast": "已调整顺序（第 {index} / {total} 位）",
  "st.actionMoveUp": "上移一位（在 shell.sh 里更靠前）",
  "st.actionMoveDown": "下移一位（在 shell.sh 里更靠后）",
  "st.actionPreviewScript": "查看生成的 shell.sh",
  "st.previewTitle": "生成的 shell.sh",
  "st.previewIntro":
    "这是 Env Butler 根据你启用的片段实际生成的文件。**列表里是按类型分组显示的，这里才是真正的执行顺序**——shell 从上往下执行，后面的片段能用到前面定义的变量。",
  "st.previewPathLabel": "文件路径",
  "st.previewEmpty": "还没有生成内容——可能是一个片段都没有，或者启用的片段都是空的。",
  "st.previewCopy": "复制整个文件内容",
  "st.orderTooltip": "在 shell.sh 里的排列顺序",
  "st.actionConfigHistory": "查看 Shell 配置历史",
  "st.actionSnippetHistory": "查看此片段的变更历史",
  "st.actionRcBackups": "查看 {file} 的备份",
  "st.rcBackupNote": "改动前的内容已备份到 {path}",
  "st.actionRevealSecrets": "显示明文值",
  "st.actionHideSecrets": "重新打码",
  "st.secretTag": "含敏感信息",
  "es.containsSecretLabel": "这段里有敏感信息（勾选后整段默认打码显示）",
  "sch.searchPlaceholder": "搜索 Shell 配置历史...",
  "sch.navTitle": "Shell 配置历史",
  "sch.sectionTitle": "Shell 配置历史",
  "sch.sectionSubtitle": "{count} 份",
  "sch.emptyTitle": "还没有历史记录",
  "sch.emptyDesc": "每次改动 Shell 片段前，Env Butler 都会把改动前的配置存一份到这里",
  "sch.infoHeading": "这份记录",
  "sch.infoRecordedAt": "记录时间",
  "sch.infoFileSize": "大小",
  "sch.infoSnippetCount": "片段数",
  "sch.contentHeading": "这份记录里的片段",
  "sch.contentEmpty": "这份记录里一个片段都没有",
  "sch.unreadable": "这份记录读不出来，文件可能已损坏",
  "sch.actionRestore": "恢复到这份配置",
  "sch.actionDelete": "删除这份记录",
  "sch.restoreConfirmTitle": "恢复到 {time} 的配置？",
  "sch.restoreConfirmMessage":
    "当前的 Shell 配置会被这份记录整个替换，shell.sh 也会跟着重新生成。\n\n恢复前会先把当前配置存一份，随时可以再切回来。",
  "sch.restoreConfirmAction": "恢复",
  "sch.restoredToast": "已恢复，开一个新终端窗口即可生效",
  "sch.restoreFailedTitle": "恢复失败",
  "sch.deleteConfirmTitle": "删除这份历史记录？",
  "sch.deleteConfirmMessage": "只会删掉 {filename} 这一份记录，不影响你当前的 Shell 配置。",
  "sch.deletedToast": "已删除这份记录",
  "sch.actionCopy": "复制这份配置",
  "sch.actionCleanup": "清理旧记录",
  "sch.cleanupUnit": "历史记录",
  "sch.cleanupDescription": "只会删掉 Shell 配置的历史记录，不影响你当前的 Shell 配置，也不影响项目轨的快照。",
  "sch.focusNavTitle": "{name} 的变更历史",
  "sch.focusSectionTitle": "变更历史 - {name}",
  "sch.focusEmptyTitle": "这个片段还没有变更记录",
  "sch.focusEmptyDesc": "从下一次改动开始，这个片段的每次变化都会出现在这里",
  "sch.focusAbsent": "这一版里还没有这个片段",
  "sch.focusUnchanged": "这个片段没有变化",
  "sch.focusActionRestore": "恢复整份配置到这一版",
  "sch.focusRestoreOnlyThis":
    "恢复的是整份 Shell 配置，不只是「{name}」。不过这一版里其他片段跟现在一样，所以这次只会影响「{name}」。新开一个终端窗口后生效。",
  "sch.focusRestoreAlsoAffects":
    "恢复的是整份 Shell 配置，不只是「{name}」。另外这 {count} 个片段也会跟着变回这一版：{others}。新开一个终端窗口后生效。",
  "st.detailOrder": "排列顺序",
  "st.detailOrderValue": "第 {index} / {total} 位",
  "st.bootstrapSection": "Shell 集成",
  "st.bootstrapReadyTitle": "✅ Shell 集成已启用",
  "st.bootstrapReadySubtitle": "已在 {file} 检测到相关配置，新增/修改片段会自动同步",
  "st.bootstrapPendingTitle": "还差一步：启用 Shell 集成",
  "st.bootstrapUnknownTitle": "未识别到 zsh/bash，请手动把这一行添加到你的 shell 配置文件末尾：",
  "st.bootstrapLearnMore": "了解详情",
  "st.copySourceCommand": "复制这一行",
  "st.actionEnableIntegration": "启用 Shell 集成（写入 {file}）",
  "st.enableConfirmTitle": "启用 Shell 集成？",
  "st.enableConfirmMessage":
    "Env Butler 会在 {file} 末尾追加这一行：\n\n{sourceLine}\n\n不会修改你已有的任何内容，随时可以再次「禁用 Shell 集成」移除。确定现在写入吗？",
  "st.enableConfirmAction": "写入",
  "st.enabledIntegrationToast": "已启用 Shell 集成，开一个新终端窗口即可生效",
  "st.enableFailedTitle": "启用失败",
  "st.actionDisableIntegration": "禁用 Shell 集成（从 {file} 移除）",
  "st.disableConfirmTitle": "禁用 Shell 集成？",
  "st.disableConfirmMessage":
    "会从 {file} 移除 Env Butler 写入的这一行：\n\n{sourceLine}\n\n之后新开的终端窗口就不会再加载你在 Shell 轨配置的变量/alias/片段了（已有终端窗口不受影响）。确定要移除吗？",
  "st.disableConfirmAction": "移除",
  "st.disabledIntegrationToast": "已从 {file} 移除，Shell 集成已禁用",
  "st.disableFailedTitle": "禁用失败",
  "st.bootstrapDetailMarkdown": `# 为什么要做这一步？

Env Butler 把你在 Shell 轨里添加、且处于"启用"状态的全局环境变量、alias、脚本片段，编译成了一个文件：

\`\`\`
{sourceLine}
\`\`\`

但这个文件不会自己生效——zsh/bash 只会在启动终端时读取你的配置文件（比如 \`~/.zshrc\`），不会主动去找 Env Butler 生成的文件。所以需要在配置文件末尾加上面这一行，告诉 shell "启动时也读一下这个文件"。

## 怎么启用

跟 Shell 轨里片段的"启用/停用"是同一套逻辑，两种方式都行：

- **启用 Shell 集成**（推荐）：点这个操作，Env Butler 会帮你把这一行追加到 **{file}** 末尾，不会动你已有的任何内容。
- **复制这一行**：如果你想自己动手，也可以复制后手动粘贴进 **{file}**。

## 不想要了怎么办

启用之后，这条提示会变成"✅ Shell 集成已启用"，操作里会多一个 **禁用 Shell 集成**——点一下就会把 Env Butler 加的那一行从 {file} 里干净移除，不影响你已有的其它配置，随时可以再启用回来。

## 启用之后

打开一个新的终端窗口（或执行 \`source {rcPath}\`），片段就会生效。之后你在 Shell 轨里增删改片段，Env Butler 都会自动重新生成这个文件，不需要重复启用这一步。

## 怎么知道自己启用没启用

Env Butler 每次打开都会检测 {file} 里有没有这一行——检测到了，这条提示会自动变成"✅ Shell 集成已启用"，不会重复提醒你。`,
  "st.actionNewSnippet": "新建 Shell 片段",
  "st.sectionExports": "环境变量 (export)",
  "st.sectionAliases": "命令别名 (alias)",
  "st.sectionOthers": "通用脚本片段",
  "st.emptyTitle": "暂无 Shell 片段",
  "st.emptyDesc": "点击回车或 ⌘N 添加你的第一个全局环境变量、alias 或 Shell 片段",
  "st.actionDisable": "停用该片段",
  "st.actionEnable": "启用该片段",
  "st.actionEdit": "编辑片段",
  "st.actionNew": "新建片段",
  "st.actionCopyContent": "复制片段代码",
  "st.actionDelete": "删除片段",
  "st.deleteConfirmTitle": "删除片段: {name}",
  "st.deleteConfirmMessage": "确定要移除该片段吗？",
  "st.enabledTag": "已生效",
  "st.disabledTag": "已停用",
  "st.detailHeading": "### 片段信息",
  "st.detailType": "类型",
  "st.detailStatus": "状态",
  "st.detailDescription": "备注",
  "st.detailNone": "（无）",

  // ---- Shell 片段编辑表单 ----
  "es.nameEmptyError": "片段名称不能为空",
  "es.contentEmptyError": "片段内容不能为空",
  "es.syntaxFailedTitle": "Shell 语法校验未通过 ({shell} -n)",
  "es.lintConfirmTitle": "这几行看起来写错了",
  "es.lintMisspelled": "第 {line} 行：{word} 是不是想写 {suggestion}？",
  "es.lintUnknownPrefix": "第 {line} 行：{word} 不像是一条命令，这一行的变量不会生效",
  "es.lintFixAction": "回去改",
  "es.lintIgnoreAction": "我确认没写错，保存",
  "es.nameTitle": "片段名称",
  "es.namePlaceholder": "例如: JAVA_HOME 或 git-status-alias",
  "es.typeTitle": "片段类型",
  "es.typeExport": "环境变量 (export)",
  "es.typeAlias": "命令别名 (alias)",
  "es.typeSnippet": "脚本片段 (不限内容)",
  "es.contentTitle": "Shell 代码内容",
  "es.exportMismatchHint":
    "⚠️ 内容不是以 export 开头，如果不是设置环境变量，建议改选「脚本片段」类型；这只是提醒，不影响保存。",
  "es.aliasMismatchHint":
    "⚠️ 内容不是以 alias 开头，如果不是定义命令别名，建议改选「脚本片段」类型；这只是提醒，不影响保存。",
  "es.descTitle": "备注说明 (可选)",
  "es.descPlaceholder": "简要描述此片段用途",
  "es.enabledLabel": "启用此片段 (生成至 ~/.env-butler/shell.sh)",
  "es.submitTitle": "保存片段",

  // ---- 快照历史 ----
  "sh.searchPlaceholder": "搜索历史快照...",
  "sh.sectionTitle": "快照历史 - {file}",
  "sh.sectionSubtitle": "{count} 份安全备份",
  "sh.sizeAccessory": "{size} KB",
  "sh.actionRestore": "回滚到此版本",
  "sh.actionCopyContent": "复制快照内容",
  "sh.actionDelete": "删除该快照",
  "sh.actionCleanup": "清理旧快照",
  "sh.cleanupNavTitle": "清理旧快照",
  "sh.cleanupDescription": "只影响 {file} 的快照，不会动其他环境文件，也不会动 {file} 本身。",
  "sh.cleanupKeepTitle": "保留最近几份",
  "sh.cleanupKeepPlaceholder": "选择保留份数",
  "sh.cleanupKeepOption": "保留最近 {count} 份",
  "sh.cleanupKeepNone": "全部删除（一份不留）",
  "sh.cleanupPreview": "当前共 {total} 份，这次会删掉 {count} 份",
  "sh.cleanupNothing": "当前共 {total} 份，按这个设置没有需要删的",
  "sh.cleanupSubmit": "删除",
  "sh.cleanupConfirmTitle": "确定删掉 {count} 份{unit}？",
  "sh.cleanupUnit": "快照",
  "sh.cleanupConfirmMessage": "删掉之后就找不回来了。剩下的 {kept} 份不受影响。",
  "sh.cleanupDoneToast": "已删除 {count} 份{unit}",
  "sh.restoreConfirmTitle": "回滚到快照: {timestamp}",
  "sh.restoreConfirmMessage":
    "确定要将 {file} 还原至该历史版本吗？当前文件将在还原前自动打一份新快照备份，确保绝不丢失数据。",
  "sh.restoreConfirmAction": "立即回滚",
  "sh.restoredToast": "快照已成功回滚",
  "sh.restoreFailedTitle": "回滚失败",
  "sh.restoreErrorTitle": "回滚异常",
  "sh.deleteConfirmTitle": "删除快照",
  "sh.deleteConfirmMessage": "确定要永久删除快照 {filename} 吗？",
  "sh.deletedToast": "已删除快照",
  "sh.unreadableContent": "(无法读取快照内容)",
  "sh.emptyTitle": "暂无快照",
  "sh.emptyDesc": "当您在 Env Butler 中首次修改并保存环境变量时，将自动为您保留历史快照。",
  "sh.infoHeading": "快照信息",
  "sh.infoTargetFile": "目标文件",
  "sh.infoRecordedAt": "记录时间",
  "sh.infoFileSize": "文件大小",
  "sh.contentHeading": "快照内容",
  "sh.contentEmpty": "（空文件）",

  // ---- 全局搜索 ----
  "search.placeholder": "搜索所有项目和 Shell 轨的变量名 / 变量值...",
  "search.loadFailedTitle": "加载变量失败",
  "search.sectionTitle": "匹配结果",
  "search.sectionShell": "Shell 轨",
  "search.shellSource": "Shell 轨 / {name}",
  "search.actionGotoShell": "去 Shell 轨查看",
  "search.sectionSubtitle": "{count} 个变量",
  "search.actionGoto": "前往项目详情管理",
  "search.actionHide": "隐藏明文",
  "search.actionReveal": "显示明文",
  "search.actionCopyValue": "复制变量值",
  "search.actionCopyKey": "复制变量名 (KEY)",
  "search.lockTooltip": "敏感字段",
  "search.emptyTitle": "未搜索到匹配的变量",
  "search.emptyDesc": "尝试搜索其他关键词，或在 Manage Envs 中登记新项目",

  // ---- 历史差异区(项目轨快照 / Shell 配置历史共用) ----
  "diff.fromPrevHeading": "上一版 → 此版本",
  "diff.fromPrevHint": "这一次保存改了什么",
  "diff.toCurrentHeading": "此版本 → 当前版本",
  "diff.toCurrentHint": "从这份记录到现在，发生了什么",
  "diff.noPrev": "这是最早的一份记录，没有更早的版本可比",
  "diff.none": "没有任何差异",
  "diff.added": "🟢 新增",
  "diff.removed": "🔴 删除",
  "diff.changed": "🟡 改动",
  "diff.originalValue": "原值",
  "diff.addedDisabled": "（加进来时就是注释状态）",
  "diff.turnedOff": "被注释掉了，不再生效",
  "diff.turnedOn": "取消了注释，重新生效",
  "diff.renamed": "（原名 {name}）",

  // ---- .zshrc 备份 ----
  "rcb.navTitle": "{file} 的备份",
  "rcb.searchPlaceholder": "搜索备份...",
  "rcb.sectionTitle": "备份文件",
  "rcb.sectionSubtitle": "{count} 份",
  "rcb.emptyTitle": "还没有备份",
  "rcb.emptyDesc": "接入或移除 Shell 集成时会自动存一份 {file}；你也可以现在手动存一份",
  "rcb.infoHeading": "这份备份",
  "rcb.infoOrigin": "原文件",
  "rcb.infoRecordedAt": "备份时间",
  "rcb.infoFileSize": "大小",
  "rcb.contentHeading": "备份内容",
  "rcb.contentEmpty": "（空文件）",
  "rcb.unreadable": "这份备份读不出来，文件可能已损坏",
  "rcb.actionBackupNow": "立即备份 {file}",
  "rcb.actionBackupTo": "备份到其他位置...",
  "rcb.actionRestore": "用这份备份覆盖 {file}",
  "rcb.actionShowInFinder": "在访达中显示这份备份",
  "rcb.actionDelete": "删除这份备份",
  "rcb.backupToNavTitle": "备份到其他位置",
  "rcb.backupToDescription": "会把 {file} 原样复制一份。不选目录就存进 Env Butler 自己的备份目录：{dir}",
  "rcb.backupToDirTitle": "存到哪里",
  "rcb.backupToDirInfo": "留空则使用默认备份目录",
  "rcb.backupSubmit": "备份",
  "rcb.backedUpToast": "已备份",
  "rcb.backupFailedTitle": "备份失败",
  "rcb.restoreConfirmTitle": "用 {time} 的备份覆盖当前配置？",
  "rcb.restoreConfirmMessage":
    "{file} 会被这份备份整个覆盖。覆盖之前会先把现在的内容再存一份，所以这一步也能撤回。新开一个终端窗口后生效。",
  "rcb.restoreConfirmAction": "覆盖",
  "rcb.restoredToast": "已恢复 {file}，开一个新终端窗口即可生效",
  "rcb.restoredSafetyNote": "覆盖前的内容已存到 {path}",
  "rcb.restoreFailedTitle": "恢复失败",
  "rcb.deleteConfirmTitle": "删除这份备份？",
  "rcb.deleteConfirmMessage": "删掉之后就找不回来了：{filename}",
  "rcb.deletedToast": "已删除这份备份",
} as const;

type DictKey = keyof typeof zh;

const en: Record<DictKey, string> = {
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.confirm": "Confirm",
  "common.saveFailedTitle": "Save Failed",
  "common.searchPlaceholder": "Search...",
  "common.showDataDir": "Show Data Folder in Finder (copy it to move to a new machine)",
  "common.snapshotLimitMessage":
    "{count} snapshots kept (we suggest staying under {limit}) — you can clear out old ones in Snapshot History",

  "cfg.sectionTitle": "Needs Your Attention",
  "cfg.corruptedTitle": "Could not read the config file — the original was kept",
  "cfg.corruptedSubtitle":
    "The original was renamed to {name} and still holds your data. Fix its format and rename it back to restore it",
  "cfg.tooNewTitle": "This config file comes from a newer Env Butler",
  "cfg.tooNewSubtitle":
    "File version {version}, this build only understands up to {current}. The original was renamed to {name} — update the extension and rename it back to restore it",
  "cfg.showBackup": "Show Original File in Finder",

  "mv.searchPlaceholderProjects": "Search registered projects...",
  "mv.trackTooltip": "Switch Track",
  "mv.trackProjects": "Project Track (Project Envs)",
  "mv.trackShell": "Shell Track (Global Shell / Alias)",
  "mv.sectionTitle": "Registered Projects",
  "mv.sectionSubtitle": "{count} project(s)",
  "mv.envCountAccessory": "{count} env file(s)",
  "mv.lastOpenedAccessory": "Opened {date}",
  "mv.actionManage": "Manage Environment Variables",
  "mv.actionAddProject": "Register New Project",
  "mv.actionOpenWith": "Open With...",
  "mv.actionRemove": "Stop Managing This Project",
  "mv.missingTag": "Path Missing",
  "mv.missingTooltip": "This folder is gone — it may have been renamed or moved",
  "mv.actionRelocate": "Point to a New Folder",
  "mv.relocateNavTitle": "Point to a New Folder",
  "mv.relocateDescription":
    'Choose the new folder for "{name}". Fields you marked as sensitive and notices you dismissed are kept.',
  "mv.relocateOldPath": "Old path",
  "mv.relocatePathTitle": "New project folder",
  "mv.relocatePathError": "Please choose a folder",
  "mv.relocateSubmit": "Point Here",
  "mv.relocatedToast": "Now pointing at the new folder",
  "mv.removeConfirmTitle": "Remove Project: {name}",
  "mv.removeConfirmMessage":
    "This only removes the registration entry from Env Butler. It will never delete the actual local directory or .env files.",
  "mv.removeConfirmAction": "Remove",
  "mv.loadRegistryFailedTitle": "Failed to Load Project Registry",
  "mv.removedToastTitle": "Removed project: {name}",
  "mv.emptyTitle": "No Registered Projects Yet",
  "mv.emptyDesc": "Press Enter or ⌘N to add your first local project directory and start managing env vars safely.",

  "addProject.description":
    "Choose a local project root directory. Env Butler will automatically detect and manage the .env files inside it.",
  "addProject.pathTitle": "Project Directory",
  "addProject.pathError": "Please choose a project directory",
  "addProject.nameTitle": "Display Name",
  "addProject.namePlaceholder": "Defaults to the folder name",
  "addProject.submitTitle": "Add Project",
  "addProject.successToast": "Successfully added project: {name}",
  "addProject.failToast": "Failed to Add Project",

  "pd.readFailedTitle": "Failed to Read Env File",
  "pd.secretOnToast": "Marked as sensitive field",
  "pd.secretOffToast": "Unmarked as sensitive field",
  "pd.conflictTitle": "External Modification Conflict Detected",
  "pd.conflictMessage":
    '{file} was modified by another program while you were editing. Choose "Discard Mine" to drop your changes and load the latest content; choose "Force Overwrite" to overwrite the external changes with yours.',
  "pd.conflictOverwrite": "Force Overwrite",
  "pd.conflictDiscardMine": "Discard Mine",
  "pd.savedToast": "Saved and snapshot created",
  "pd.exampleSuccessTitle": "Successfully generated .env.example",
  "pd.exampleConfirmTitle": "Update .env.example?",
  "pd.exampleConfirmMessage":
    "{added} keys will be added and {removed} removed. The other {kept} keys keep exactly what the template already says, including hand-written notes and placeholder values.\n\nA snapshot is saved first, so you can always roll back from Snapshot History.",
  "pd.exampleConfirmAction": "Update",
  "pd.exampleNoChangeToast": ".env.example is already up to date — nothing to change",
  "pd.exampleSummary": "{added} added, {removed} removed, {kept} kept",
  "pd.alreadyMainEnvToast": "This is already the .env file",
  "pd.copyOverwriteConfirmTitle": "Overwrite the existing .env?",
  "pd.copyOverwriteConfirmMessage":
    "This project already has a .env file. Continuing replaces all of it with the contents of {file}.\n\nA snapshot of the current .env is saved first, so you can always get it back from Snapshot History.",
  "pd.copyOverwriteConfirmAction": "Overwrite",
  "pd.copiedAsMainEnvToast": "Copied {file} as .env",
  "pd.envrcTitle": "Detected .envrc (direnv) in this project",
  "pd.envrcSubtitle": "Env Butler will not modify .envrc — please make sure your direnv setup works together with .env",
  "pd.envrcLearnMore": "Learn More",
  "pd.envrcDismiss": "Don't Show Again for This Project",
  "pd.envrcDismissedToast": "Disabled the .envrc notice for this project",
  "pd.envrcDetailMarkdown": `# What is .envrc?

**direnv** is a third-party shell tool (not a feature of Env Butler). Once installed, it automatically loads the environment variables defined in \`.envrc\` when you \`cd\` into a directory that contains one, and unloads them when you leave.

Some projects put a command like \`dotenv .env.development\` in \`.envrc\` so direnv pipes a specific .env file's content straight into your terminal; other projects just \`export\` a few variables with no relation to any .env file at all.

## Why Env Butler flags this

Env Butler edits the .env file on disk directly, but the environment variables **actually active in your terminal** are decided by direnv — the two can drift out of sync: after saving changes via Env Butler, you usually still need to run \`direnv reload\` (or \`cd\` back in) in your terminal for the new content to actually take effect.

## What Env Butler does about it

It will **never** read, parse, or modify your \`.envrc\` file — that logic stays entirely under your and direnv's control. This notice only exists so you're not surprised that editing .env here doesn't automatically sync to your shell.

---

Don't want to see this again? Use "Don't Show Again for This Project" below — it only affects the current project.`,
  "pd.searchPlaceholder": "Search variables in {file}...",
  "pd.switchEnvFileTooltip": "Switch Env File",
  "pd.createEnvFileItem": "➕ Create New Env File...",
  "pd.sectionEnvrc": "Environment Notice",
  "pd.sectionEnabled": "Enabled Variables",
  "pd.sectionDisabled": "Disabled Variables (Commented Out)",
  "pd.sectionVariableActions": "Variable Actions",
  "pd.sectionEnvAndSnapshot": "Environment & Snapshots",
  "pd.countItems": "{count} item(s)",
  "pd.actionHide": "Hide Plain Value",
  "pd.actionReveal": "Show Plain Value",
  "pd.actionCopyValue": "Copy Value",
  "pd.actionCopyKey": "Copy Key",
  "pd.actionCopyPair": "Copy Line (KEY=VALUE)",
  "pd.actionEdit": "Edit Variable",
  "pd.actionNew": "New Variable",
  "pd.actionToggleOff": "Comment Out / Disable",
  "pd.actionToggleOn": "Enable Variable",
  "pd.actionSecretOff": "Unmark as Sensitive",
  "pd.actionSecretOn": "Mark as Sensitive",
  "pd.actionDelete": "Delete Variable",
  "pd.actionSnapshotHistory": "View Snapshot History",
  "pd.actionGenerateExample": "Generate/Update .env.example",
  "pd.actionCopyAsMainEnv": "Copy Current Environment as .env",
  "pd.lockTooltip": "Sensitive field (masked)",
  "pd.disabledTag": "Commented",
  "pd.deleteConfirmTitle": "Delete Variable: {key}",
  "pd.deleteConfirmMessage":
    "Are you sure you want to remove {key} from {file}? A backup snapshot will be created automatically before the change.",
  "pd.emptyTitle": "No Variables in This Environment",
  "pd.emptyDesc": "File path: {path}\nPress ⌘N to create your first variable",

  "ev.keyEmptyError": "Variable name cannot be empty",
  "ev.keyInvalidError": "Invalid variable name: must start with a letter or underscore, letters/digits/underscore only",
  "ev.keyTitle": "Key",
  "ev.keyPlaceholder": "e.g. DATABASE_URL, PORT",
  "ev.valueTitle": "Value",
  "ev.valuePlaceholder": "Variable value...",
  "ev.commentTitle": "Inline Comment",
  "ev.commentPlaceholder": "e.g. used for local development",
  "ev.commentInfo":
    "A note kept at the end of this line, saved as KEY=value # note. It is preserved when generating .env.example. Leave empty for no comment.",
  "ev.quoteTitle": "Wrap With Quotes",
  "ev.quoteNone": "No quotes (recommended without special chars)",
  "ev.quoteDouble": 'Double quotes "..."',
  "ev.quoteSingle": "Single quotes '...'",
  "ev.disabledLabel": "Comment out this variable (stored as # prefix in .env)",
  "ev.secretLabel": "Mark as sensitive (auto-masked in list view)",
  "ev.encryptedWarning":
    "⚠️ This value is encrypted by dotenvx (encrypted: prefix). Editing it here will break the encrypted data — normally you should re-encrypt via the dotenvx CLI instead of editing the plaintext.",
  "ev.encryptedOverrideLabel": "I understand the risk, override with plaintext anyway",
  "ev.encryptedBlockedError":
    "This is a dotenvx-encrypted value — check the box above before saving, or leave it unchanged",
  "ev.submitEdit": "Save Changes",
  "ev.submitCreate": "Create Variable",

  "cf.description": "Create a new empty environment file in the project directory; it will switch to it automatically.",
  "cf.suffixTitle": "Environment Name",
  "cf.suffixPlaceholder": "e.g. development, staging, feature_x",
  "cf.suffixEmptyError": "Please enter an environment name",
  "cf.suffixInvalidError": "Only letters, digits, underscore and hyphen are allowed",
  "cf.previewFilename": "Will create file: {filename}",
  "cf.alreadyExistsError": "{filename} already exists, please choose another name",
  "cf.submitTitle": "Create Env File",
  "cf.successToast": "Created {filename}",
  "cf.failToast": "Failed to Create Env File",

  "st.searchPlaceholder": "Search shell snippets & aliases...",
  "st.loadFailedTitle": "Failed to Load Shell Config",
  "st.toggledToast": "Snippet state updated and shell.sh regenerated",
  "st.addedToast": "Snippet added and written to shell.sh",
  "st.updatedToast": "Snippet updated and shell.sh synced",
  "st.deletedToast": "Snippet deleted",
  "st.movedToast": "Order updated (now {index} of {total})",
  "st.actionMoveUp": "Move Up (earlier in shell.sh)",
  "st.actionMoveDown": "Move Down (later in shell.sh)",
  "st.actionPreviewScript": "View Generated shell.sh",
  "st.previewTitle": "Generated shell.sh",
  "st.previewIntro":
    "This is the file Env Butler actually generates from your enabled snippets. **The list groups snippets by type, but this is the real execution order** — the shell runs top to bottom, so later snippets can use what earlier ones define.",
  "st.previewPathLabel": "File path",
  "st.previewEmpty": "Nothing generated yet — either there are no snippets, or every enabled snippet is empty.",
  "st.previewCopy": "Copy Whole File",
  "st.orderTooltip": "Position in the generated shell.sh",
  "st.actionConfigHistory": "View Shell Config History",
  "st.actionSnippetHistory": "View This Snippet's History",
  "st.actionRcBackups": "View Backups of {file}",
  "st.rcBackupNote": "The previous content was backed up to {path}",
  "st.actionRevealSecrets": "Reveal Values",
  "st.actionHideSecrets": "Mask Again",
  "st.secretTag": "Has Secrets",
  "es.containsSecretLabel": "This snippet contains secrets (mask the whole thing by default)",
  "sch.searchPlaceholder": "Search Shell config history...",
  "sch.navTitle": "Shell Config History",
  "sch.sectionTitle": "Shell Config History",
  "sch.sectionSubtitle": "{count} entries",
  "sch.emptyTitle": "No history yet",
  "sch.emptyDesc": "Before every change to your Shell snippets, Env Butler saves the previous config here",
  "sch.infoHeading": "This Entry",
  "sch.infoRecordedAt": "Recorded at",
  "sch.infoFileSize": "Size",
  "sch.infoSnippetCount": "Snippets",
  "sch.contentHeading": "Snippets In This Entry",
  "sch.contentEmpty": "This entry has no snippets",
  "sch.unreadable": "Could not read this entry — the file may be damaged",
  "sch.actionRestore": "Restore This Config",
  "sch.actionDelete": "Delete This Entry",
  "sch.restoreConfirmTitle": "Restore the config from {time}?",
  "sch.restoreConfirmMessage":
    "Your current Shell config will be replaced entirely, and shell.sh will be regenerated.\n\nThe current config is saved first, so you can always switch back.",
  "sch.restoreConfirmAction": "Restore",
  "sch.restoredToast": "Restored — open a new terminal window for it to take effect",
  "sch.restoreFailedTitle": "Restore Failed",
  "sch.deleteConfirmTitle": "Delete this history entry?",
  "sch.deleteConfirmMessage": "Only the entry {filename} is deleted; your current Shell config is untouched.",
  "sch.deletedToast": "History entry deleted",
  "sch.actionCopy": "Copy This Config",
  "sch.actionCleanup": "Clean Up Old Entries",
  "sch.cleanupUnit": "history entries",
  "sch.cleanupDescription":
    "Only Shell config history entries are deleted. Your current Shell config and the project snapshots are untouched.",
  "sch.focusNavTitle": "History of {name}",
  "sch.focusSectionTitle": "History - {name}",
  "sch.focusEmptyTitle": "No changes recorded for this snippet yet",
  "sch.focusEmptyDesc": "From the next edit on, every change to this snippet shows up here",
  "sch.focusAbsent": "This snippet did not exist in this version yet",
  "sch.focusUnchanged": "This snippet did not change",
  "sch.focusActionRestore": "Restore Whole Config to This Version",
  "sch.focusRestoreOnlyThis":
    'This restores the whole Shell config, not just "{name}". In this version every other snippet matches what you have now, so only "{name}" changes. Open a new terminal window for it to take effect.',
  "sch.focusRestoreAlsoAffects":
    'This restores the whole Shell config, not just "{name}". These {count} snippets go back to this version too: {others}. Open a new terminal window for it to take effect.',
  "st.detailOrder": "Position",
  "st.detailOrderValue": "{index} of {total}",
  "st.bootstrapSection": "Shell Integration",
  "st.bootstrapReadyTitle": "✅ Shell Integration Enabled",
  "st.bootstrapReadySubtitle": "Found the matching config in {file} — new/edited snippets sync automatically",
  "st.bootstrapPendingTitle": "One step left: enable Shell integration",
  "st.bootstrapUnknownTitle":
    "Couldn't detect zsh/bash — please manually add this line to the end of your shell config file:",
  "st.bootstrapLearnMore": "Learn More",
  "st.copySourceCommand": "Copy This Line",
  "st.actionEnableIntegration": "Enable Shell Integration (Write to {file})",
  "st.enableConfirmTitle": "Enable Shell integration?",
  "st.enableConfirmMessage":
    'Env Butler will append this line to the end of {file}:\n\n{sourceLine}\n\nIt won\'t touch anything you already have there, and you can always run "Disable Shell Integration" again to remove it. Write it now?',
  "st.enableConfirmAction": "Write",
  "st.enabledIntegrationToast": "Shell integration enabled — open a new terminal window for it to take effect",
  "st.enableFailedTitle": "Enable Failed",
  "st.actionDisableIntegration": "Disable Shell Integration (Remove from {file})",
  "st.disableConfirmTitle": "Disable Shell integration?",
  "st.disableConfirmMessage":
    "This removes the line Env Butler wrote to {file}:\n\n{sourceLine}\n\nNew terminal windows will stop loading the variables/aliases/snippets from your Shell track (already-open windows are unaffected). Remove it?",
  "st.disableConfirmAction": "Remove",
  "st.disabledIntegrationToast": "Removed from {file} — Shell integration disabled",
  "st.disableFailedTitle": "Disable Failed",
  "st.bootstrapDetailMarkdown": `# Why is this step needed?

Env Butler compiles the global environment variables, aliases, and snippets you've added (and enabled) in the Shell track into one file:

\`\`\`
{sourceLine}
\`\`\`

But this file doesn't take effect on its own — zsh/bash only read your config file (e.g. \`~/.zshrc\`) when a terminal starts; they won't look for the file Env Butler generates on their own. So one line needs to be added to the end of your config file telling your shell to "also read this file on startup".

## How to enable it

Same logic as enabling/disabling a snippet — either works:

- **Enable Shell Integration** (recommended): Env Butler appends the line for you, without touching anything else already in **{file}**.
- **Copy This Line**: copy it and paste it into **{file}** yourself if you'd rather do it by hand.

## Changed your mind?

Once enabled, this notice switches to "✅ Shell Integration Enabled" and a **Disable Shell Integration** action appears — it cleanly removes the line Env Butler added from {file}, without touching anything else, and you can re-enable it anytime.

## After enabling it

Open a new terminal window (or run \`source {rcPath}\`) and your snippets will take effect. From then on, whenever you add/edit/remove snippets in the Shell track, Env Butler regenerates this file automatically — no need to repeat this step.

## How do I know if it's enabled?

Every time you open this view, Env Butler checks whether {file} already contains this line — once it does, this notice automatically switches to "✅ Shell Integration Enabled" and won't nag you again.`,
  "st.actionNewSnippet": "New Shell Snippet",
  "st.sectionExports": "Environment Variables (export)",
  "st.sectionAliases": "Aliases",
  "st.sectionOthers": "General Snippets",
  "st.emptyTitle": "No Shell Snippets Yet",
  "st.emptyDesc": "Press Enter or ⌘N to add your first global env var, alias, or shell snippet",
  "st.actionDisable": "Disable Snippet",
  "st.actionEnable": "Enable Snippet",
  "st.actionEdit": "Edit Snippet",
  "st.actionNew": "New Snippet",
  "st.actionCopyContent": "Copy Snippet Code",
  "st.actionDelete": "Delete Snippet",
  "st.deleteConfirmTitle": "Delete Snippet: {name}",
  "st.deleteConfirmMessage": "Are you sure you want to remove this snippet?",
  "st.enabledTag": "Active",
  "st.disabledTag": "Disabled",
  "st.detailHeading": "### Snippet Info",
  "st.detailType": "Type",
  "st.detailStatus": "Status",
  "st.detailDescription": "Description",
  "st.detailNone": "(none)",

  "es.nameEmptyError": "Snippet name cannot be empty",
  "es.contentEmptyError": "Snippet content cannot be empty",
  "es.syntaxFailedTitle": "Shell Syntax Check Failed ({shell} -n)",
  "es.lintConfirmTitle": "These lines look like typos",
  "es.lintMisspelled": "Line {line}: did you mean {suggestion} instead of {word}?",
  "es.lintUnknownPrefix": "Line {line}: {word} does not look like a command — this line will not take effect",
  "es.lintFixAction": "Go Back and Fix",
  "es.lintIgnoreAction": "It Is Correct, Save",
  "es.nameTitle": "Snippet Name",
  "es.namePlaceholder": "e.g. JAVA_HOME or git-status-alias",
  "es.typeTitle": "Snippet Type",
  "es.typeExport": "Env Variable (export)",
  "es.typeAlias": "Alias (alias)",
  "es.typeSnippet": "Snippet (no content restrictions)",
  "es.contentTitle": "Shell Code",
  "es.exportMismatchHint":
    "⚠️ This doesn't start with export. If it's not setting an environment variable, consider switching to the \"Snippet\" type — just a hint, it won't block saving.",
  "es.aliasMismatchHint":
    "⚠️ This doesn't start with alias. If it's not defining a command alias, consider switching to the \"Snippet\" type — just a hint, it won't block saving.",
  "es.descTitle": "Description (optional)",
  "es.descPlaceholder": "Briefly describe what this snippet does",
  "es.enabledLabel": "Enable this snippet (generated into ~/.env-butler/shell.sh)",
  "es.submitTitle": "Save Snippet",

  "sh.searchPlaceholder": "Search snapshot history...",
  "sh.sectionTitle": "Snapshot History - {file}",
  "sh.sectionSubtitle": "{count} backup(s)",
  "sh.sizeAccessory": "{size} KB",
  "sh.actionRestore": "Restore This Version",
  "sh.actionCopyContent": "Copy Snapshot Content",
  "sh.actionDelete": "Delete This Snapshot",
  "sh.actionCleanup": "Clean Up Old Snapshots",
  "sh.cleanupNavTitle": "Clean Up Old Snapshots",
  "sh.cleanupDescription":
    "Only snapshots of {file} are affected — other environment files and {file} itself are untouched.",
  "sh.cleanupKeepTitle": "How many to keep",
  "sh.cleanupKeepPlaceholder": "Choose how many to keep",
  "sh.cleanupKeepOption": "Keep the {count} most recent",
  "sh.cleanupKeepNone": "Delete all of them",
  "sh.cleanupPreview": "{total} in total — this deletes {count} of them",
  "sh.cleanupNothing": "{total} in total — nothing to delete with this setting",
  "sh.cleanupSubmit": "Delete",
  "sh.cleanupConfirmTitle": "Delete {count} {unit}?",
  "sh.cleanupUnit": "snapshots",
  "sh.cleanupConfirmMessage": "There is no way to get them back. The remaining {kept} are untouched.",
  "sh.cleanupDoneToast": "Deleted {count} {unit}",
  "sh.restoreConfirmTitle": "Restore Snapshot: {timestamp}",
  "sh.restoreConfirmMessage":
    "Are you sure you want to restore {file} to this historical version? The current file will be backed up automatically before restoring, so nothing is ever lost.",
  "sh.restoreConfirmAction": "Restore Now",
  "sh.restoredToast": "Snapshot restored successfully",
  "sh.restoreFailedTitle": "Restore Failed",
  "sh.restoreErrorTitle": "Restore Error",
  "sh.deleteConfirmTitle": "Delete Snapshot",
  "sh.deleteConfirmMessage": "Are you sure you want to permanently delete snapshot {filename}?",
  "sh.deletedToast": "Snapshot deleted",
  "sh.unreadableContent": "(Unable to read snapshot content)",
  "sh.emptyTitle": "No Snapshots Yet",
  "sh.emptyDesc":
    "A snapshot is automatically kept the first time you edit and save environment variables in Env Butler.",
  "sh.infoHeading": "Snapshot Info",
  "sh.infoTargetFile": "Target File",
  "sh.infoRecordedAt": "Recorded At",
  "sh.infoFileSize": "File Size",
  "sh.contentHeading": "Snapshot Content",
  "sh.contentEmpty": "(empty file)",

  "search.placeholder": "Search names and values across all projects and the Shell track...",
  "search.loadFailedTitle": "Failed to Load Variables",
  "search.sectionTitle": "Matches",
  "search.sectionShell": "Shell Track",
  "search.shellSource": "Shell Track / {name}",
  "search.actionGotoShell": "Open in Shell Track",
  "search.sectionSubtitle": "{count} variable(s)",
  "search.actionGoto": "Go to Project Details",
  "search.actionHide": "Hide Plain Value",
  "search.actionReveal": "Show Plain Value",
  "search.actionCopyValue": "Copy Value",
  "search.actionCopyKey": "Copy Key",
  "search.lockTooltip": "Sensitive field",
  "search.emptyTitle": "No Matching Variables",
  "search.emptyDesc": "Try a different keyword, or register a new project in Manage Envs",

  // ---- Diff sections (shared by .env snapshots and Shell config history) ----
  "diff.fromPrevHeading": "Previous version → this one",
  "diff.fromPrevHint": "what this save actually changed",
  "diff.toCurrentHeading": "This version → current",
  "diff.toCurrentHint": "what happened between this entry and now",
  "diff.noPrev": "This is the earliest entry — there is nothing older to compare with",
  "diff.none": "No differences at all",
  "diff.added": "🟢 Added",
  "diff.removed": "🔴 Removed",
  "diff.changed": "🟡 Changed",
  "diff.originalValue": "was",
  "diff.addedDisabled": "(added already commented out)",
  "diff.turnedOff": "commented out, no longer in effect",
  "diff.turnedOn": "uncommented, in effect again",
  "diff.renamed": "(previously {name})",

  // ---- .zshrc backups ----
  "rcb.navTitle": "Backups of {file}",
  "rcb.searchPlaceholder": "Search backups...",
  "rcb.sectionTitle": "Backup files",
  "rcb.sectionSubtitle": "{count} file(s)",
  "rcb.emptyTitle": "No backups yet",
  "rcb.emptyDesc":
    "A copy of {file} is saved automatically when you enable or remove the Shell integration — or make one now",
  "rcb.infoHeading": "This backup",
  "rcb.infoOrigin": "Original file",
  "rcb.infoRecordedAt": "Backed up at",
  "rcb.infoFileSize": "Size",
  "rcb.contentHeading": "Backup content",
  "rcb.contentEmpty": "(empty file)",
  "rcb.unreadable": "This backup cannot be read — the file may be damaged",
  "rcb.actionBackupNow": "Back Up {file} Now",
  "rcb.actionBackupTo": "Back Up To Another Location...",
  "rcb.actionRestore": "Overwrite {file} With This Backup",
  "rcb.actionShowInFinder": "Show This Backup in Finder",
  "rcb.actionDelete": "Delete This Backup",
  "rcb.backupToNavTitle": "Back up to another location",
  "rcb.backupToDescription":
    "Copies {file} as-is. With no folder chosen it goes to Env Butler's own backup folder: {dir}",
  "rcb.backupToDirTitle": "Save to",
  "rcb.backupToDirInfo": "Leave empty to use the default backup folder",
  "rcb.backupSubmit": "Back Up",
  "rcb.backedUpToast": "Backed up",
  "rcb.backupFailedTitle": "Backup failed",
  "rcb.restoreConfirmTitle": "Overwrite with the backup from {time}?",
  "rcb.restoreConfirmMessage":
    "{file} will be replaced entirely by this backup. The current content is saved as another backup first, so this step is reversible too. Open a new terminal window for it to take effect.",
  "rcb.restoreConfirmAction": "Overwrite",
  "rcb.restoredToast": "{file} restored — open a new terminal window for it to take effect",
  "rcb.restoredSafetyNote": "The previous content was saved to {path}",
  "rcb.restoreFailedTitle": "Restore failed",
  "rcb.deleteConfirmTitle": "Delete this backup?",
  "rcb.deleteConfirmMessage": "This cannot be undone: {filename}",
  "rcb.deletedToast": "Backup deleted",
};

const dicts: Record<Lang, Record<DictKey, string>> = { zh, en };

export function getLang(): Lang {
  try {
    const prefs = getPreferenceValues<{ language?: string }>();
    return prefs.language === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

/**
 * 取词函数。vars 里的 {key} 占位符会被替换成对应的值。
 */
export function t(key: DictKey, vars?: Record<string, string | number>): string {
  const lang = getLang();
  let str = dicts[lang][key] ?? dicts.zh[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}

/**
 * 快照份数超过软上限时的提示语；没超过返回 undefined，调用方可以直接塞进 toast 的 message。
 * 参数只声明结构上需要的三个字段，不 import 存储层的类型，避免界面文案层反过来依赖服务层。
 */
export function snapshotLimitHint(result: {
  snapshotLimitExceeded?: boolean;
  snapshotCount?: number;
  snapshotLimit?: number;
}): string | undefined {
  if (!result.snapshotLimitExceeded) return undefined;
  return t("common.snapshotLimitMessage", {
    count: result.snapshotCount ?? 0,
    limit: result.snapshotLimit ?? 0,
  });
}
