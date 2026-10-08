# 数据与备份

## 文件保存在哪里

正文和图片附件保存在你选择的工作区。安装程序不会把全部笔记搬到应用目录。

Windows 正式版默认将应用数据放在程序旁的 `data` 文件夹。例如安装在 `D:\Program\MarkFlow`：

| 数据 | 位置 |
| --- | --- |
| 设置、最近、收藏 | `data\preferences.json` |
| 工作区登记 | `data\workspaces.json` |
| 窗口状态 | `data\window.json` |
| 草稿和历史 | `data\recovery`、`data\history` |
| 工作区备份 | 默认 `data\workspace-backups`，可另外选择备份目录 |
| WebView2 缓存 | `data\webview` |

安装目录不可写时回退到 `%LOCALAPPDATA%\com.lexly.editor`。这个标识为了兼容早期数据而保留，产品名称已改为 MarkFlow。开发版通常也使用 AppData；macOS 使用对应的 Application Support。

以设置 → 保存与备份 → 数据目录显示的实际位置为准。系统组件和安装器临时文件仍可能使用系统盘。

## 备份与搬迁

应用提供历史版本和工作区备份。历史不等同于独立备份：硬盘故障可能同时影响正文和同盘历史。重要数据建议另存到其他磁盘。

更换安装目录前退出程序，复制原目录的 `data`，并备份工作区。另一个安装目录的数据不会自动迁移。迁移旧 AppData 时程序复制源文件并保留原目录，异常时应检查备份和实际落点。

## 锁屏

锁屏密码以哈希保存，磁盘上的文章、历史和恢复草稿仍是明文。需要文件保密时应使用系统权限或磁盘加密。
