#!/usr/bin/env node
/**
 * 拳魂 ARCADE FIST —— 通过 api.github.com 推送（Git Data API）
 *
 * 适用场景：沙箱内 github.com:443 被拦截，所有推送改走 api.github.com。
 *
 * 安全：token 只从环境变量 GITHUB_TOKEN 读取，绝不硬编码进本文件。
 * 运行（在可访问 api.github.com 的网络环境下，如关闭沙箱）：
 *   GITHUB_TOKEN=ghp_xxx node scripts/github-push-api.mjs
 *
 * 流程：查重 → 建库（空库先 Contents 引导 main）→ blob/tree/commit → 更新 main
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const OWNER = 'zhangshifa';
const REPO = 'arcade-fist';
const API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN;
const COMMIT_MSG = 'feat: 拳魂 ARCADE FIST —— 原创像素街机格斗（小程序+H5，调试模式，广告变现）';

const HEADERS = (extra = {}) => ({
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'arcade-fist-push',
  'X-GitHub-Api-Version': '2022-11-28',
  ...extra
});

// 忽略规则
const SKIP_DIRS = new Set(['node_modules', '.git', '.workbuddy', 'dist', 'miniprogram_dist']);
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db']);
function isSkippedFile(name) {
  return name.endsWith('.local.js') || name.endsWith('.log') || name.startsWith('.env');
}

let pushedCount = 0;

async function gh(method, path, body, allowCodes = []) {
  const url = API + path;
  const res = await fetch(url, {
    method,
    headers: HEADERS(body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const okCodes = [200, 201, 202, 204, ...allowCodes];
  if (!okCodes.includes(res.status)) {
    let detail = '';
    try { detail = await res.text(); } catch (e) {}
    const err = new Error(`HTTP ${res.status} ${method} ${path}\n${detail.slice(0, 600)}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  if (res.status === 404) return null; // 允许 404 时返回 null，便于调用方区分「不存在」
  try { return await res.json(); } catch (e) { return null; }
}

function collectFiles(dir, base, out) {
  const entries = readdirSync(dir);
  for (const e of entries) {
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(e)) continue;
      collectFiles(full, base, out);
    } else {
      if (SKIP_FILES.has(e) || isSkippedFile(e)) continue;
      const rel = relative(base, full).split(sep).join('/');
      out.push(rel);
    }
  }
}

async function main() {
  if (!TOKEN) {
    console.error('✗ 缺少 GITHUB_TOKEN 环境变量。用法：GITHUB_TOKEN=ghp_xxx node scripts/github-push-api.mjs');
    process.exit(1);
  }
  console.log(`→ 目标仓库：${OWNER}/${REPO}`);

  // 1. 查重（404 视为不存在）
  let repo = await gh('GET', `/repos/${OWNER}/${REPO}`, null, [404]);
  if (!repo) {
    console.log('  · 仓库不存在，开始创建');
    repo = await gh('POST', `/user/repos`, {
      name: REPO,
      description: '拳魂 ARCADE FIST —— 原创像素街机格斗（小程序+H5，调试模式开发，广告变现）。点开即玩。',
      private: false,
      auto_init: false,
      has_issues: true,
      has_wiki: false
    });
    console.log('  ✓ 仓库已创建：' + repo.html_url);
  } else {
    console.log('  · 仓库已存在，直接推送');
  }

  // 2. 确定 main 分支是否存在（404 / 空库 409 视为无 main）
  let baseSha = null;
  const ref = await gh('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, null, [404, 409]);
  if (ref && ref.object) {
    baseSha = ref.object.sha;
    console.log('  · main 已存在，base = ' + baseSha.slice(0, 8));
  } else {
    console.log('  · main 不存在（空库），用 Contents API 引导初始化首个提交');
    // 空库 Git Data API 会 409，先用 Contents API 建一个最小 README 初始化 main 分支
    const initContent = Buffer.from('# ' + REPO + '\n', 'utf8').toString('base64');
    await gh('PUT', `/repos/${OWNER}/${REPO}/contents/README.md`, {
      message: 'init: bootstrap main branch',
      content: initContent
    });
    const ref2 = await gh('GET', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, null, [404, 409]);
    baseSha = ref2.object.sha;
    console.log('  ✓ main 已初始化，base = ' + baseSha.slice(0, 8));
  }

  // 3. 收集文件 → 建 blob
  const files = [];
  collectFiles(ROOT, ROOT, files);
  files.sort();
  console.log(`  · 待推送文件 ${files.length} 个`);

  const tree = [];
  for (const rel of files) {
    const content = readFileSync(join(ROOT, rel), 'utf8');
    const blob = await gh('POST', `/repos/${OWNER}/${REPO}/git/blobs`, {
      content: Buffer.from(content, 'utf8').toString('base64'),
      encoding: 'base64'
    });
    tree.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
    pushedCount++;
  }

  // 4. 建 tree（带 base_tree）
  const newTree = await gh('POST', `/repos/${OWNER}/${REPO}/git/trees`, {
    base_tree: baseSha,
    tree
  });

  // 5. 建 commit
  const commit = await gh('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: COMMIT_MSG,
    tree: newTree.sha,
    parents: [baseSha]
  });
  console.log('  ✓ 提交 ' + commit.sha.slice(0, 8));

  // 6. 更新（或创建）main 引用
  try {
    await gh('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
    console.log('  ✓ 已更新 main → ' + commit.sha.slice(0, 8));
  } catch (e) {
    if (e.status === 422) {
      await gh('POST', `/repos/${OWNER}/${REPO}/git/refs`, { ref: 'refs/heads/main', sha: commit.sha });
      console.log('  ✓ 已创建 main → ' + commit.sha.slice(0, 8));
    } else {
      throw e;
    }
  }

  // 7. 补充仓库元信息
  try {
    await gh('PATCH', `/repos/${OWNER}/${REPO}`, {
      description: '拳魂 ARCADE FIST —— 原创像素街机格斗（小程序+H5，调试模式开发，广告变现）。点开即玩。',
      topics: ['arcade', 'fighting-game', 'pixel-art', 'miniprogram', 'h5', 'wechat', 'ad-monetization', 'game']
    });
    console.log('  ✓ 已更新仓库描述与 topics');
  } catch (e) {
    console.warn('  ! 元信息更新失败（不影响代码）：' + e.message);
  }

  console.log(`\n✅ 推送完成：${API.replace('api.', '')}${OWNER}/${REPO}`);
  console.log(`   文件数：${pushedCount}`);
  console.log(`   提交：${commit.html_url}`);
}

main().catch((e) => {
  console.error('\n✗ 推送失败：', e.message);
  process.exit(1);
});
