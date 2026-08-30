/**
 * 本文件由 scripts/sync.js 从 core/ 自动生成，请勿手改。
 * 修改请编辑仓库根目录 core/ 下的同名文件后重新执行：node scripts/sync.js
 */
/*!
 * 拳魂 ARCADE FIST — 存储适配层
 * Web 用 localStorage（file:// 下自动降级为内存存储），小程序用 wx storage API。
 */
(function (root) {
  'use strict';
  var AK = (root.AK = root.AK || {});
  var mem = {};
  var useMem = false;

  function isWx() { return !!(root.wx && root.wx.getStorageSync); }

  try {
    if (!root.localStorage) useMem = true;
    else { root.localStorage.setItem('__t', '1'); root.localStorage.removeItem('__t'); }
  } catch (e) { useMem = true; }

  AK.storage = {
    get: function (k, def) {
      try {
        var v;
        if (isWx()) v = root.wx.getStorageSync(k);
        else if (useMem) v = mem[k];
        else v = root.localStorage.getItem(k);
        if (v === '' || v == null) return def;
        return v;
      } catch (e) { return def; }
    },
    set: function (k, v) {
      try {
        if (isWx()) root.wx.setStorageSync(k, v);
        else if (useMem) mem[k] = String(v);
        else root.localStorage.setItem(k, String(v));
      } catch (e) {}
    },
    getJSON: function (k, def) {
      var raw = AK.storage.get(k, null);
      if (raw == null) return def;
      try { return JSON.parse(raw); } catch (e) { return def; }
    },
    setJSON: function (k, obj) { AK.storage.set(k, JSON.stringify(obj)); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

module.exports = (typeof globalThis !== 'undefined' ? globalThis : this).AK;
