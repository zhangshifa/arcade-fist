/**
 * 本文件由 scripts/sync.js 从 core/ 自动生成，请勿手改。
 * 修改请编辑仓库根目录 core/ 下的同名文件后重新执行：node scripts/sync.js
 */
/*!
 * 拳魂 ARCADE FIST — 程序化像素角色绘制
 * 纯 Canvas 2D 代码绘制，不依赖任何图片素材（避免版权 & 小程序包体）。
 * 采用「骨骼关节 + 像素方块」方案：12 个姿态参数线性插值驱动动作。
 */
(function (root) {
  'use strict';
  var AK = (root.AK = root.AK || {});
  var S = (AK.sprites = AK.sprites || {});

  /* 姿态参数索引 */
  var P = {
    LEAN: 0, HIPY: 1, HDX: 2, HDY: 3,
    AF1: 4, AF2: 5, AB1: 6, AB2: 7,
    LF1: 8, LF2: 9, LB1: 10, LB2: 11
  };
  S.P = P;
  var LEN = 12;

  /* 体型骨架参数 */
  var BUILD = {
    normal: { thigh: 21, shin: 20, torso: 30, upper: 15, fore: 15, headW: 13, headH: 14, bodyW: 19, limbW: 6 },
    slim:   { thigh: 22, shin: 21, torso: 30, upper: 14, fore: 14, headW: 12, headH: 14, bodyW: 16, limbW: 5 },
    heavy:  { thigh: 20, shin: 19, torso: 30, upper: 16, fore: 16, headW: 14, headH: 14, bodyW: 24, limbW: 7 }
  };

  function pose() {
    var a = new Array(LEN);
    for (var i = 0; i < LEN; i++) a[i] = 0;
    return a;
  }
  S.pose = pose;

  /* 常用姿态 */
  var POSES = {
    stand: function () {
      var p = pose();
      p[P.LEAN] = 0.10; p[P.HIPY] = 0;
      p[P.AF1] = 1.05; p[P.AF2] = -1.55;
      p[P.AB1] = 1.22; p[P.AB2] = -1.70;
      p[P.LF1] = 1.60; p[P.LF2] = 0.10;
      p[P.LB1] = 1.42; p[P.LB2] = 0.06;
      return p;
    },
    walk: function () {
      var p = POSES.stand();
      p[P.LEAN] = 0.16;
      return p;
    },
    crouch: function () {
      var p = pose();
      p[P.LEAN] = 0.30; p[P.HIPY] = 15; p[P.HDY] = 3;
      p[P.AF1] = 0.95; p[P.AF2] = -1.75;
      p[P.AB1] = 1.10; p[P.AB2] = -1.85;
      p[P.LF1] = 1.30; p[P.LF2] = -1.15;
      p[P.LB1] = 1.15; p[P.LB2] = -1.35;
      return p;
    },
    jump: function () {
      var p = pose();
      p[P.LEAN] = 0.05; p[P.HIPY] = -2;
      p[P.AF1] = 0.70; p[P.AF2] = -0.80;
      p[P.AB1] = 1.90; p[P.AB2] = -0.60;
      p[P.LF1] = 1.85; p[P.LF2] = -1.25;
      p[P.LB1] = 1.30; p[P.LB2] = -1.05;
      return p;
    },
    punchLight: function () { // 前手直拳
      var p = POSES.stand();
      p[P.LEAN] = 0.26; p[P.HDX] = 3;
      p[P.AF1] = 0.02; p[P.AF2] = 0.02;
      p[P.AB1] = 1.35; p[P.AB2] = -1.60;
      p[P.LF1] = 1.66; p[P.LF2] = 0.05;
      p[P.LB1] = 1.36; p[P.LB2] = 0.10;
      return p;
    },
    punchHeavy: function () { // 后手重拳，转体
      var p = POSES.stand();
      p[P.LEAN] = 0.42; p[P.HDX] = 6; p[P.HIPY] = 2;
      p[P.AB1] = -0.05; p[P.AB2] = 0.0;
      p[P.AF1] = 1.30; p[P.AF2] = -1.85;
      p[P.LF1] = 1.72; p[P.LF2] = 0.04;
      p[P.LB1] = 1.30; p[P.LB2] = 0.14;
      return p;
    },
    kickLight: function () { // 前腿低踢
      var p = POSES.stand();
      p[P.LEAN] = -0.14; p[P.HDX] = -2;
      p[P.AF1] = 1.20; p[P.AF2] = -1.10;
      p[P.AB1] = 1.05; p[P.AB2] = -1.30;
      p[P.LF1] = 0.62; p[P.LF2] = -0.30;
      p[P.LB1] = 1.52; p[P.LB2] = 0.04;
      return p;
    },
    kickHeavy: function () { // 高踢
      var p = POSES.stand();
      p[P.LEAN] = -0.38; p[P.HDX] = -5; p[P.HIPY] = -1;
      p[P.AF1] = 1.70; p[P.AF2] = -0.70;
      p[P.AB1] = 0.60; p[P.AB2] = -1.20;
      p[P.LF1] = -0.12; p[P.LF2] = -0.05;
      p[P.LB1] = 1.50; p[P.LB2] = 0.02;
      return p;
    },
    crouchKick: function () { // 扫堂腿
      var p = pose();
      p[P.LEAN] = -0.22; p[P.HIPY] = 18; p[P.HDX] = -3; p[P.HDY] = 5;
      p[P.AF1] = 1.30; p[P.AF2] = -0.90;
      p[P.AB1] = 1.60; p[P.AB2] = -0.70;
      p[P.LF1] = 0.18; p[P.LF2] = 0.02;
      p[P.LB1] = 1.10; p[P.LB2] = -1.55;
      return p;
    },
    crouchPunch: function () {
      var p = POSES.crouch();
      p[P.LEAN] = 0.34; p[P.HDX] = 3;
      p[P.AF1] = 0.10; p[P.AF2] = 0.06;
      return p;
    },
    block: function () {
      var p = POSES.stand();
      p[P.LEAN] = -0.10; p[P.HIPY] = 3; p[P.HDY] = 2;
      p[P.AF1] = 0.55; p[P.AF2] = -2.05;
      p[P.AB1] = 0.40; p[P.AB2] = -2.30;
      p[P.LF1] = 1.55; p[P.LF2] = 0.14;
      p[P.LB1] = 1.40; p[P.LB2] = 0.10;
      return p;
    },
    hit: function () {
      var p = POSES.stand();
      p[P.LEAN] = -0.42; p[P.HDX] = -7; p[P.HDY] = 1; p[P.HIPY] = 1;
      p[P.AF1] = 1.55; p[P.AF2] = -0.55;
      p[P.AB1] = 1.75; p[P.AB2] = -0.45;
      p[P.LF1] = 1.45; p[P.LF2] = 0.22;
      p[P.LB1] = 1.62; p[P.LB2] = -0.05;
      return p;
    },
    ko: function () {
      var p = pose();
      p[P.LEAN] = -0.2; p[P.HIPY] = 34; p[P.HDX] = -8; p[P.HDY] = 10;
      p[P.AF1] = 2.10; p[P.AF2] = 0.35;
      p[P.AB1] = 2.45; p[P.AB2] = 0.30;
      p[P.LF1] = 1.10; p[P.LF2] = -0.9;
      p[P.LB1] = 1.35; p[P.LB2] = -0.7;
      return p;
    },
    specialCast: function () { // 必杀起手：双臂后收蓄力
      var p = POSES.stand();
      p[P.LEAN] = -0.22; p[P.HIPY] = 6; p[P.HDX] = -3;
      p[P.AF1] = 1.85; p[P.AF2] = -1.30;
      p[P.AB1] = 2.00; p[P.AB2] = -1.20;
      p[P.LF1] = 1.35; p[P.LF2] = -0.55;
      p[P.LB1] = 1.55; p[P.LB2] = 0.30;
      return p;
    },
    specialFire: function () { // 必杀释放：双掌前推
      var p = POSES.stand();
      p[P.LEAN] = 0.40; p[P.HIPY] = 2; p[P.HDX] = 5;
      p[P.AF1] = 0.0; p[P.AF2] = 0.0;
      p[P.AB1] = 0.18; p[P.AB2] = -0.15;
      p[P.LF1] = 1.70; p[P.LF2] = 0.05;
      p[P.LB1] = 1.32; p[P.LB2] = 0.12;
      return p;
    },
    victory: function () {
      var p = POSES.stand();
      p[P.LEAN] = -0.08;
      p[P.AF1] = -0.9; p[P.AF2] = -0.5;
      p[P.AB1] = 1.30; p[P.AB2] = -1.40;
      return p;
    }
  };
  S.POSES = POSES;

  /* 线性插值两个姿态 */
  S.lerpPose = function (a, b, t, out) {
    out = out || pose();
    for (var i = 0; i < LEN; i++) out[i] = a[i] + (b[i] - a[i]) * t;
    return out;
  };

  /* ---------------- 基础绘制工具 ---------------- */
  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  S.rect = rect;

  function limb(ctx, len, w, angle, color, outline) {
    if (outline) {
      ctx.fillStyle = outline;
      ctx.fillRect(-1, -w / 2 - 1, len + 2, w + 2);
    }
    ctx.fillStyle = color;
    ctx.fillRect(0, -w / 2, len, w);
    ctx.translate(len, 0);
    ctx.rotate(angle);
  }

  /* ---------------- 角色主体绘制 ---------------- */
  /**
   * @param ctx   CanvasRenderingContext2D
   * @param o     { x, y, facing, pose, palette, build, scale, flash, alpha, rotate }
   */
  S.drawFighter = function (ctx, o) {
    var p = o.pose || POSES.stand();
    var pal = o.palette;
    var b = BUILD[o.build] || BUILD.normal;
    var sc = o.scale || 1;
    var dark = shade(pal.top, -0.45);
    var darkSkin = shade(pal.skin, -0.35);

    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(Math.round(o.x), Math.round(o.y));
    ctx.scale(o.facing >= 0 ? sc : -sc, sc);
    if (o.rotate) ctx.rotate(o.rotate);

    var flash = o.flash > 0;
    var C = flash
      ? { skin: '#ffffff', hair: '#ffffff', top: '#ffffff', bottom: '#ffffff', belt: '#ffffff', shoe: '#ffffff', glove: '#ffffff' }
      : pal;

    var hipY = -(b.thigh + b.shin) + p[P.HIPY];
    var shY = hipY - b.torso;
    var headCY = shY - b.headH * 0.72;
    var leanDx = Math.sin(p[P.LEAN]) * b.torso;

    /* --- 后腿 --- */
    ctx.save();
    ctx.translate(-1, hipY);
    ctx.rotate(p[P.LB1]);
    limb(ctx, b.thigh, b.limbW, p[P.LB2], shade(C.bottom, -0.25), dark);
    limb(ctx, b.shin, b.limbW - 1, 0, shade(C.bottom, -0.12), dark);
    rect(ctx, -2, -(b.limbW - 1) / 2, b.limbW + 4, b.limbW, C.shoe);
    ctx.restore();

    /* --- 后臂 --- */
    ctx.save();
    ctx.translate(-2, shY);
    ctx.rotate(p[P.AB1]);
    limb(ctx, b.upper, b.limbW - 1, p[P.AB2], shade(C.top, -0.22), dark);
    limb(ctx, b.fore, b.limbW - 2, 0, shade(C.skin, -0.15), darkSkin);
    rect(ctx, -1, -3, 5, 6, C.glove);
    ctx.restore();

    /* --- 躯干 --- */
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(p[P.LEAN] * 0.9);
    var tw = b.bodyW;
    rect(ctx, -tw / 2, -b.torso, tw, b.torso, C.top);
    // 胸口 V 领
    rect(ctx, -tw * 0.22, -b.torso, tw * 0.44, b.torso * 0.34, flash ? '#ffffff' : shade(pal.top, 0.30));
    // 腰带
    rect(ctx, -tw / 2 - 1, -5, tw + 2, 5, C.belt);
    // 下装
    rect(ctx, -tw / 2, -1, tw, 8, C.bottom);
    ctx.restore();

    /* --- 头 --- */
    ctx.save();
    ctx.translate(leanDx * 0.85 + p[P.HDX], headCY + p[P.HDY]);
    ctx.rotate(p[P.LEAN] * 0.5);
    var hw = b.headW, hh = b.headH;
    rect(ctx, -hw / 2, -hh / 2, hw, hh, C.skin);
    // 头发
    rect(ctx, -hw / 2 - 1, -hh / 2 - 3, hw + 2, 6, C.hair);
    rect(ctx, (o.facing >= 0 ? 1 : -1) * 0 + (p[P.LEAN] > 0.3 ? 2 : -1), -hh / 2 - 1, hw * 0.8, 4, C.hair);
    if (o.build !== 'heavy') {
      // 长发/鬓角
      rect(ctx, -hw / 2 - 1, -hh / 2 - 1, 3, hh * 0.8, C.hair);
    }
    // 眼睛（面向前方）
    if (!flash && o.eyes !== 'closed') {
      rect(ctx, hw * 0.02, -2, 3, 3, '#1a1a22');
      rect(ctx, hw * 0.30, -2, 2, 3, '#1a1a22');
    } else if (!flash) {
      rect(ctx, hw * 0.02, -1, 3, 1, '#1a1a22');
      rect(ctx, hw * 0.30, -1, 2, 1, '#1a1a22');
    }
    // 嘴
    rect(ctx, hw * 0.10, 4, 4, 1, flash ? '#ffffff' : shade(pal.skin, -0.5));
    ctx.restore();

    /* --- 前腿 --- */
    ctx.save();
    ctx.translate(2, hipY);
    ctx.rotate(p[P.LF1]);
    limb(ctx, b.thigh, b.limbW, p[P.LF2], C.bottom, dark);
    limb(ctx, b.shin, b.limbW - 1, 0, C.bottom, dark);
    rect(ctx, -2, -(b.limbW - 1) / 2, b.limbW + 5, b.limbW, C.shoe);
    ctx.restore();

    /* --- 前臂 --- */
    ctx.save();
    ctx.translate(2, shY);
    ctx.rotate(p[P.AF1]);
    limb(ctx, b.upper, b.limbW, p[P.AF2], C.top, dark);
    limb(ctx, b.fore, b.limbW - 1, 0, C.skin, darkSkin);
    rect(ctx, -1, -3, 6, 6, C.glove);
    ctx.restore();

    ctx.restore();
  };

  /* ---------------- 地面阴影 ---------------- */
  S.drawShadow = function (ctx, x, groundY, w, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.32 : alpha;
    ctx.fillStyle = '#000000';
    var hw = Math.max(2, Math.round(w / 2));
    ctx.fillRect(Math.round(x - hw), Math.round(groundY - 2), hw * 2, 3);
    ctx.fillRect(Math.round(x - hw + 2), Math.round(groundY - 3), hw * 2 - 4, 1);
    ctx.restore();
  };

  /* ---------------- 选人头像 ---------------- */
  S.drawPortrait = function (ctx, ch, x, y, w, h, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    // 背景
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(ch.palette.accent, -0.55));
    g.addColorStop(1, shade(ch.palette.top, -0.7));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 角色半身
    var p = POSES.stand();
    p[P.AF1] = 0.9; p[P.AF2] = -1.7;
    S.drawFighter(ctx, {
      x: w / 2, y: h + 26, facing: 1, pose: p, palette: ch.palette,
      build: ch.build, scale: 0.95, flash: opts.flash ? 1 : 0
    });
    ctx.restore();
    // 边框
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = opts.selected ? ch.palette.accent : 'rgba(255,255,255,0.18)';
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.restore();
  };

  /* ---------------- 颜色工具 ---------------- */
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
  /** 明暗调整：amt > 0 变亮，< 0 变暗 */
  function shade(hex, amt) {
    var c = hexToRgb(hex);
    var f = amt > 0 ? amt : 0;
    var d = amt < 0 ? -amt : 0;
    var r = clamp255(c.r + (255 - c.r) * f - c.r * d);
    var g = clamp255(c.g + (255 - c.g) * f - c.g * d);
    var b = clamp255(c.b + (255 - c.b) * f - c.b * d);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  S.shade = shade;

  S.rgba = function (hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
