# 抖音直播画面弹幕 +1

Tampermonkey 用户脚本。在 `live.douyin.com` 直播间，鼠标移到视频画面上飘过的弹幕上，旁边会弹出 `+1` 按钮；点一下就把这条弹幕原样发出去，省掉“看到一句想复读、手动选中复制、粘贴发送”的步骤。

- 弹幕不暂停：鼠标移上去只出按钮，弹幕继续飘；按钮跟着这条弹幕走，鼠标移到按钮上后按钮停住，方便点。
- 点完自动填发送框并点发送；右侧聊天区出现自己刚发的那条。
- 按钮状态：`…` 发送中，`✓` 已提交，`×` 失败（未登录、被禁言、发送过于频繁、超长、内容被过滤等）。
- 只处理画面弹幕；右侧聊天区的消息不显示按钮。
- 无配置、无存储、无网络请求。

## 安装

单文件成品，无构建：`douyin-danmaku-plus-one.user.js`

直接安装（Tampermonkey）：[raw 链接](https://raw.githubusercontent.com/Loss-of-time/douyin-danmaku-plus-one/main/douyin-danmaku-plus-one.user.js)

1. 在文件管理器里打开 `douyin-danmaku-plus-one.user.js`，全选复制；
2. 火狐点 Tampermonkey 图标 → **管理面板 → ➕ 添加新脚本**，粘贴覆盖模板，`Ctrl+S` 保存；
3. 打开任一 `https://live.douyin.com/<房间号>`，登录后等画面弹幕出现，鼠标移上去应看到 `+1`。

方式二：Tampermonkey 面板 → 实用工具 → 从文件导入。
