#!/usr/bin/env node
/**
 * 把 core/ 下的平台无关代码同步到 Web 与小程序包内。
 * 小程序无法引用包外文件，Web 端为了 file:// 直开也不用 ES module，
 * 因此这里采用「单源 + 复制」的方式保持三端一致。
 *
 * 用法：node scripts/sync.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'core');
const TARGETS = [
  path.join(ROOT, 'web', 'js', 'core'),
  path.join(ROOT, 'miniprogram', 'core')
];

// 小程序的 require 需要模块显式导出，这里做一层包装
const WRAPPER_HEADER = `/**
 * 本文件由 scripts/sync.js 从 core/ 自动生成，请勿手改。
 * 修改请编辑仓库根目录 core/ 下的同名文件后重新执行：node scripts/sync.js
 */
`;
const MP_FOOTER = `
module.exports = (typeof globalThis !== 'undefined' ? globalThis : this).AK;
`;

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function sync() {
  if (!fs.existsSync(SRC)) throw new Error('core/ 目录不存在：' + SRC);
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
  let count = 0;

  for (const dir of TARGETS) {
    ensureDir(dir);
    for (const f of files) {
      const content = fs.readFileSync(path.join(SRC, f), 'utf8');
      let out;
      if (dir.includes('miniprogram')) {
        out = WRAPPER_HEADER + content + MP_FOOTER;
      } else {
        out = WRAPPER_HEADER + content;
      }
      const dest = path.join(dir, f);
      const old = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
      if (old !== out) {
        fs.writeFileSync(dest, out, 'utf8');
        console.log('  ✓ ' + path.relative(ROOT, dest));
      }
      count++;
    }
  }
  console.log(`同步完成：${files.length} 个核心文件 → ${TARGETS.length} 个目标 (${count} 次写入检查)`);
}

try {
  sync();
} catch (e) {
  console.error('同步失败：', e.message);
  process.exit(1);
}
