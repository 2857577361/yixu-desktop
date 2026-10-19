# 一序 · Windows 桌面版

本仓库用于分发一序桌面版的 Windows 发布包与使用说明。

## 下载

进入 [Releases 下载页](https://github.com/2857577361/yixu-desktop/releases/latest)，下载 `yixu-windows-0.28.0-x64.zip`。适用于 Windows 10 / 11 的 64 位 Intel / AMD 电脑。

**完整解压**后双击「一序.exe」。不要只把 exe 单独取出，也不要下载 GitHub 自动生成的 Source code ZIP 当作安装包。

## 主要功能

- 周计划、固定作息、生活月历、习惯、独立打卡与专注。
- 日记、便笺、学习笔记、稍后学习、PDF / EPUB 阅读、记录与回顾。
- 手机局域网同步、完整归档导入导出、图片记录。
- `Ctrl+K` 快速查找，`Ctrl+Shift+Space` 全局快速便笺。
- 休息小游戏与塔罗随想：78 张牌、一牌 / 三牌、正逆位、离线解读、历史与感想，可由你主动保存到日记。

## 数据与迁移

本地记录目录为 `%APPDATA%\Yixu`。更新程序不会自动清除该目录。

从 Mac 迁移：在设置里导出全部记录，完整复制归档目录（JSON、images、library）到 Windows，然后在 Windows 设置中导入完整 JSON。同步账号、语雀与 AI 的凭据不包含在归档中，需重新授权。

手机局域网同步需两端处于同一个可信网络，并在 Windows 设置里打开配对；如防火墙询问，请允许你自己的专用网络。

## 发布验证

0.28.0 已通过 126 项单元测试、塔罗交互测试、Windows 模式 16 个页面布局检查及现有功能回归。Windows 包由 macOS 交叉打包，尚未完成 Windows 真机对通知、开机启动、防火墙及网页视频的验收。当前发布包暂无商业签名。

发布附件还提供 `Windows-Guide.md` 使用说明和 `SHA256SUMS.txt` 完整性校验。

本仓库当前不包含应用源码；Release 页面自动生成的 Source code 文件仅包含此仓库的说明文件。
