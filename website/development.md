# 开发与发布

## 本地运行

需要 Node.js 24、pnpm 12、Rust stable，Windows 还需要 MSVC 构建工具、Windows SDK 和 WebView2。

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
pnpm version:set 0.2.0
pnpm typecheck
pnpm test
pnpm build
pnpm docs:build
```

版本同时维护前端、Tauri、Rust 和 Cargo 锁文件。更新根目录 CHANGELOG.md 后提交，再创建匹配的 `v*` 标签。GitHub Actions 构建 Windows Release 草稿；安装验收后由维护者公开发布。

## GitHub Pages

在仓库 Settings → Pages 中选择 GitHub Actions。工作流构建 `website`，并部署到 `https://yeyongzhi.github.io/MarkFlow/`。站点资源基路径为 `/MarkFlow/`。

许可证尚未确定。发布准备、签名和安装验收见仓库中的 `docs/releasing.md`。
