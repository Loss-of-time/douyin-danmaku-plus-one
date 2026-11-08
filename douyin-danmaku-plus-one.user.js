// ==UserScript==
// @name         抖音直播画面弹幕 +1
// @namespace    douyin-danmaku-plus-one
// @version      1.1.0
// @description  在 live.douyin.com 直播间，鼠标移到视频画面上飘过的弹幕上会显示 +1 按钮，点一下把同款弹幕发出去。只处理画面弹幕（canvas），不处理右侧聊天区；未登录、被禁言、发送过于频繁或内容超长时发送会失败。
// @author       loss
// @match        https://live.douyin.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  var STYLE_ID = 'dy1-style';
  var BTN_ID = 'dy1-plus1';
  var CHANNEL = '__dy1_danmaku_v1__';
  var HIDE_DELAY = 450;

  var CSS = String.raw`
:root {
  --dy1-bg: #fe2c55;
  --dy1-bg-hover: #ff4d6d;
  --dy1-fg: #fff;
  --dy1-border: rgba(255, 255, 255, .55);
  --dy1-shadow: rgba(0, 0, 0, .35);
}

/* ---------- +1 按钮 ---------- */
#dy1-plus1 {
  position: fixed !important;
  z-index: 2147483647 !important;
  display: none;
  align-items: center !important;
  justify-content: center !important;
  width: 32px !important;
  height: 20px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 1px solid var(--dy1-border) !important;
  border-radius: 10px !important;
  background: var(--dy1-bg) !important;
  color: var(--dy1-fg) !important;
  font: 600 12px/1 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif !important;
  letter-spacing: .2px !important;
  cursor: pointer !important;
  box-shadow: 0 2px 6px var(--dy1-shadow) !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  transition: background-color .12s, transform .12s !important;
}
#dy1-plus1.dy1-on {
  display: inline-flex !important;
}
#dy1-plus1:hover {
  background: var(--dy1-bg-hover) !important;
  transform: scale(1.06);
}
#dy1-plus1:disabled {
  cursor: default !important;
  opacity: .85;
  transform: none;
}
`;

  /* 抖音的画面弹幕由 worker 画在 OffscreenCanvas 上，主线程没有文字和坐标。
     这里给站方建 worker 的 Blob 追加一段补丁，把每帧 fillText 的文字/坐标
     通过 BroadcastChannel 回传；主线程据此让 +1 按钮跟着弹幕走，不改绘制。
     拦截思路参考 mks155/DouyinLiveOptimizer（Apache-2.0），本文件只保留
     文字/坐标回传，发送与 UI 按本仓库的需要重写。 */
  var WORKER_PATCH = `
;(function () {
try {
var __ch = new BroadcastChannel('${CHANNEL}');
var __P = OffscreenCanvasRenderingContext2D.prototype;
var __of = __P.fillText;
var __ctxs = [], __timer = 0;

function __arr(ctx){
  for (var i = 0; i < __ctxs.length; i++) if (__ctxs[i].c === ctx) return __ctxs[i].a;
  var a = [];
  __ctxs.push({ c: ctx, a: a });
  return a;
}
function __report(txt, x, y, ctx){
  var arr = __arr(ctx);
  var cv = ctx.canvas || null;
  var w = 0;
  try { w = ctx.measureText(txt).width || 0; } catch (e) {}
  arr.push([txt, x, y, ctx.font, (cv && cv.width) || 0, (cv && cv.height) || 0, w]);
  if (!__timer) __timer = setTimeout(__flush, 0);
}
function __flush(){
  __timer = 0;
  var out = [];
  try {
    for (var i = 0; i < __ctxs.length; i++) {
      var a = __ctxs[i].a;
      for (var j = 0; j < a.length; j++) out.push(a[j]);
      a.length = 0;
    }
    if (out.length) __ch.postMessage({ k: 'f', items: out });
  } catch (e) {}
}
__P.fillText = function (t, x, y, m) {
  __of.call(this, t, x, y, m);
  try { __report(String(t), x, y, this); } catch (e) {}
};
__ch.postMessage({ k: 'ready' });
} catch (e) {}
})();
`;

  var frameItems = [];
  var lastCanvas = null;
  var channel = null;
  var btn = null;
  var hover = null;
  var buttonHover = false;
  var btnW = 32;
  var btnH = 20;
  var hideTimer = 0;
  var sending = false;

  /* ---------- 样式 ---------- */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var root = document.head || document.documentElement;
    if (!root) {
      setTimeout(injectStyle, 10);
      return;
    }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    root.appendChild(style);
  }

  function moveStyle() {
    var style = document.getElementById(STYLE_ID);
    if (style && document.head && style.parentNode !== document.head) {
      document.head.appendChild(style);
    }
  }

  /* ---------- worker 注入 ---------- */
  function hookWorker() {
    try {
      if (!window.Blob || window.Blob.__dy1Patched) return;
      var OrigBlob = window.Blob;
      var Patched = new Proxy(OrigBlob, {
        construct: function (target, args, newTarget) {
          try {
            var parts = args[0];
            var type = (args[1] && args[1].type) || '';
            if (
              Array.isArray(parts) &&
              parts.length === 1 &&
              typeof parts[0] === 'string' &&
              parts[0].indexOf('importScripts(') >= 0 &&
              /javascript/i.test(type)
            ) {
              args[0] = [parts[0] + WORKER_PATCH];
            }
          } catch (e) {}
          return Reflect.construct(target, args, newTarget);
        }
      });
      Patched.__dy1Patched = true;
      window.Blob = Patched;
    } catch (e) {}
  }

  function onChannel(e) {
    var d = e.data;
    if (!d || d.k !== 'f' || !d.items || !d.items.length) return;
    frameItems = d.items;
    if (hover && !buttonHover) track();
  }

  /* ---------- 画布与命中 ---------- */
  function currentGroup() {
    var cv = document.querySelector('.CanvasDanmakuPlugin canvas');
    if (!cv) {
      lastCanvas = null;
      frameItems = [];
      if (hover) hide();
      return null;
    }
    if (cv !== lastCanvas) {
      /* 换房间/重建播放器时，旧 worker 的坐标不能拿来用 */
      if (lastCanvas) {
        frameItems = [];
        if (hover) hide();
      }
      lastCanvas = cv;
    }
    if (!frameItems.length) return null;
    var rect = cv.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    var cw = cv.width;
    var ch = cv.height;
    var list = [];
    var i;
    for (i = 0; i < frameItems.length; i++) {
      if (frameItems[i][4] === cw && frameItems[i][5] === ch) list.push(frameItems[i]);
    }
    if (!list.length) {
      /* 有的构建把画布按 DPR 放大，回传的尺寸是设备像素 */
      var dpr = window.devicePixelRatio || 1;
      var dw = Math.round(cw * dpr);
      var dh = Math.round(ch * dpr);
      for (i = 0; i < frameItems.length; i++) {
        if (frameItems[i][4] === dw && frameItems[i][5] === dh) list.push(frameItems[i]);
      }
    }
    if (!list.length) return null;
    return {
      cv: cv,
      rect: rect,
      list: list,
      cw: list[0][4] || cw,
      ch: list[0][5] || ch
    };
  }

  function pick(clientX, clientY) {
    var group = currentGroup();
    if (!group) return null;
    var rect = group.rect;
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top || clientY > rect.bottom
    ) return null;

    var sx = group.cw / rect.width;
    var sy = group.ch / rect.height;
    var x = (clientX - rect.left) * sx;
    var y = (clientY - rect.top) * sy;
    var best = null;
    var list = group.list;

    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var text = String(it[0] || '');
      if (!text) continue;
      var font = String(it[3] || '');
      var m = /(\d+(?:\.\d+)?)px/.exec(font);
      var size = m ? parseFloat(m[1]) : 20;
      var w = it[6] || size * text.length;
      var top = it[2];
      var bottom = top + size * 1.3;
      if (x >= it[1] - 3 && x <= it[1] + w + 3 && y >= top - 2 && y <= bottom) {
        if (!best || top < best.top) {
          best = { it: it, top: top, size: size, sx: sx, sy: sy, rect: rect };
        }
      }
    }
    return best;
  }

  /* ---------- 按钮 ---------- */
  function ensureButton() {
    if (btn && !btn.isConnected) btn = null;
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.title = '发送同款弹幕';
    btn.setAttribute('aria-label', '发送同款弹幕 +1');
    btn.textContent = '+1';
    btn.addEventListener('mouseenter', function () {
      buttonHover = true;
      cancelHide();
    });
    btn.addEventListener('mouseleave', function () {
      buttonHover = false;
      hide();
    });
    btn.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (sending || !hover || !hover.text) return;
      send(hover.text);
    });
    (document.body || document.documentElement).appendChild(btn);
    return btn;
  }

  function placeButton() {
    if (!hover || !btn) return;
    var rect = hover.rect;
    var x = rect.left + hover.it[1] / hover.sx;
    var y = rect.top + hover.it[2] / hover.sy;
    var w = (hover.it[6] || 40) / hover.sx;
    var h = hover.size / hover.sy;
    var bw = btnW || 32;
    var bh = btnH || 20;

    var left = x + w + 6;
    if (left + bw > window.innerWidth - 8) left = x - bw - 6;
    left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));

    var top = y + h / 2 - bh / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - bh - 8));

    btn.style.left = Math.round(left) + 'px';
    btn.style.top = Math.round(top) + 'px';
  }

  function showButton(reset) {
    var el = ensureButton();
    if (!el) return;
    if (reset) {
      el.textContent = sending ? '…' : '+1';
      el.disabled = sending;
    }
    el.classList.add('dy1-on');
    if (reset) {
      btnW = el.offsetWidth || 32;
      btnH = el.offsetHeight || 20;
      placeButton();
    }
  }

  function flash(symbol) {
    if (!btn) {
      sending = false;
      return;
    }
    btn.textContent = symbol;
    btn.disabled = true;
    setTimeout(function () {
      sending = false;
      if (!btn) return;
      btn.disabled = false;
      btn.textContent = '+1';
    }, 900);
  }

  /* ---------- 悬停 ---------- */
  function clean(text) {
    return String(text || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/^\s+|\s+$/g, '');
  }

  function onMouseMove(e) {
    if (buttonHover || (btn && btn.contains(e.target))) {
      cancelHide();
      return;
    }
    var hit = pick(e.clientX, e.clientY);
    if (!hit) {
      scheduleHide();
      return;
    }
    var raw = String(hit.it[0] || '');
    var text = clean(raw);
    if (!text) {
      scheduleHide();
      return;
    }
    cancelHide();
    var changed = !hover || hover.raw !== raw || hover.y !== hit.it[2];
    hover = {
      raw: raw,
      text: text,
      y: hit.it[2],
      lastX: hit.it[1],
      it: hit.it,
      rect: hit.rect,
      sx: hit.sx,
      sy: hit.sy,
      size: hit.size
    };
    if (changed) showButton(true);
    else showButton(false);
  }

  /* 弹幕不暂停，所以每帧到新坐标后让按钮跟着走；指针已经在按钮上就不再挪 */
  function track() {
    if (!hover || buttonHover || (btn && btn.matches && btn.matches(':hover'))) return;
    var group = currentGroup();
    if (!group) {
      scheduleHide();
      return;
    }
    var best = null;
    var bestDx = 1e9;
    for (var i = 0; i < group.list.length; i++) {
      var it = group.list[i];
      if (String(it[0] || '') !== hover.raw) continue;
      if (Math.abs(it[2] - hover.y) > 2) continue;
      var dx = Math.abs(it[1] - hover.lastX);
      if (dx < 120 && dx < bestDx) {
        best = it;
        bestDx = dx;
      }
    }
    if (!best) {
      scheduleHide();
      return;
    }
    cancelHide();
    var m = /(\d+(?:\.\d+)?)px/.exec(String(best[3] || ''));
    hover.it = best;
    hover.lastX = best[1];
    hover.rect = group.rect;
    hover.sx = group.cw / group.rect.width;
    hover.sy = group.ch / group.rect.height;
    hover.size = m ? parseFloat(m[1]) : 20;
    placeButton();
  }

  function scheduleHide() {
    if (hideTimer) return;
    hideTimer = setTimeout(function () {
      hideTimer = 0;
      hide();
    }, HIDE_DELAY);
  }

  function cancelHide() {
    if (!hideTimer) return;
    clearTimeout(hideTimer);
    hideTimer = 0;
  }

  function hide() {
    cancelHide();
    hover = null;
    buttonHover = false;
    if (btn) btn.classList.remove('dy1-on');
  }

  function onScroll() {
    if (!hover) return;
    if (buttonHover) {
      hide();
      return;
    }
    var group = currentGroup();
    if (!group) {
      scheduleHide();
      return;
    }
    hover.rect = group.rect;
    hover.sx = group.cw / group.rect.width;
    hover.sy = group.ch / group.rect.height;
    placeButton();
  }

  /* ---------- 发送 ---------- */
  function findEditor() {
    return (
      document.querySelector('#chatInput [data-slate-editor="true"]') ||
      document.querySelector('.webcast-chatroom___input-container [contenteditable="true"]') ||
      document.querySelector('#chatInput [contenteditable="true"]') ||
      null
    );
  }

  function findSendBtn() {
    return (
      document.querySelector('#chatInput .webcast-chatroom___send-btn') ||
      document.querySelector('.webcast-chatroom___input-container .webcast-chatroom___send-btn') ||
      null
    );
  }

  function readEditor(el) {
    return (el.textContent || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  function fillEditor(el, text) {
    el.focus();
    try {
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}

    var ok = false;
    try {
      ok = document.execCommand('insertText', false, text);
    } catch (e) {}

    if (!ok || readEditor(el).indexOf(text.slice(0, 8)) < 0) {
      /* execCommand 被编辑器拒掉时的兜底；可能只改 DOM、不改编辑器状态 */
      el.textContent = text;
      try {
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));
      } catch (e) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    try {
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}
    return readEditor(el).length > 0;
  }

  function isDisabled(el) {
    return (
      el.hasAttribute('disabled') ||
      el.classList.contains('disable') ||
      el.getAttribute('aria-disabled') === 'true'
    );
  }

  function callClick(el) {
    /* 发送键是 SVG，没有 .click()；能拿到 React onClick 就直接调，否则派发冒泡 click */
    var key = null;
    try {
      var keys = Object.keys(el);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('__reactProps') === 0) {
          key = keys[i];
          break;
        }
      }
    } catch (e) {}
    if (key && el[key] && typeof el[key].onClick === 'function') {
      try {
        el[key].onClick({
          type: 'click',
          target: el,
          currentTarget: el,
          preventDefault: function () {},
          stopPropagation: function () {},
          isDefaultPrevented: function () { return false; },
          isPropagationStopped: function () { return false; },
          bubbles: true,
          cancelable: true,
          nativeEvent: {
            isTrusted: true,
            preventDefault: function () {},
            stopPropagation: function () {}
          }
        });
        return true;
      } catch (e) {}
    }
    try {
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function send(text) {
    sending = true;
    if (btn) {
      btn.textContent = '…';
      btn.disabled = true;
    }
    var editor = findEditor();
    if (!editor) {
      flash('×');
      return;
    }
    if (!fillEditor(editor, text)) {
      flash('×');
      return;
    }

    var tries = 0;
    function waitForEnable() {
      var sendBtn = findSendBtn();
      if (sendBtn && !isDisabled(sendBtn)) {
        callClick(sendBtn);
        setTimeout(function () {
          /* 发送成功后编辑器会清空；没清空就提示失败，但不再重试，避免重复发送 */
          flash(readEditor(editor) ? '×' : '✓');
        }, 600);
        return;
      }
      tries += 1;
      if (tries < 20) {
        setTimeout(waitForEnable, 50);
        return;
      }
      flash('×');
    }
    setTimeout(waitForEnable, 50);
  }

  /* ---------- 启动 ---------- */
  injectStyle();
  hookWorker();

  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = onChannel;
  } catch (e) {
    channel = null;
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mouseout', function (e) {
    if (!e.relatedTarget) scheduleHide();
  }, true);
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', hide);
  window.addEventListener('blur', hide);
  document.addEventListener('fullscreenchange', hide);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) hide();
  });
  document.addEventListener('DOMContentLoaded', moveStyle);
  window.addEventListener('load', moveStyle);
})();
