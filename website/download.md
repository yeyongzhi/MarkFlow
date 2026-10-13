<script setup>
import { version } from '../package.json'
const installerVersion = version
const installerUrl = `https://github.com/yeyongzhi/MarkFlow/releases/download/v${installerVersion}/MarkFlow_${installerVersion}_x64-setup.exe`
</script>

# 下载与安装

<a :href="installerUrl" class="download-installer">下载 Windows x64 测试版 · {{ installerVersion }}</a>

当前版本为 **{{ version }}**。本次更新优化了标签、模板、回收站及文档阅读体验。查看[更新日志](./changelog)。

<style>
.download-installer { display: inline-block; padding: 12px 20px; border-radius: 8px; background: var(--vp-c-brand-1); color: white !important; font-weight: 600; text-decoration: none !important; }
.download-installer:hover { background: var(--vp-c-brand-2); }
</style>

测试版用于体验与反馈。安装包和更新签名均托管在 GitHub Releases。

安装包通过 GitHub Releases 分发。请从发布页选择适合系统的附件，核对版本说明。

[前往 MarkFlow 发布页 →](https://github.com/yeyongzhi/MarkFlow/releases)



## Windows

首版发布流程面向 **Windows x64**，安装文件名类似 `MarkFlow_0.1.0-beta.2_x64-setup.exe`。

1. 在发布页下载 `*-setup.exe` 和可用的 `SHA256SUMS.txt`。
2. 运行安装向导，选择独立目录，例如 `D:\Program\MarkFlow`。
3. 启动 MarkFlow，添加你的笔记文件夹作为工作区。

应用需要 WebView2。机器缺少运行时时，安装过程可能联网下载；应用的编辑器资源随程序打包。

当前准备中的安装包尚未配置代码签名。发布页会说明签名和平台验收状态。

可用 PowerShell 校验下载文件，与发布页提供的 SHA-256 比较：

```powershell
Get-FileHash -LiteralPath '.\MarkFlow_0.1.0-beta.2_x64-setup.exe' -Algorithm SHA256
```

## macOS

项目包含 macOS Apple Silicon 与 Intel 的构建配置，目前尚未完成真机验收和签名公证。仅在发布页明确提供相应版本时下载，勿把 Windows 安装包用于 macOS。

## 更新与卸载

更新前退出程序，备份应用数据目录和重要工作区，再安装新版本。覆盖升级时选择原安装目录。

普通卸载设计为保留应用数据；勾选“删除应用数据”会删除安装目录中的 `data`。正文位于你的工作区中。具体保留行为需以所用版本的发布说明为准，卸载前仍建议备份。

应用内检查更新已内置官方 GitHub Releases，无需填写地址；发现新版后可在应用内下载并安装经过签名验证的更新。详见[数据与备份](./guide/storage)。

测试版接收后续 beta 与更高版本的正式更新；正式版只接收正式更新。应用根据发布标签读取同一 Release 的 `latest.json`，下载后验证签名，并在安装前保存文档和会话。
