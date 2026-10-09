# 版本与发布指南

更新日期：2026-10-08。当前版本 0.1.0 尚未公开发布。当前目录已初始化 Git，origin 绑定 https://github.com/yeyongzhi/MarkFlow.git；本次只准备本地文件，没有创建 GitHub 仓库或发布 Release。

## 安装和数据位置

Windows 使用 NSIS 当前用户安装包，可在向导选择 `D:\Program\MarkFlow` 等有写入权限的目录。请使用应用独立子目录，而不是把程序直接放在 `D:\Program` 根目录。

| 内容 | 正式版 Windows 默认位置 |
| --- | --- |
| 程序 | `<安装目录>\lexly.exe` |
| 设置 / 最近 / 收藏 / 标签会话 | `<安装目录>\data\preferences.json` |
| 工作区登记 / 窗口状态 / 锁屏密码哈希 | `data\workspaces.json` / `window.json` / `privacy.json` |
| 草稿 / 历史 / 操作备份 / 工作区备份 | `data\recovery` / `history` / `operations` / `workspace-backups` 等 |
| WebView2 浏览器配置和缓存 | `data\webview` |
| Markdown 正文和附件 | 用户选择的工作区；不会自动移动到安装目录 |

例：安装在 `D:\Program\MarkFlow`，设置就在 `D:\Program\MarkFlow\data`。安装目录无法创建文件时，应用配置回退到 `%LOCALAPPDATA%\com.lexly.editor`。开发版通常使用此 AppData 路径；macOS 使用 `~/Library/Application Support/com.lexly.editor`。系统运行时、安装器临时文件和注册表不由这项设置统一搬到 D 盘。

`LEXLY_DATA_DIR` 环境变量优先于默认位置；调试版还支持 `LEXLY_DEV_DATA_DIR`。外部设置的 `WEBVIEW2_USER_DATA_FOLDER` 可覆盖浏览器缓存位置。自定义工作区备份目录也可改变备份落点。实际路径以设置 → 保存与备份 → 数据目录为准。

旧 AppData 中的配置会在满足迁移条件时复制到新目录，原目录保留。普通卸载保留安装目录下的 data；勾选“删除应用数据”时自定义卸载钩子会删除它。更换安装目录不会自动搬迁另一个安装目录的 data，需退出程序后手动备份/迁移。共享安装目录也意味着共享配置，不适合多个 Windows 用户共用。

## 日常版本管理

`package.json` 是版本入口；设置“关于”页从它读取版本。脚本同步 `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 `src-tauri/Cargo.lock`，检查失败时 CI 不继续构建。

```sh
pnpm version:check
pnpm version:set 0.2.0
pnpm version:check
```

修复递增 patch（0.1.1）；新增兼容功能递增 minor（0.2.0）；不兼容变更需要单独记录，1.0 之后递增 major。测试发布可用 `0.2.0-beta.1`。同一公开版本不重新替换安装包，修复后发新版本。

每个版本更新根目录 `CHANGELOG.md`，记录行为变化、修复和影响配置/文档的兼容性事项。保持 `com.lexly.editor` 标识稳定，否则默认数据目录等行为会变化。

## GitHub 首次准备

1. 确定公开仓库地址和许可证。暂未选择许可证，因此当前没有 LICENSE；公开可见不等于授予他人使用、修改或分发的开源许可。
2. 初始化 Git，检查所有待提交文件。提交源码、两个依赖锁文件、工作流和文档；排除 `node_modules`、`.cache`、`dist`、`src-tauri/target`、`artifacts`、运行数据和密钥。
3. 检查文档中的本机路径、姓名、截图以及历史提交中的私人信息。`.gitignore` 只能防止新文件被加入，不能清理已有历史。
4. 创建 public 仓库并推送 main。在 GitHub 检查 Actions 能够运行，Release 工作流有写入 contents 的权限；无需存储个人 token。
5. 先观察 Check and build desktop applications 的实际运行结果。macOS 两种架构已有构建配置，但本次不宣称已验收，首版 Release 自动流程仅发布 Windows x64。

## 发布

完成类型检查、测试、原生检查、构建和安装验收后，提交版本与变更记录，再创建匹配标签：

```sh
git tag -a v0.1.0 -m "MarkFlow 0.1.0"
git push origin v0.1.0
```

`.github/workflows/release.yml` 会检查 tag 与全部版本源一致，执行前端和 Rust 测试，构建 NSIS，创建 **Release 草稿**，上传安装包与 `SHA256SUMS.txt`。带 `-` 的版本标记为 prerelease。草稿不会成为公众可下载的正式发布；检查资产和说明后在 GitHub 手动 Publish release。实际工作流仍需首次推送后验证。

发布前在隔离环境人工验收：选择 D 盘目录安装；启动、写入设置并重启；从上一版本覆盖升级且数据保留；普通卸载和删除数据卸载分别检查；无 WebView2 机器检查运行时安装。请使用测试笔记。

当前没有 Windows 代码签名和 macOS 签名/公证，正式分发前需决定是否配置。首次使用安装器时若缺少 WebView2 会下载运行时，应用资源离线不等于安装过程完全离线。

## 应用内更新

当前已内置 https://api.github.com/repos/yeyongzhi/MarkFlow/releases/latest。用户无需填写地址；点击检查时联网，无公开正式版本时显示提示。公开 Release 的 tag 必须为 SemVer（例如 v0.2.0）；不采纳草稿或预发布。

发现新版本后，可在应用内下载并安装。已接入 Tauri updater 和更新签名。公钥随应用打包，私钥仅存于本地 .local/updater.key（已忽略）。首次远端发布前，维护者需将该私钥内容配置为 TAURI_SIGNING_PRIVATE_KEY Secret；当前私钥无密码，TAURI_SIGNING_PRIVATE_KEY_PASSWORD 留空。更新签名与 Windows Authenticode 代码签名是两套机制。

参考：[Tauri Windows 安装器](https://v2.tauri.app/distribute/windows-installer/)、[Tauri 构建与 Release Action](https://github.com/tauri-apps/tauri-action)。

产品名称已改为 MarkFlow，可执行文件为 markflow.exe。内部标识 com.lexly.editor 和数据键保留以兼容早期配置。website/ 为产品站源码，main 配置部署 Pages，dev/PR 只验证构建。本次仅本地准备，未推送分支或标签。

更新接入（2026-10-08）：应用内检查后下载并安装签名更新，安装前两次同步/保存文档与会话；签名验证失败或保存冲突时阻止安装。版本标签工作流生成安装包签名与 latest.json，公开 Release 后更新源才可访问。本地执行 pnpm release:build 使用 .local/updater.key。私钥须保管和备份，不能提交 Git，不能随意换钥，否则旧版无法验证新版。普通 CI 使用 tauri.ci.conf.json 关闭签名产物，正式发布必须签名。更新实际安装未自动执行，避免中断当前应用；首次跨版本升级仍需隔离环境验收。
