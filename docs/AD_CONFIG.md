# 广告变现配置与上线指南

拳魂 ARCADE FIST 的广告逻辑全部通过 `AK.ads` 抽象层调用，游戏代码只关心语义
（看激励视频 / 弹插屏 / 显示 Banner），**底层实现与「调试模拟 / 真实广告」的切换由配置决定**。

---

## 一、调试模式（开发期，默认开启）

`core/constants.js`：

```js
AK.ADS = {
  debug: true,            // ← 默认 true，不请求任何真实广告 SDK
  wx: { bannerId: '', rewardedId: '', interstitialId: '' },
  web: { bannerSlot: '', rewardedHook: null, interstitialHook: null },
  policy: { interstitialEveryRounds: 3, rewardMultiplier: 3 }
};
```

调试模式下：

- 不初始化任何广告 SDK，不会产生真实曝光与收益。
- 广告以 **Canvas 内模拟面板**呈现：5 秒倒计时（插屏 4 秒）、倒计时结束可点「领取并关闭」、中途关闭按 `isEnded=false` 语义回调（不发放奖励）。
- 完整观看才回调 `ok:true`，与微信 `res.isEnded` 语义一致。
- 广告播放期间游戏逻辑冻结（`update` 内 `isMockShowing()` 拦截），保证无后台偷跑。

开发者工具 / 本地浏览器中可完整走通：看广告解锁、复活、翻倍、插屏频次。

---

## 二、微信小程序 —— 接入真实广告

1. 在 **微信公众平台 → 流量主** 申请开通，获取广告位 ID（形如 `adunit-xxxxxxxx`）。
2. 填入 `core/constants.js` 的 `AK.ADS.wx`：

   ```js
   AK.ADS = {
     debug: false,                 // ← 改为 false 启用真实广告
     wx: {
       bannerId: 'adunit-xxxx',    // Banner
       rewardedId: 'adunit-xxxx',  // 激励视频
       interstitialId: 'adunit-xxxx'// 插屏
     },
     ...
   }
   ```
3. 运行 `node scripts/sync.js` 同步到 `miniprogram/core/constants.js`。
4. 真机预览 / 提审。注意：
   - 激励视频与插屏需流量主审核通过且 category 匹配才可展示；
   - 测试号（`touristappid`）无法展示真实广告，需用自有 AppID。
   - 广告组件拉取失败已做降级（`try/catch`），不会崩游戏。

### 广告语义映射

| 调用 | 微信 API | 回调约定 |
| --- | --- | --- |
| `AK.ads.showRewarded(cb)` | `wx.createRewardedVideoAd().show()` | `cb({ok: res.isEnded})` |
| `AK.ads.showInterstitial(cb)` | `wx.createInterstitialAd().show()` | `cb({ok:true})` 关闭即发放 |
| `AK.ads.showBanner()` / `hideBanner()` | `wx.createBannerAd()` | 仅曝光，无奖励 |

---

## 三、Web / H5 —— 接入真实广告

`AK.ADS.web` 预留两类钩子：

```js
AK.ADS = {
  debug: false,
  web: {
    bannerSlot: 'xxxx',     // 联盟广告位（自行接入）
    rewardedHook: null,     // function(cb) 自行对接激励视频
    interstitialHook: null   // function(cb) 自行对接插屏
  }
};
```

- 把 `rewardedHook` / `interstitialHook` 设为 `(cb) => {...}` 函数，内部对接你的广告联盟
  （如优量汇、穿山甲 Web 版或自定义 JS 广告），播放结束调用 `cb({ok:true/false})`。
- Banner 用 `bannerSlot` 自行插入 DOM（如 `document.getElementById('cab')` 内）。

> H5 版当前未默认挂载真实广告 DOM，可按运营需要自行集成；逻辑层接口已就绪。

---

## 四、变现场景清单

| 场景 | 接口 | 奖励 |
| --- | --- | --- |
| 解锁角色 | `showRewarded` | 解锁 `CHARACTERS` 中 `locked:true` 的角色 |
| 失败复活 | `showRewarded` | 回退对手 1 个胜点，继续决胜 |
| 金币翻倍 | `showRewarded` | 本局结算金币 ×`policy.rewardMultiplier`（默认 3） |
| 回合结束插屏 | `showInterstitial` | 无直接奖励，提曝光收益；每 `interstitialEveryRounds` 回合一次 |

---

## 五、统计

`AK.ads.stats` 实时记录：

```js
{ rewardedShown, rewardedDone, interstitialShown, bannerShown }
```

调试面板上会显示「激励 Done/Shown · 插屏 Shown」。正式环境可对接自有上报。
