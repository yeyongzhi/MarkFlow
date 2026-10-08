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

应用内检查更新需要维护者配置发布清单，当前不会自动下载安装。详见[数据与备份](./guide/storage)。
