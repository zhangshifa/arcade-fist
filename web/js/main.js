/**
 * 拳魂 ARCADE FIST — Web 平台入口
 * 负责画布适配、输入事件与主循环，游戏逻辑全部在 core/ 中。
 */
(function () {
  'use strict';
  var AK = window.AK;
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d', { alpha: false });
  var ASPECT = AK.VIEW.W / AK.VIEW.H;

  var game = new AK.Game({ platform: 'web' });
  window.__AK_GAME__ = game; // 便于调试

  /* ---------------- 画布适配 ---------------- */
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var cssW, cssH;
    if (vw / vh > ASPECT) { cssH = vh; cssW = vh * ASPECT; }
    else { cssW = vw; cssH = vw / ASPECT; }

    canvas.style.width = Math.round(cssW) + 'px';
    canvas.style.height = Math.round(cssH) + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    game.view.scale = canvas.width / AK.VIEW.W;
    game.view.ox = 0;
    game.view.oy = 0;

    ctx.imageSmoothingEnabled = false;
    if (ctx.setTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  resize();

  /* ---------------- 坐标换算 ---------------- */
  function toCanvasPx(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var sx = canvas.width / rect.width;
    var sy = canvas.height / rect.height;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  /* ---------------- 指针事件 ---------------- */
  var activePointers = {};

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    var p = toCanvasPx(e.clientX, e.clientY);
    activePointers[e.pointerId] = true;
    game.onPointerDown(p.x, p.y, e.pointerId);
    AK.audio.resume();
  }, { passive: false });

  canvas.addEventListener('pointermove', function (e) {
    if (!activePointers[e.pointerId]) return;
    // 滑动到相邻按键时切换（提升触屏手感）
    var p = toCanvasPx(e.clientX, e.clientY);
    var lp = game.toLogical(p.x, p.y);
    var PAD = AK.PAD;
    for (var i = 0; i < PAD.length; i++) {
      var b = PAD[i];
      var inside = lp.x >= b.x && lp.x <= b.x + b.w && lp.y >= b.y && lp.y <= b.y + b.h;
      if (b.type === 'dir' || b.id === 'block') {
        if (!inside) delete game.held[b.id];
      }
    }
  });

  function endPointer(e) {
    if (!activePointers[e.pointerId]) return;
    delete activePointers[e.pointerId];
    var p = toCanvasPx(e.clientX, e.clientY);
    game.onPointerUp(p.x, p.y, e.pointerId);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', function (e) {
    delete activePointers[e.pointerId];
    game.onPointerCancel();
  });
  canvas.addEventListener('pointerleave', endPointer);

  /* ---------------- 键盘 ---------------- */
  window.addEventListener('keydown', function (e) {
    if (game.onKey(e.code, true)) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    if (game.onKey(e.code, false)) e.preventDefault();
  });
  window.addEventListener('blur', function () { game.onPointerCancel(); });

  /* ---------------- 主循环 ---------------- */
  var last = 0;
  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min(100, ts - last);
    last = ts;
    game.update(dt);
    game.render(ctx);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // 首次交互解锁音频
  ['pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function once() {
      AK.audio.resume();
      window.removeEventListener(ev, once);
    });
  });
})();
