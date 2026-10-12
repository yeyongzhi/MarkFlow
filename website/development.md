# 开发与发布

## 本地运行

需要 Node.js 24、pnpm 12、Rust 1.90 或以上，Windows 还需要 MSVC 构建工具、Windows SDK 和 WebView2。

```sh
pnpm install --frozen-lockfile
pnpm tauri:dev
```

独立运行文档站：

```sh
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

## 分支和版本

`dev` 用于开发，`main` 用于准备公开发布。完成检查后将 dev 合并到 main；站点从 main 部署。

```sh
pnpm version:check
pnpm version:set 0.1.0-beta.1
pnpm typecheck
pnpm test
pnpm build
pnpm docs:build
```

版本同时维护前端、Tauri、Rust 和 Cargo 锁文件。更新根目录 CHANGELOG.md 后提交，再创建匹配的 `v*` 标签。GitHub Actions 构建 Windows Release 草稿；安装验收后由维护者公开发布。

## GitHub Pages

在仓库 Settings → Pages 中选择 GitHub Actions。工作流构建 `website`，并部署到 `https://yeyongzhi.github.io/MarkFlow/`。站点资源基路径为 `/MarkFlow/`。

许可证尚未确定。发布准备、签名和安装验收见仓库中的 `docs/releasing.md`。

更新接入（2026-10-08）：应用内检查后下载并安装签名更新，安装前两次同步/保存文档与会话；签名验证失败或保存冲突时阻止安装。版本标签工作流生成安装包签名与 latest.json，公开 Release 后更新源才可访问。本地执行 pnpm release:build 使用 .local/updater.key。私钥须保管和备份，不能提交 Git，不能随意换钥，否则旧版无法验证新版。普通 CI 使用 tauri.ci.conf.json 关闭签名产物，正式发布必须签名。更新实际安装未自动执行，避免中断当前应用；首次跨版本升级仍需隔离环境验收。
