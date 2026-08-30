/**
 * 本文件由 scripts/sync.js 从 core/ 自动生成，请勿手改。
 * 修改请编辑仓库根目录 core/ 下的同名文件后重新执行：node scripts/sync.js
 */
/*!
 * 拳魂 ARCADE FIST — 广告变现模块
 *
 * 设计目标：游戏逻辑只调用 AK.ads.showRewarded() 等语义接口，
 * 底层自动切换「调试模拟」与「真实广告」，上线只需改配置不改动游戏代码。
 *
 * 调试模式（AK.ADS.debug = true）：
 *   不请求任何真实广告 SDK，在 Canvas 内绘制模拟广告面板：
 *   含倒计时、可关闭、按真实广告语义回调 onClose({isEnded})。
 *   用于开发者工具/本地调试，保证变现流程可完整走通。
 *
 * 正式模式：
 *   wx   —— 使用 createBannerAd / createRewardedVideoAd / createInterstitialAd
 *   web  —— 使用配置中的联盟 hook（或自行替换为任意 JS 广告代码）
 */
(function (root) {
  'use strict';
  var AK = (root.AK = root.AK || {});

  var Ads = {
    platform: 'web',
    inited: false,
    // 模拟广告状态
    mockState: 'idle',   // idle | rewarded | interstitial
    mockTimer: 0,
    mockTotal: 0,
    mockCb: null,
    mockTitle: '',
    // 真实广告实例
    _banner: null,
    _rewarded: null,
    _interstitial: null,
    // 频次与统计
    stats: { rewardedShown: 0, rewardedDone: 0, interstitialShown: 0, bannerShown: 0 },
    lastInterstitialRound: -99
  };

  Ads.init = function (platform, opts) {
    opts = opts || {};
    Ads.platform = platform || 'web';
    Ads.ctx = opts.ctx || null;
    Ads.onLog = opts.onLog || function () {};
    if (Ads.inited) return;
    Ads.inited = true;

    if (!AK.ADS.debug) {
      try {
        if (Ads.platform === 'wx' && root.wx && root.wx.createBannerAd) {
          if (AK.ADS.wx.bannerId) {
            Ads._banner = root.wx.createBannerAd({
              adUnitId: AK.ADS.wx.bannerId,
              style: { left: 0, top: 0, width: 320 }
            });
            Ads._banner.onError(function (e) { Ads.onLog('banner error', e); });
            Ads._banner.onResize(function (res) {
              Ads._banner.style.top = Ads.bannerTop(res.height);
            });
          }
          if (AK.ADS.wx.rewardedId) {
            Ads._rewarded = root.wx.createRewardedVideoAd({ adUnitId: AK.ADS.wx.rewardedId });
            Ads._rewarded.onError(function (e) { Ads.onLog('rewarded error', e); });
          }
          if (AK.ADS.wx.interstitialId) {
            Ads._interstitial = root.wx.createInterstitialAd({ adUnitId: AK.ADS.wx.interstitialId });
            Ads._interstitial.onError(function (e) { Ads.onLog('interstitial error', e); });
          }
        }
      } catch (e) { Ads.onLog('ads init fail', e); }
    }
  };

  Ads.bannerTop = function (h) {
    // 贴底显示（style.top 单位为 px，按 375 基准换算，实际由调用方给屏幕高）
    var sh = (root.window && root.window.innerHeight) || 667;
    var sw = (root.window && root.window.innerWidth) || 375;
    return Math.max(0, sh - h);
  };

  /* ---------------- Banner ---------------- */
  Ads.showBanner = function () {
    Ads.stats.bannerShown++;
    if (AK.ADS.debug) { Ads.onLog('[AD-DEBUG] banner show'); return; }
    if (Ads._banner) {
      try { Ads._banner.show(); } catch (e) { Ads.onLog('banner show fail', e); }
    }
  };

  Ads.hideBanner = function () {
    if (AK.ADS.debug) { Ads.onLog('[AD-DEBUG] banner hide'); return; }
    if (Ads._banner) { try { Ads._banner.hide(); } catch (e) {} }
  };

  /* ---------------- 激励视频 ----------------
   * @param cb  function({ ok:Boolean, reason:String })
   *            ok=true 表示完整观看，应发放奖励
   */
  Ads.showRewarded = function (cb) {
    cb = cb || function () {};
    Ads.stats.rewardedShown++;

    if (AK.ADS.debug || !Ads._rewarded) {
      Ads.mockState = 'rewarded';
      Ads.mockTotal = 5 * 60;   // 5 秒（60fps 计）
      Ads.mockTimer = Ads.mockTotal;
      Ads.mockCb = cb;
      Ads.mockTitle = '激励视频 · 模拟广告';
      Ads.onLog('[AD-DEBUG] rewarded show (mock)');
      return;
    }

    var r = Ads._rewarded;
    var settled = false;
    function done(ok, reason) {
      if (settled) return;
      settled = true;
      r.offClose(closeHandler);
      if (ok) Ads.stats.rewardedDone++;
      cb({ ok: ok, reason: reason });
    }
    function closeHandler(res) {
      // 微信语义：res.isEnded 为 true 表示完整看完
      done(!!(res && res.isEnded), res && res.isEnded ? 'completed' : 'aborted');
    }
    r.onClose(closeHandler);
    r.load().then(function () { return r.show(); })
      .catch(function (err) {
        r.show().catch(function (e2) {
          done(false, 'no-fill');
          Ads.onLog('rewarded show fail', err, e2);
        });
      });
  };

  /* ---------------- 插屏 ---------------- */
  Ads.showInterstitial = function (cb) {
    cb = cb || function () {};
    Ads.stats.interstitialShown++;
    Ads.lastInterstitialRound = AK.__roundCount || 0;

    if (AK.ADS.debug || !Ads._interstitial) {
      Ads.mockState = 'interstitial';
      Ads.mockTotal = 4 * 60;
      Ads.mockTimer = Ads.mockTotal;
      Ads.mockCb = cb;
      Ads.mockTitle = '插屏广告 · 模拟';
      Ads.onLog('[AD-DEBUG] interstitial show (mock)');
      return;
    }
    Ads._interstitial.show().catch(function (e) {
      Ads.onLog('interstitial show fail', e);
      cb({ ok: false, reason: 'no-fill' });
    });
    Ads._interstitial.onClose(function () { cb({ ok: true, reason: 'closed' }); });
  };

  /** 是否应该在本回合结束弹插屏（含频次控制） */
  Ads.shouldShowInterstitial = function (roundCount) {
    if (AK.ADS.debug) return (roundCount - Ads.lastInterstitialRound) >= AK.ADS.policy.interstitialEveryRounds;
    return !!Ads._interstitial && (roundCount - Ads.lastInterstitialRound) >= AK.ADS.policy.interstitialEveryRounds;
  };

  /* ---------------- 模拟广告驱动 ---------------- */
  Ads.update = function () {
    if (Ads.mockState === 'idle') return;
    Ads.mockTimer--;
    if (Ads.mockTimer <= 0) {
      Ads.finishMock(true);
    }
  };

  /** 用户在模拟广告面板上的操作 */
  Ads.closeMock = function (completed) {
    Ads.finishMock(completed);
  };

  Ads.finishMock = function (completed) {
    if (Ads.mockState === 'idle') return;
    var kind = Ads.mockState;
    var cb = Ads.mockCb;
    Ads.mockState = 'idle';
    Ads.mockCb = null;
    if (kind === 'rewarded') {
      if (completed) Ads.stats.rewardedDone++;
      cb && cb({ ok: !!completed, reason: completed ? 'completed' : 'aborted' });
    } else {
      cb && cb({ ok: true, reason: 'closed' });
    }
  };

  Ads.isMockShowing = function () { return Ads.mockState !== 'idle'; };

  /* ---------------- 模拟广告面板绘制 ---------------- */
  Ads.render = function (ctx, W, H) {
    if (Ads.mockState === 'idle') return;
    var isReward = Ads.mockState === 'rewarded';
    var left = Math.ceil(Ads.mockTimer / 60);
    var total = Math.ceil(Ads.mockTotal / 60);

    ctx.save();
    ctx.fillStyle = 'rgba(6,8,14,0.86)';
    ctx.fillRect(0, 0, W, H);

    var pw = Math.min(W - 40, 340), ph = 150;
    var px = (W - pw) / 2, py = (H - ph) / 2;

    ctx.fillStyle = '#12151f';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = isReward ? '#ffd447' : '#6fd7ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);

    // 顶部标签
    ctx.fillStyle = isReward ? '#ffd447' : '#6fd7ff';
    ctx.fillRect(px, py, pw, 20);
    ctx.fillStyle = '#12151f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(Ads.mockTitle + '（DEBUG）', px + 8, py + 10);

    // 广告位内容
    ctx.fillStyle = '#1c2230';
    ctx.fillRect(px + 10, py + 28, pw - 20, ph - 78);
    ctx.fillStyle = '#5b6478';
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.fillText('这里将展示真实广告内容', px + pw / 2, py + 64);
    ctx.fillText('上线后填入广告位 ID 即可变现', px + pw / 2, py + 82);

    // 倒计时进度条
    var bw = pw - 40, bx = px + 20, by = py + ph - 42;
    ctx.fillStyle = '#2a3142';
    ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = isReward ? '#ffd447' : '#6fd7ff';
    ctx.fillRect(bx, by, Math.round(bw * (1 - Ads.mockTimer / Ads.mockTotal)), 6);

    ctx.fillStyle = '#f5f3ea';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isReward ? (left + ' 秒后可领取奖励') : (left + ' 秒后可关闭'), bx, by + 18);

    // 关闭按钮（仅倒计时结束可点）
    var canClose = Ads.mockTimer <= 0;
    var cbx = px + pw - 74, cby = py + ph - 30, cbw = 62, cbh = 22;
    ctx.fillStyle = canClose ? (isReward ? '#ffd447' : '#6fd7ff') : '#333a4a';
    ctx.fillRect(cbx, cby, cbw, cbh);
    ctx.fillStyle = canClose ? '#12151f' : '#7d869a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(canClose ? '领取并关闭' : '广告播放中', cbx + cbw / 2, cby + 11);

    ctx.restore();
  };

  /** 命中测试：模拟广告面板的关闭按钮 */
  Ads.hitCloseButton = function (x, y, W, H) {
    if (Ads.mockState === 'idle') return false;
    var pw = Math.min(W - 40, 340), ph = 150;
    var px = (W - pw) / 2, py = (H - ph) / 2;
    var cbx = px + pw - 74, cby = py + ph - 30;
    return x >= cbx && x <= cbx + 62 && y >= cby && y <= cby + 22;
  };

  /** 统计信息（调试面板用） */
  Ads.summary = function () {
    return '激励 ' + Ads.stats.rewardedDone + '/' + Ads.stats.rewardedShown +
           ' · 插屏 ' + Ads.stats.interstitialShown;
  };

  AK.ads = Ads;
})(typeof globalThis !== 'undefined' ? globalThis : this);
