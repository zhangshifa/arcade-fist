/*!
 * 拳魂 ARCADE FIST — 音效
 * Web 端用 WebAudio 实时合成（无音频文件，包体为 0）；
 * 小程序端无 WebAudio，降级为 wx.vibrateShort 触感反馈。
 */
(function (root) {
  'use strict';
  var AK = (root.AK = root.AK || {});

  var A = {
    ctx: null,
    muted: false,
    isWx: false,
    ready: false
  };

  A.init = function (opts) {
    opts = opts || {};
    A.isWx = !!opts.isWx;
    if (A.isWx) { A.ready = true; return; }
    try {
      var Ctor = root.AudioContext || root.webkitAudioContext;
      if (!Ctor) return;
      A.ctx = new Ctor();
      A.ready = true;
    } catch (e) { A.ready = false; }
  };

  A.resume = function () {
    if (A.ctx && A.ctx.state === 'suspended') { try { A.ctx.resume(); } catch (e) {} }
  };

  A.setMuted = function (m) { A.muted = m; };

  /* 基础发声：振荡器 + 频率滑落 + 音量包络 */
  function tone(o) {
    if (!A.ctx || A.muted) return;
    var t = A.ctx.currentTime;
    var osc = A.ctx.createOscillator();
    var g = A.ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.18, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(A.ctx.destination);
    osc.start(t); osc.stop(t + o.dur + 0.02);
  }

  /* 噪声：用于打击的「啪」感 */
  function noise(dur, vol, filterFreq) {
    if (!A.ctx || A.muted) return;
    var len = Math.floor(A.ctx.sampleRate * dur);
    var buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = A.ctx.createBufferSource();
    src.buffer = buf;
    var bp = A.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = filterFreq || 1400;
    var g = A.ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(bp); bp.connect(g); g.connect(A.ctx.destination);
    src.start();
  }

  var FX = {
    punch:  function () { noise(0.07, 0.22, 1800); tone({ type: 'square', f0: 320, f1: 120, dur: 0.09, vol: 0.14 }); },
    hit:    function () { noise(0.13, 0.34, 900);  tone({ type: 'sawtooth', f0: 200, f1: 60,  dur: 0.16, vol: 0.20 }); },
    heavy:  function () { noise(0.2, 0.4, 620);   tone({ type: 'sawtooth', f0: 150, f1: 45,  dur: 0.24, vol: 0.24 }); },
    block:  function () { tone({ type: 'square', f0: 900, f1: 700, dur: 0.07, vol: 0.13 }); },
    jump:   function () { tone({ type: 'sine', f0: 300, f1: 620, dur: 0.11, vol: 0.12 }); },
    land:   function () { noise(0.06, 0.14, 380); },
    ko:     function () {
      tone({ type: 'sawtooth', f0: 260, f1: 50, dur: 0.55, vol: 0.24 });
      noise(0.4, 0.3, 420);
    },
    special:function () {
      tone({ type: 'sawtooth', f0: 180, f1: 900, dur: 0.28, vol: 0.2 });
      setTimeout(function () { noise(0.3, 0.3, 1200); }, 60);
    },
    fire:   function () { tone({ type: 'square', f0: 700, f1: 220, dur: 0.22, vol: 0.16 }); },
    ui:     function () { tone({ type: 'square', f0: 620, f1: 880, dur: 0.05, vol: 0.10 }); },
    move:   function () { tone({ type: 'square', f0: 480, f1: 480, dur: 0.035, vol: 0.07 }); },
    confirm:function () { tone({ type: 'square', f0: 520, f1: 780, dur: 0.09, vol: 0.12 }); },
    bell:   function () { tone({ type: 'sine', f0: 880, f1: 880, dur: 0.18, vol: 0.16 }); },
    win:    function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        setTimeout(function () { tone({ type: 'square', f0: f, f1: f, dur: 0.16, vol: 0.14 }); }, i * 110);
      });
    },
    lose:   function () {
      [440, 392, 330, 262].forEach(function (f, i) {
        setTimeout(function () { tone({ type: 'triangle', f0: f, f1: f, dur: 0.22, vol: 0.14 }); }, i * 150);
      });
    },
    coin:   function () { tone({ type: 'square', f0: 988, f1: 1319, dur: 0.12, vol: 0.13 }); }
  };

  var VIB = { punch: 'short', hit: 'short', heavy: 'long', ko: 'long', special: 'long', block: 'short', win: 'long' };

  A.play = function (name) {
    if (A.muted) return;
    if (A.isWx && root.wx && root.wx.vibrateShort) {
      if (VIB[name]) {
        try { VIB[name] === 'long' ? root.wx.vibrateLong({ fail: function () {} }) : root.wx.vibrateShort({ fail: function () {} }); } catch (e) {}
      }
      return;
    }
    var f = FX[name];
    if (f && A.ctx) {
      A.resume();
      try { f(); } catch (e) {}
    }
  };

  AK.audio = A;
})(typeof globalThis !== 'undefined' ? globalThis : this);
