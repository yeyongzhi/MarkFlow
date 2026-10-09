# 下载与安装

安装包通过 GitHub Releases 分发。请从发布页选择适合系统的附件，核对版本说明。

[前往 MarkFlow 发布页 →](https://github.com/yeyongzhi/MarkFlow/releases)

::: info 首次发布
当前项目正在准备首版发布。若发布页尚无安装包，请等待维护者发布 Release；仓库源码和 Actions 构建产物不等同于已验收的正式版本。
:::

## Windows

首版发布流程面向 **Windows x64**，安装文件名类似 `MarkFlow_0.1.0_x64-setup.exe`。

1. 在发布页下载 `*-setup.exe` 和可用的 `SHA256SUMS.txt`。
2. 运行安装向导，选择独立目录，例如 `D:\Program\MarkFlow`。
3. 启动 MarkFlow，添加你的笔记文件夹作为工作区。

应用需要 WebView2。机器缺少运行时时，安装过程可能联网下载；应用的编辑器资源随程序打包。

当前准备中的安装包尚未配置代码签名。发布页会说明签名和平台验收状态。

可用 PowerShell 校验下载文件，与发布页提供的 SHA-256 比较：

```powershell
Get-FileHash -LiteralPath '.\MarkFlow_0.1.0_x64-setup.exe' -Algorithm SHA256
```

## macOS

项目包含 macOS Apple Silicon 与 Intel 的构建配置，目前尚未完成真机验收和签名公证。仅在发布页明确提供相应版本时下载，勿把 Windows 安装包用于 macOS。

## 更新与卸载

更新前退出程序，备份应用数据目录和重要工作区，再安装新版本。覆盖升级时选择原安装目录。

普通卸载设计为保留应用数据；勾选“删除应用数据”会删除安装目录中的 `data`。正文位于你的工作区中。具体保留行为需以所用版本的发布说明为准，卸载前仍建议备份。

应用内检查更新已内置官方 GitHub Releases，无需填写地址；发现新版后可在应用内下载并安装经过签名验证的更新。详见[数据与备份](./guide/storage)。

更新接入（2026-10-08）：应用内检查后下载并安装签名更新，安装前两次同步/保存文档与会话；签名验证失败或保存冲突时阻止安装。版本标签工作流生成安装包签名与 latest.json，公开 Release 后更新源才可访问。本地执行 pnpm release:build 使用 .local/updater.key。私钥须保管和备份，不能提交 Git，不能随意换钥，否则旧版无法验证新版。普通 CI 使用 tauri.ci.conf.json 关闭签名产物，正式发布必须签名。更新实际安装未自动执行，避免中断当前应用；首次跨版本升级仍需隔离环境验收。
