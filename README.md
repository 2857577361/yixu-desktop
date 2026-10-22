# 一序 · Windows / macOS 0.30.0

习惯、专注、周计划、生活月历、打卡、日记、便笺、笔记、稍后学习与 PDF / EPUB 阅读。Windows 与当前 Mac 版共用功能源码，包含黄金矿工、黑白棋、9 路围棋、步步为营、昆虫棋与塔罗逐牌 / 综合解读。游戏菜单统一尺寸，支持分类筛选及横向浏览。

## Windows 从源码运行

安装 Node.js 22.13+ 和 Git，在 PowerShell 中执行：

```powershell
git clone https://github.com/2857577361/yixu-desktop.git
cd yixu-desktop
npm ci
npm start
# 自行打包（可选）
npm run package:windows
```

输出 `dist-desktop/一序-win32-x64/`，运行其中「一序.exe」，保留整个目录。`Ctrl+K` 查找，`Ctrl+Shift+Space` 快速便笺。本次只发布代码，不发布安装包。

## 空白初始状态与隐私

首次启动不预置习惯、打卡、日记、计划、便笺、书籍或个人记录；测试样例只在隔离临时目录创建。源码不包含个人数据文件、图片、书籍、浏览器会话、语雀凭据、AI 密钥或预填姓名。

Windows 数据位于 `%APPDATA%\Yixu`，macOS 位于 `~/Library/Application Support/Yixu`。更新源码不会删除已有安装中的本机记录。`shared/cloud-config.json` 留空，不连接原作者的云项目。云同步需要自己的 Supabase 项目，表结构见 `supabase/`，只配置 publishable/anon 公钥，不使用 service_role 密钥。

AI 翻译、讲解、棋类教练和塔罗深入解读需要配置自己的 AI 密钥。离线基础功能不依赖 AI；围棋与昆虫棋对手为休闲实现，规则说明见游戏页面。

## 手机与局域网

`mobile/` 为独立移动端源码。桌面局域网服务只提供配对、同步和图片 API，不托管手机网页。Android 需独立构建，手机网页需另外托管。

```sh
npm ci --prefix mobile
npm run build --prefix mobile
```

## 验证与 macOS 构建

```sh
npm test
node test/strategy-ui.spec.cjs
node test/windows-renderer-ui.spec.cjs
npm run package:mac
```

Windows 界面模拟不等于 Windows 真机测试；系统通知、开机启动、防火墙及视频需在 Windows 真机验收。数据导出 / 导入在设置中操作，凭据在新设备重新授权。
