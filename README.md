# 抖音直播画面弹幕 +1

Tampermonkey 用户脚本。在 `live.douyin.com` 直播间，鼠标移到视频画面上飘过的弹幕上，旁边会弹出 `+1` 按钮；点一下就把这条弹幕原样发出去，省掉“看到一句想复读、手动选中复制、粘贴发送”的步骤。

无配置、无存储、无网络请求。

## 安装

单文件成品，无构建：`douyin-danmaku-plus-one.user.js`

直接安装（Tampermonkey）：[raw 链接](https://raw.githubusercontent.com/Loss-of-time/douyin-danmaku-plus-one/main/douyin-danmaku-plus-one.user.js)

1. 在文件管理器里打开 `douyin-danmaku-plus-one.user.js`，全选复制；
2. 浏览器 Tampermonkey 图标 → **管理面板 → ➕ 添加新脚本**，粘贴覆盖模板，`Ctrl+S` 保存；
3. 打开任一 `https://live.douyin.com/<房间号>`，登录后等画面弹幕出现，鼠标移上去应看到 `+1`。

方式二：Tampermonkey 面板 → 实用工具 → 从文件导入。
