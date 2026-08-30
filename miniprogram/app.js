/**
 * 拳魂 ARCADE FIST — 小程序入口
 * 调试模式开发：默认不预加载任何广告，广告位 ID 留空时自动走模拟广告。
 */
App({
  onLaunch() {
    // 记录启动信息，便于调试期排查
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.globalData = {
        pixelRatio: info.pixelRatio || 2,
        windowWidth: info.windowWidth || 375,
        windowHeight: info.windowHeight || 667,
        platform: info.platform || 'devtools'
      };
    } catch (e) {
      this.globalData = { pixelRatio: 2, windowWidth: 375, windowHeight: 667, platform: 'unknown' };
    }
    console.log('[ARCADE FIST] launch', this.globalData);
  },
  globalData: {}
});
