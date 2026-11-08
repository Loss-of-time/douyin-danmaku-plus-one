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

## 边界

- 只匹配 `https://live.douyin.com/*`；`www.douyin.com` 的直播、手机版、外站嵌入的播放器不覆盖。
- 必须登录抖音。未登录时页面不渲染聊天输入框，点击只会显示 `×`。
- 发送仍受抖音的登录状态、禁言、频率、长度和内容审核限制。脚本只负责把文字填进去并点发送，不绕过平台规则。
- 画面弹幕画在 canvas 上，没有逐条的 DOM。脚本靠拦截播放器创建 worker 的 Blob，给 `OffscreenCanvasRenderingContext2D` 打补丁来拿文字和坐标；抖音改内部实现时可能失效。
- 全屏时按钮暂时不显示：按钮挂在 `body`，全屏元素在浏览器顶层；先退出全屏再用。
- canvas 没有单条弹幕 ID，按钮靠“文字 + 行 + x 容差”跟踪。同一行两条一模一样的文字靠得很近时可能跟错一条，移开重试。
- 右侧聊天区不处理；它有自己的 DOM，和画面弹幕不是同一条渲染链。
- 点 `+1` 会覆盖聊天输入框里已有的草稿，脚本不备份草稿。

## 实现

画面弹幕没有 DOM，脚本在 `document-start` 给站方创建 worker 的 Blob 追加补丁，拦截 `OffscreenCanvasRenderingContext2D.fillText`，把每帧文字与坐标经 `BroadcastChannel` 回传；主线程按坐标做命中测试，并让按钮跟着这条弹幕移动。拦截思路参考 [DouyinLiveOptimizer](https://github.com/mks155/DouyinLiveOptimizer)（Apache-2.0），发送与 UI 为独立实现。

## 文件

| 文件 | 说明 |
| --- | --- |
| `douyin-danmaku-plus-one.user.js` | 单文件成品，直接装 |
| `docs/WORKFLOW.md` | 安装步骤与验证流程（怎么复现） |
| `docs/PITFALLS.md` | 踩坑记录（现象 → 原因 → 做法） |

## 验证

2026-11-08：`node --check` 通过；合成 OffscreenCanvas worker + mock 聊天框验证了悬停、按钮跟随、鼠标移到按钮后停住、点击发送、成功/失败反馈和 React onClick 路径；此前的真实直播间测试验证了 worker 帧回传与按钮定位；本次去掉定格后的按钮跟随只在合成环境验证，在线房间未复测（测试时该房间已无画面弹幕）。真实登录态发送也未测，手动步骤见 `docs/WORKFLOW.md`。
