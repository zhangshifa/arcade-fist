/**
 * 拳魂 ARCADE FIST — 小程序主页面
 * 画布：type=2d，按 480x270 逻辑分辨率绘制，自适应缩放。
 * 输入：触摸事件映射为虚拟按键 / UI 热区。
 */
// 核心模块顺序加载（均由 scripts/sync.js 从 core/ 生成）
const AK = require('../../core/constants.js');
require('../../core/sprites.js');
require('../../core/storage.js');
require('../../core/audio.js');
require('../../core/ads.js');
require('../../core/fighter.js');
require('../../core/ai.js');
require('../../core/game.js');

const ASPECT = AK.VIEW.W / AK.VIEW.H; // 16:9

Page({
  data: {
    cw: 375,
    ch: 211
  },

  onLoad() {
    // 按窗口尺寸计算 16:9 画布
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const w = info.windowWidth || 375;
      const h = info.windowHeight || 667;
      let cw, ch;
      if (w / h > ASPECT) { ch = h; cw = h * ASPECT; }
      else { cw = w; ch = w / ASPECT; }
      this.setData({ cw: Math.round(cw), ch: Math.round(ch) });
      this.pixelRatio = Math.min(info.pixelRatio || 2, 3);
    } catch (e) {
      this.pixelRatio = 2;
    }
  },

  onReady() {
    const q = wx.createSelectorQuery();
    q.select('#stage')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          wx.showToast({ title: '画布初始化失败', icon: 'none' });
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = this.pixelRatio || 2;

        canvas.width = Math.round(this.data.cw * dpr);
        canvas.height = Math.round(this.data.ch * dpr);
        ctx.imageSmoothingEnabled = false;

        this.canvas = canvas;
        this.ctx = ctx;
        this.dpr = dpr;
        // canvas 相对页面的偏移（触摸坐标换算用）
        this.canvasRect = { left: res[0].left || 0, top: res[0].top || 0 };

        this.game = new AK.Game({
          platform: 'wx',
          onLog: (...a) => console.log('[ADS]', ...a)
        });
        this.game.view.scale = canvas.width / AK.VIEW.W;
        this.game.view.ox = 0;
        this.game.view.oy = 0;

        this.startLoop();
      });
  },

  onUnload() {
    this.stopped = true;
  },

  onHide() {
    if (this.game) this.game.onPointerCancel();
  },

  startLoop() {
    const canvas = this.canvas;
    const raf = canvas.requestAnimationFrame
      ? canvas.requestAnimationFrame.bind(canvas)
      : (cb) => setTimeout(() => cb(Date.now()), 16);

    let last = 0;
    const tick = (ts) => {
      if (this.stopped) return;
      if (!last) last = ts;
      const dt = Math.min(100, ts - last);
      last = ts;
      try {
        this.game.update(dt);
        this.game.render(this.ctx);
      } catch (e) {
        console.error('[ARCADE FIST] frame error', e);
      }
      raf(tick);
    };
    raf(tick);
  },

  /* ---------------- 触摸输入 ---------------- */
  toCanvasPx(touch) {
    // touch.x/y 为页面坐标，需要减去 canvas 偏移并换算到画布像素
    const left = (this.canvasRect && this.canvasRect.left) || 0;
    const top = (this.canvasRect && this.canvasRect.top) || 0;
    return {
      x: (touch.x - left) * this.dpr,
      y: (touch.y - top) * this.dpr
    };
  },

  onTouchStart(e) {
    if (!this.game) return;
    const touches = e.touches || [];
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      const p = this.toCanvasPx(t);
      this.game.onPointerDown(p.x, p.y, t.identifier);
    }
  },

  onTouchMove(e) {
    if (!this.game) return;
    // 滑出按键时释放方向键，避免"卡住"
    const touches = e.touches || [];
    const inPad = {};
    for (let i = 0; i < touches.length; i++) {
      const p = this.toCanvasPx(touches[i]);
      const lp = this.game.toLogical(p.x, p.y);
      const PAD = AK.PAD;
      for (let k = 0; k < PAD.length; k++) {
        const b = PAD[k];
        if (lp.x >= b.x && lp.x <= b.x + b.w && lp.y >= b.y && lp.y <= b.y + b.h) {
          inPad[b.id] = true;
        }
      }
    }
    const PAD2 = AK.PAD;
    for (let k = 0; k < PAD2.length; k++) {
      const b = PAD2[k];
      if ((b.type === 'dir' || b.id === 'block') && !inPad[b.id]) delete this.game.held[b.id];
    }
  },

  onTouchEnd(e) {
    if (!this.game) return;
    const touches = e.changedTouches || [];
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      const p = this.toCanvasPx(t);
      this.game.onPointerUp(p.x, p.y, t.identifier);
    }
  },

  onTouchCancel() {
    if (this.game) this.game.onPointerCancel();
  },

  /* 调试期：右上角菜单转发 */
  onShareAppMessage() {
    return {
      title: '拳魂 ARCADE FIST · 点开就打的像素街机格斗',
      path: '/pages/index/index'
    };
  }
});
