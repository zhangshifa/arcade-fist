#!/usr/bin/env node
/**
 * 拳魂 ARCADE FIST — 无头冒烟测试
 * 用模拟 Canvas Context 在 Node 中跑完整对局，验证：
 *   1. 核心模块可加载（含小程序副本）
 *   2. 场景机、对战、必杀、AI、结算流程无异常
 *   3. 广告模块（调试模拟）回调链路正确
 *   4. 存档 / 金币 / 解锁逻辑正确
 *
 * 用法：node scripts/smoke-test.js
 */
const path = require('path');

/* ---------------- Mock Canvas 2D ---------------- */
function mockCtx() {
  const grad = { addColorStop() {} };
  const base = {
    measureText: (t) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => null,
    getImageData: () => ({ data: [] })
  };
  return new Proxy(base, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string') return () => undefined;
      return undefined;
    },
    set() { return true; }
  });
}

/* ---------------- Mock 浏览器环境 ---------------- */
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
global.window = global;

/* ---------------- 加载核心模块 ---------------- */
const ROOT = path.resolve(__dirname, '..');
const CORE = ['constants', 'sprites', 'storage', 'audio', 'ads', 'fighter', 'ai', 'game'];
for (const m of CORE) require(path.join(ROOT, 'core', m + '.js'));
const AK = global.AK;

/* ---------------- 测试框架 ---------------- */
let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name); console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n' + t); }

/* ================= 1. 模块加载 ================= */
section('[1] 模块加载');
ok(!!AK && !!AK.Game && !!AK.Fighter && !!AK.AI && !!AK.sprites && !!AK.ads, '核心模块全部就绪');
ok(AK.CHARACTERS.length === 4, '4 名角色已定义', AK.CHARACTERS.length);
ok(AK.DIFFICULTY.length === 4, '4 档难度已定义');
ok(AK.ADS.debug === true, '广告默认处于调试模拟模式');

const mpCore = require(path.join(ROOT, 'miniprogram', 'core', 'constants.js'));
ok(mpCore === AK, '小程序副本与源共用同一 AK 对象');

/* ================= 2. 创建游戏 ================= */
section('[2] 游戏初始化');
const ctx = mockCtx();
const game = new AK.Game({ platform: 'web' });
game.view = { scale: 1, ox: 0, oy: 0 };
ok(game.scene === 'title', '初始场景为标题页', game.scene);
game.render(ctx);
ok(true, '标题页渲染无异常');

/* ================= 3. 场景流转 ================= */
section('[3] 场景流转');
game.onUiClick('start');
ok(game.scene === 'select', '进入选人页', game.scene);
game.render(ctx);
ok(game.hotspots.length > 0, '选人页生成了可点击热区', game.hotspots.length);

game.onUiClick('pick:0');
ok(game.sel.p1 === 0, '选中第 1 位角色');
game.onUiClick('diff:2');
ok(game.sel.difficulty === 2, '难度切换为困难');
game.onUiClick('fight');
ok(game.scene === 'battle', '进入对战', game.scene);
ok(!!game.f1 && !!game.f2, '双方角色已创建');
ok(game.f1.ch.id !== game.f2.ch.id, '对手不会与自己相同');

/* ================= 4. 完整对局 ================= */
section('[4] 模拟完整对局（最多 3 回合 x 60 秒）');
let frames = 0;
let errored = null;
let sawDamage = false;
let sawSpecial = false;
const hp0 = game.f2.hp;

try {
  while (frames < 60 * 200 && game.scene === 'battle') {
    frames++;
    // 玩家输入：随机出招 + 持续靠近
    const r = Math.random();
    if (r < 0.10) game.press.a = true;
    else if (r < 0.18) game.press.b = true;
    else if (r < 0.24) game.press.c = true;
    else if (r < 0.30) game.press.d = true;
    else if (r < 0.33 && game.f1.power >= game.f1.maxPower) { game.press.special = true; sawSpecial = true; }
    if (Math.random() < 0.6) game.held.right = true; else delete game.held.right;
    game.update(1000 / 60);
    game.render(ctx);
    if (game.f2.hp < hp0) sawDamage = true;
  }
} catch (e) { errored = e; }

ok(!errored, '对局全程无异常', errored && errored.stack ? errored.stack.split('\n').slice(0, 3).join(' | ') : '');
ok(frames < 60 * 200, '对局能正常结束（未死循环）', 'frames=' + frames);
ok(sawDamage, '玩家能对对手造成伤害');
ok(game.wins[0] + game.wins[1] >= 1, '产生了回合胜负', game.wins.join('-'));
ok(game.scene === 'result', '对局结束后进入结算页', game.scene);
game.render(ctx);
ok(true, '结算页渲染无异常');

/* ================= 5. 必杀技 ================= */
section('[5] 必杀技四种类型');
for (const ch of AK.CHARACTERS) {
  const g = new AK.Game({ platform: 'web' });
  g.view = { scale: 1, ox: 0, oy: 0 };
  g.startMatch(ch.id, 'normal');
  g.f1.power = g.f1.maxPower;
  g.phase = 'fight';
  g.f2.x = g.f1.x + 70;
  let fired = false;
  try {
    for (let i = 0; i < 60; i++) {
      if (i === 2) { g.press.special = true; }
      g.update(1000 / 60);
      g.render(ctx);
      // 只要进入必杀状态即视为释放成功（projectile 在贴身时一帧命中即消失，不能只查残留弹道）
      if (g.f1.state === 'special' || g.projectiles.length > 0 || g.effects.length > 0) fired = true;
    }
  } catch (e) { errored = e; }
  ok(!errored && fired, ch.name + ' 的「' + ch.special.name + '」成功释放', errored ? errored.message : 'no effect');
}

/* ================= 6. AI 四档难度 ================= */
section('[6] AI 难度');
for (const d of AK.DIFFICULTY) {
  const g = new AK.Game({ platform: 'web' });
  g.view = { scale: 1, ox: 0, oy: 0 };
  g.startMatch('ryan', d.id);
  g.phase = 'fight';
  let acted = false;
  try {
    for (let i = 0; i < 240; i++) {
      g.update(1000 / 60);
      g.render(ctx);
      if (g.f2.state !== 'idle' || Math.abs(g.f2.x - 330) > 4) acted = true;
    }
  } catch (e) { errored = e; }
  ok(!errored && acted, 'AI[' + d.name + '] 有决策行为', errored ? errored.message : '');
}

/* ================= 7. 广告模块（调试模拟） ================= */
section('[7] 广告变现链路');
AK.ads.mockState = 'idle';
let adResult = null;
AK.ads.showRewarded((res) => { adResult = res; });
ok(AK.ads.isMockShowing(), '激励视频进入模拟播放态');
// 播放中游戏应被冻结
const g2 = new AK.Game({ platform: 'web' });
g2.view = { scale: 1, ox: 0, oy: 0 };
g2.startMatch('ryan', 'normal');
const hpBefore = g2.f2.hp;
for (let i = 0; i < 60; i++) { g2.update(1000 / 60); }
ok(g2.f2.hp === hpBefore, '广告播放期间游戏逻辑被冻结');
for (let i = 0; i < 5 * 60 + 5; i++) AK.ads.update();
ok(adResult && adResult.ok === true, '完整观看后回调 ok=true', JSON.stringify(adResult));
ok(!AK.ads.isMockShowing(), '广告结束后恢复游戏');

let adAbort = null;
AK.ads.showRewarded((res) => { adAbort = res; });
AK.ads.closeMock(false);
ok(adAbort && adAbort.ok === false, '中途关闭回调 ok=false（不发放奖励）');
ok(AK.ads.stats.rewardedDone === 1 && AK.ads.stats.rewardedShown === 2, '广告统计正确',
  AK.ads.summary());

/* ================= 8. 经济与解锁 ================= */
section('[8] 金币与角色解锁');
const g3 = new AK.Game({ platform: 'web' });
g3.view = { scale: 1, ox: 0, oy: 0 };
g3.setScene('select');
const lockedChar = AK.CHARACTERS.findIndex((c) => c.locked);
ok(lockedChar >= 0, '存在需解锁的角色');
g3.onUiClick('pick:' + lockedChar);
ok(!g3.isUnlocked(AK.CHARACTERS[lockedChar].id), '锁定角色初始不可用');
g3.save.coins = AK.ECON.characterPrice;
g3.onUiClick('unlockCoin');
ok(g3.isUnlocked(AK.CHARACTERS[lockedChar].id), '金币解锁成功');
ok(g3.save.coins === 0, '金币正确扣除', g3.save.coins);

const g4 = new AK.Game({ platform: 'web' });
g4.view = { scale: 1, ox: 0, oy: 0 };
g4.setScene('select');
g4.onUiClick('pick:' + lockedChar);
g4.onUiClick('unlockAd');
ok(AK.ads.isMockShowing(), '看广告解锁触发模拟广告');
for (let i = 0; i < 5 * 60 + 5; i++) { AK.ads.update(); }
ok(g4.isUnlocked(AK.CHARACTERS[lockedChar].id), '广告解锁成功');

/* ================= 9. 复活与双倍奖励 ================= */
section('[9] 复活与双倍奖励');
const g5 = new AK.Game({ platform: 'web' });
g5.view = { scale: 1, ox: 0, oy: 0 };
g5.startMatch('ryan', 'normal');
g5.wins = [0, 2];
g5.matchResult = { win: false, coins: 15, doubled: false, score: '0 - 2' };
g5.setScene('result');
g5.render(ctx);
g5.onUiClick('revive');
ok(AK.ads.isMockShowing(), '复活按钮触发激励视频');
for (let i = 0; i < 5 * 60 + 5; i++) AK.ads.update();
ok(g5.wins[1] === 1, '复活后对手胜点回退 1', String(g5.wins[1]));
ok(g5.scene === 'battle' && g5.reviveUsed, '复活后回到对战且已标记使用');

const g6 = new AK.Game({ platform: 'web' });
g6.view = { scale: 1, ox: 0, oy: 0 };
g6.matchResult = { win: true, coins: 50, doubled: false, score: '2 - 0' };
g6.setScene('result');
g6.render(ctx);
const coinsBefore = g6.save.coins;
g6.onUiClick('doubleReward');
for (let i = 0; i < 5 * 60 + 5; i++) AK.ads.update();
ok(g6.matchResult.doubled === true, '看广告后奖励翻倍标记生效');
ok(g6.save.coins === coinsBefore + 50 * (AK.ADS.policy.rewardMultiplier - 1), '翻倍金币正确入账',
  g6.save.coins + ' vs ' + (coinsBefore + 100));

/* ================= 10. 存档持久化 ================= */
section('[10] 存档');
const g7 = new AK.Game({ platform: 'web' });
g7.addCoins(123);
g7.persist();
const g8 = new AK.Game({ platform: 'web' });
ok(g8.save.coins === g7.save.coins, '金币跨实例持久化', g8.save.coins);
ok(Array.isArray(g8.save.unlocked) && g8.save.unlocked.length >= 2, '解锁列表持久化');

/* ================= 11. 输入映射 ================= */
section('[11] 输入映射');
const g9 = new AK.Game({ platform: 'web' });
g9.view = { scale: 1, ox: 0, oy: 0 };
g9.startMatch('ryan', 'normal');
g9.onPointerDown(AK.PAD[0].x + 5, AK.PAD[0].y + 5, 't1');
ok(g9.held.left === true, '触摸左键生效');
g9.onPointerUp(0, 0, 't1');
ok(!g9.held.left, '触摸抬起释放按键');
g9.onKey('KeyJ', true);
ok(g9.press.a === true, '键盘 J 映射为轻拳');
g9.onKey('KeyJ', false);
ok(!g9.press.a, '键盘抬起清除攻击输入');

/* ================= 汇总 ================= */
console.log('\n' + '='.repeat(46));
console.log(`通过 ${pass} / ${pass + fail}   失败 ${fail}`);
if (fail) {
  console.log('失败项：\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('全部通过 ✅');
