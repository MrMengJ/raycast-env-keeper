# Env Butler

在 Raycast 里管理所有项目的 `.env` 文件和全局 shell 配置。**本地、免费、键盘优先。**

> 名字来自 butler(管家):`.env` 文件是主人的,扩展只管递取、登记、看守,自己不存数据。

## 它解决什么

`.env` 散落在各个项目里,全局环境变量藏在 `~/.zshrc` 里。想看某个密钥在哪个项目配过、
想临时停用一个变量、想给团队生成一份 `.env.example`——都得手动翻文件。
Env Butler 把这些事收进一个键盘驱动的面板。

## 三个卖点

- **敏感值默认打码** —— 列表里只显示 `••••••••`,需要时一键揭示;复制密钥不进剪贴板历史
- **每次修改前自动快照** —— `.env` 不进 git 也有完整历史,随时回滚
- **一键生成 `.env.example`** —— 而且是**合并**式更新,不会冲掉模板里手写的说明

## 两个命令

| 命令 | 做什么 |
|---|---|
| **Manage Envs** | 项目环境:登记项目、管理各环境的变量、快照与恢复、生成 `.env.example`<br>全局环境:管理 shell 的全局变量 / alias / 脚本片段,生成 `~/.env-butler/shell.sh` |
| **Search Env Vars** | 跨所有项目、方案和全局环境搜变量名 / 变量值 |
| **Jump to** | 按名字直达某个项目、环境文件、方案或 Shell 片段;片段可以就地启用 / 停用 |

## 核心设计:文件就是真相源

扩展**不存环境数据**。项目环境直接编辑项目目录下的 `.env` 文件——没有第二份副本,
所以它天然和 git、同事、Vite、Docker 共存。

打开时记下文件指纹,保存前再摸一次:文件被外部改过就弹窗让你裁决,而不是默默覆盖。

扩展自己的数据都在 `~/.env-butler/`,全透明:

```
~/.env-butler/
├── registry.json       # 项目注册表
├── shell.json          # Shell 片段
├── shell.sh            # 由 shell.json 生成,被 .zshrc source
├── snapshots/          # 各项目 .env 的历史
├── config-history/     # 上面两个配置文件自己的历史
└── backups/            # 改 .zshrc 之前的备份
```

**换机器 = 拷这个目录。**

## 安全边界(请务必知道)

- 打码**只影响显示**。`.env` 和 `shell.sh` 里必须是明文,否则程序和 shell 读不到。
  它防的是别人瞄到你的屏幕,不是防文件被读走
- 扩展**不做加密**。要加密请用 [dotenvx](https://dotenvx.com);Env Butler 能识别
  `encrypted:` 前缀并阻止你误改
- 扩展**绝不读取或修改 `.envrc`**,只会在检测到时提醒你 direnv 的存在

## 兼容性

- macOS,shell 为 zsh 或 bash(会探测你真实的登录 shell 决定改 `~/.zshrc` 还是 `~/.bash_profile`)
- 用 fish 等其他 shell 时,shell 语法校验会自动跳过,不阻断保存
- `.env` 行内注释的解析规则与 `dotenv` 一致,保证界面显示的值 == 程序拿到的值

## 界面语言

扩展偏好设置里可切换中文 / English。
