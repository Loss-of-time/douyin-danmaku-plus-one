# 工作流

## 安装

1. 打开 `douyin-danmaku-plus-one.user.js` 全选复制 → Tampermonkey 管理面板 → ➕ 添加新脚本 → 粘贴覆盖模板 → `Ctrl+S`；
2. 打开 `https://live.douyin.com/` 并登录，进一个正在直播、画面有弹幕的房间；
3. 等视频上的弹幕出现，鼠标移上去，旁边应出现红色 `+1`。

脚本在 `document-start` 注入，装完/改完必须刷新页面。

## 验证步骤（手动）

按顺序过一遍，控制台命令都在直播间 DevTools Console 里敲：

1. **画面弹幕画布存在**：`document.querySelector('.CanvasDanmakuPlugin canvas')` 返回一个 canvas。画布要等播放器初始化后才有，进房后等几秒。
2. **悬停出现按钮**：鼠标移到一条正在飘的弹幕上，旁边出现 `+1`；弹幕继续飘，按钮跟着它走。
3. **移开恢复**：鼠标移出弹幕和按钮，`+1` 消失。
4. **发送成功**：鼠标移到按钮上，按钮会停住，方便点；点 `+1`，按钮先显示 `…`，随后变 `✓`；右侧聊天区出现自己刚发的同款弹幕，输入框清空。`✓` 只表示输入框已清空，是否真正出现在聊天区仍受平台审核/网络影响。
5. **未登录失败**：退出登录/用未登录窗口进房，悬停后点 `+1`，应显示 `×`，不会发送。
6. **开关弹幕恢复**：用播放器右下角的弹幕设置关掉再打开画面弹幕，重新悬停应仍能出按钮。画布重建后脚本靠同一个 BroadcastChannel 继续收帧。
7. **全屏**：进全屏后按钮不显示（见边界）；退出全屏再试。

## 排障

- 没有按钮：
  - `window.Blob.__dy1Patched` 应为 `true`；若为 `undefined`，脚本没在页面上下文跑或被更早的脚本改写了 `Blob`。
  - `document.querySelectorAll('.CanvasDanmakuPlugin canvas').length` 应至少为 1；0 表示播放器还没建画布或画面弹幕被关了。
  - 确认脚本在 `live.douyin.com` 上启用，且页面是刷新后加载的。
- 有按钮但点了显示 `×`：
  - 先确认已登录；`document.querySelector('#chatInput [data-slate-editor="true"]')` 应存在。
  - 再确认发送键：`document.querySelector('.webcast-chatroom___send-btn')` 存在且不带 `disabled`/`disable`。输入框有内容后它才会启用。
  - 被禁言、发送过于频繁、内容被过滤时也会失败，脚本不重试。
- 按钮位置不对：画面弹幕坐标是 canvas 像素，脚本按 `canvas.width / getBoundingClientRect().width` 换算；如果抖音改成 DPR 缩放画布，脚本会再按 `devicePixelRatio` 试一组尺寸。仍不对时先记录画布的 `width/height` 和 `getBoundingClientRect()` 再改。
- 真实发送路径没自动化测试：测试浏览器没有登录态。改动发送逻辑后，必须在登录的直播间按第 4 步手测。
