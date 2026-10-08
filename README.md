# MarkFlow

[产品文档](https://yeyongzhi.github.io/MarkFlow/) · [下载安装包](https://github.com/yeyongzhi/MarkFlow/releases) · [反馈问题](https://github.com/yeyongzhi/MarkFlow/issues)

本地 Markdown 编辑器，使用 Tauri 2、Vue 3、TypeScript、Vite、Tailwind CSS 4 和 shadcn-vue。文档直接保存在所选工作区的真实 `.md` 文件中。

## 当前功能

- 多工作区、按需加载的文件树、多标签页。
- 所见即所得、源码、左右分屏、只读预览；H1–H6 大纲与跳转。
- CommonMark 基础语法和 GFM 表格、任务列表、删除线、自动链接。
- 自动保存、手动保存、外部修改冲突提示、备份后覆盖、草稿恢复、另存副本。
- 文件 / 文件夹新建、重命名、同工作区移动；文档归档到各工作区的回收站，支持恢复与彻底删除，文件夹仍移到系统回收站。
- 文档标签保存在 YAML front-matter，路径旁显示；文档设置支持标签增删改及正文行高。
- 图片粘贴和拖入，附件落盘到工作区 `assets/`，Markdown 使用相对路径。
- 文章工具栏支持选择本地图片插入；点击图片可替换、编辑描述、复制路径、打开所在目录和删除当前引用，双击可查看大图并缩放。失效图片保留路径，可在编辑视图重新选择图片修复；删除引用会保留附件文件。
- 主题色、亮色 / 暗色 / 系统模式、正文与源码字体字号、默认视图；设置与标签会话持久化。
- 设置采用左侧分类导航，分为通用、外观、排版、保存与备份、写作、工具栏、桌面与更新、标签管理、快捷键和关于；正文默认使用约 760px 的标准模式，也可选择铺满内容区的超宽模式，四种视图均支持。

- 当前文档查找替换（大小写、正则）、多工作区全文搜索、文件名快速打开。
- 专注模式、分屏同步滚动、表格行列编辑、代码块语言选择与选中文字统计。
- PDF、独立 HTML、Markdown 与图片 ZIP 导出；PDF 支持纸张、边距、字体字号和页码。
- 目录分批显示、后台标签资源释放、大纲与字词统计线程化、窗口大小与位置恢复。

顶部菜单提供文件、编辑、段落、视图、导出和帮助入口；右上角可搜索命令、切换主题和打开设置。Ctrl / Cmd + K 打开命令搜索。格式工具栏与视图切换共用一行，小窗口通过“文本格式”菜单操作；文章工具栏右侧保留“更多文章操作”。

| 快捷键 | 操作 |
| --- | --- |
| Ctrl / Cmd + K | 搜索并执行命令 |
| Ctrl / Cmd + F | 当前文档查找与替换 |
| Ctrl / Cmd + Shift + F | 工作区全文搜索 |
| Ctrl / Cmd + P | 按文件名和路径模糊快速打开 |
| Ctrl / Cmd + Shift + T | 重新打开关闭的标签 |
| Alt + ← / → | 导航后退 / 前进 |
| Alt + ↑ / ↓ | 移动段落、列表项或章节 |
| Ctrl / Cmd + Z / Shift + Z | 跨视图统一撤销 / 重做 |
| Ctrl / Cmd + Shift + Enter | 切换专注模式 |
| Esc | 退出专注模式 / 关闭当前弹窗 |

PDF 采用高清图像分页，保留中文排版，文字不能选中复制；HTML 可以复制文字，图片内嵌且不依赖工作区。历史版本支持快照预览、比较和恢复；附件集中管理界面暂缓。

Windows 已完成真实 Tauri/WebView2 集成验证。macOS 已配置构建，尚未在真实 Mac 上验收。具体结果见 [验证记录](docs/verification.md)。

## 本轮功能入口

- 文件菜单：独立文件、最近与收藏、历史版本、编码与换行格式、工作区备份与操作恢复。
- 文件树：单击直接打开并保留标签；文件菜单和文章操作可收藏/取消收藏；标签支持拖动排序、右键固定、关闭其他及重新打开，长名称保留 .md 后缀。
- 工作区标题旁提供搜索、刷新、添加图标；最近/收藏在侧栏内切换滚动列表。定位图标展开文件树并滚动到当前文档；文件树展示全部工作区，展开状态跨启动保留。
- 写作：空行输入 / 打开插入菜单；新建文档选择日记、会议记录、项目笔记或自定义模板；编辑菜单提供整理预览。
- 设置 → 保存与备份：自动保存延迟、失焦保存、关闭保存、历史保留数量、备份目录和运行期间的定时备份。
- 设置 → 写作：打字机滚动、位置、语法辅助、斜杠命令、自动定位和自定义模板。
- 设置 → 外观 / 工具栏：简洁、柔和、毛玻璃三种材质；圆角与模糊强度、密度、自定义背景与文字、代码主题、按钮顺序和隐藏；颜色对比不足时保护文字可读性。
- 设置 → 桌面与更新：关闭到托盘、手动检查发布信息。关闭和退出均经过内容保护。
- 删除文件/目录、批量标签、编码转换、丢弃恢复草稿产生可恢复材料；恢复前检查目标，不覆盖随后产生的修改。
- UTF-8、UTF-8 BOM、UTF-16LE/BE BOM 和 LF/CRLF 可检测、保留与显式转换。无 BOM 的旧式编码不会猜测转换。

更新入口默认离线。发布者需提供 HTTPS JSON 清单，例如：

    {"version":"0.2.0","notes":"本次更新内容","url":"https://example.com/MarkFlow-0.2.0-setup.exe"}

发现新版本后显示说明，由用户打开下载页面选择安装时机；当前没有自动下载或静默安装。未配置发布服务时会明确提示。

详细范围与验证见 [本轮验收清单](docs/roadmap-implementation.md)。

## 启动开发

需要 Node.js 24、pnpm 12 和 Rust stable。Windows 需要 MSVC C++ 构建工具、Windows SDK 与 WebView2；macOS 需要 Xcode Command Line Tools。平台环境安装参考 [Tauri 官方前置条件](https://v2.tauri.app/start/prerequisites/)。

```sh
pnpm install --frozen-lockfile
pnpm tauri:dev
```

这会启动桌面应用及 Vite 服务。进入应用后，点击“添加工作区”并选择真实笔记目录。

```sh
pnpm dev
```

单独启动 Web 页面时使用内存示例文件，并显示“浏览器预览 · 示例数据”。浏览器预览不接管本地文件，刷新后示例正文会重置。

## 构建与检查

```sh
pnpm typecheck
pnpm test
# 启动开发服务后，可运行交互验证
node scripts/verify-ui.mjs
node scripts/verify-productivity.mjs
node scripts/verify-performance.mjs
node scripts/verify-native.mjs
node scripts/verify-archive-tags.mjs
cargo test --manifest-path src-tauri/Cargo.toml --lib
pnpm build
```

Windows 安装包：

```sh
pnpm tauri build --bundles nsis
```

输出为 `src-tauri/target/release/markflow.exe` 和 `src-tauri/target/release/bundle/nsis/MarkFlow_0.1.0_x64-setup.exe`。应用本体包含编辑器离线资源；安装时若系统尚无 WebView2，默认安装流程会下载运行时。安装向导以当前用户权限运行，可自选目录（例如 `D:\Program\MarkFlow`），应用数据默认写入该目录下的 `data\`。卸载仅在勾选“删除应用数据”时清空 `data\`，否则设置与历史版本保留以便重装。当前安装包没有代码签名。

macOS 在 Mac 上构建：

```sh
pnpm tauri build --bundles app,dmg
```

默认构建当前机器架构，最低系统配置为 macOS 12。仓库包含 Windows x64、macOS Apple Silicon 与 Intel 的 GitHub Actions 构建工作流，上传安装包为运行产物，不自动发布 Release。Mac 产物、签名与公证尚未实际验证。构建规则参考 [Tauri 配置](https://v2.tauri.app/reference/config/) 和 [官方构建 Action](https://github.com/tauri-apps/tauri-action)。

Windows UI 自动化检查（先保持 `pnpm dev` 运行）：

```sh
node scripts/verify-ui.mjs
cargo build --manifest-path src-tauri/Cargo.toml
node scripts/verify-native.mjs
node scripts/verify-release.mjs
```

脚本使用已安装的 Edge。原生检查在 `artifacts/` 中创建隔离工作区及应用配置，仅将其中一个测试文件送入系统回收站，不读取个人笔记。

## 文件与保存规则

正文只通过 Rust 文件服务读写；设置项、标签注册表、最近与收藏列表、恢复草稿、历史版本和工作区注册表存放在数据目录，设置为纯 JSON 文件，可在 设置 → 安全 → 数据目录 查看路径并直接打开。Windows 安装包版把数据目录放在程序同级的 `data\`（例如 `D:\Program\MarkFlow\data\`，WebView2 缓存一并放在 `data\webview\`）；该目录不可写、或 macOS 构建时，回退到 `%LOCALAPPDATA%\com.lexly.editor\` / `~/Library/Application Support/com.lexly.editor/`。首次在新位置启动会把旧目录的配置、草稿、历史和备份复制过去，原目录保持不动，复制结果记录在 `data\migration.json`。调试与自动化检查用 `LEXLY_DATA_DIR`（或 debug 专用的 `LEXLY_DEV_DATA_DIR`）指定数据目录。

停止输入约 500ms 后保存，持续输入时约 2s 提交一次。保存按文档排队，使用 SHA-256 检查磁盘版本，经同目录临时文件替换原文件。原文件的 UTF-8 BOM 和 CRLF/LF 风格会保留。外部改写或删除时暂停自动保存并保留编辑缓冲。

恢复区约在输入后 200ms 写入；异常退出可以找回最近成功落盘的草稿。正常退出遇到未保存内容时，用户可取消退出，或完成草稿持久化后退出。

仅打开、切换视图或阅读不会改写原文件。所见即所得发生实际编辑后，内核可能规范化 Markdown 空格、列表和链接等写法；需要保持原始排版时使用源码视图。

支持 UTF-8 与带 BOM 的 UTF-16 文档，单篇文档和单张图片上限 20MiB，图片支持 PNG、JPEG、GIF、WebP。默认不加载远程图片，不跟随符号链接 / 目录联接。移动只自动修正被移动文档指向根目录 `assets/` 的附件引用；其他相对链接和入站链接需要自行检查。

## 项目结构

```text
src/App.vue                  工作台、标签、菜单、弹窗和快捷键
src/components/EditorPane.vue 四视图、图片导入与大纲定位
src/components/TreeNode.vue   递归文件树
src/components/ui/           shadcn-vue 组件源码
src/stores/workbench.ts      文档状态、保存排队、恢复与设置
src/services/                桌面 IPC、示例数据、Markdown 渲染
src-tauri/src/lib.rs         工作区、文件操作、附件及原生集成
src-tauri/src/files.rs       路径边界、编码、原子替换与冲突检查
scripts/                    编辑器离线资源及 UI / 原生验证
tests/                      保存协调和恢复测试
docs/                       产品需求、实现架构、验证记录
```

详细需求见 [项目说明书](docs/project-guide.md)，实现细节见 [技术开发说明书](docs/technical-design.md)。

## 版本与公开发布

见 [发布指南](docs/releasing.md) 与 [发布审查](docs/release-audit.md)。`pnpm version:check` 检查版本一致性，`pnpm version:set 0.2.0` 同步版本；推送匹配版本的 `v*` 标签会构建 Windows 安装包并创建 Release 草稿，验收后手动发布。

## 产品文档站

源码位于 `website/`。运行 `pnpm docs:dev` 本地查看，`pnpm docs:build` 生成静态站点。main 分支通过 GitHub Actions 部署 Pages，dev 和 PR 只验证构建。仓库 Settings → Pages 的 Source 需选择 GitHub Actions。

产品名称已改为 MarkFlow。内部应用标识 `com.lexly.editor` 和既有数据键保留，以兼容早期配置和历史记录。
