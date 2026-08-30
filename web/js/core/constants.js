/**
 * 本文件由 scripts/sync.js 从 core/ 自动生成，请勿手改。
 * 修改请编辑仓库根目录 core/ 下的同名文件后重新执行：node scripts/sync.js
 */
/*!
 * 拳魂 ARCADE FIST — 全局常量与角色数据
 * 平台无关，通过 globalThis.AK 暴露，Web / 微信小程序通用。
 * 全部角色与招式均为原创，不使用任何第三方版权素材。
 */
(function (root) {
  'use strict';
  var AK = (root.AK = root.AK || {});

  /* ---------------- 逻辑画布 ---------------- */
  AK.VIEW = { W: 480, H: 270 };
  AK.GROUND_Y = 232;          // 地面线（角色脚底）
  AK.STAGE_MIN_X = 26;
  AK.STAGE_MAX_X = 454;

  /* ---------------- 对战规则 ---------------- */
  AK.RULES = {
    roundTime: 60,            // 每回合秒数
    roundsToWin: 2,           // BO3，先拿 2 分
    maxHp: 120,
    maxPower: 100,
    chipDamageOnBlock: 0.25,  // 防御时的削减伤害比例
    pushBack: 2.2,
    comboDecay: [1, 0.85, 0.7, 0.6, 0.5, 0.4] // 连段伤害递减
  };

  /* ---------------- 广告配置（调试模式） ----------------
   * debug=true 时不请求任何真实广告 SDK，改用内建模拟广告面板：
   *   - 模拟 5s 倒计时、可跳过、按真实广告回调语义触发 onClose(isEnded)
   * 上线前把 debug 改为 false 并填入微信广告位 ID / Web 广告代码即可。
   */
  AK.ADS = {
    debug: true,
    // 微信小程序广告位 ID（上线后在 mp 后台 → 流量主 获取）
    wx: {
      bannerId: '',            // 例：'adunit-xxxxxxxxxxxxxxxx'
      rewardedId: '',          // 激励视频
      interstitialId: ''       // 插屏
    },
    // Web / H5 广告位（可填联盟 JS 代码或自定义回调）
    web: {
      bannerSlot: '',
      rewardedHook: null,
      interstitialHook: null
    },
    // 广告触发策略
    policy: {
      interstitialEveryRounds: 3,  // 每 N 个回合结束弹一次插屏
      rewardMultiplier: 3          // 看激励视频的金币倍率
    }
  };

  /* ---------------- 经济系统（金币） ---------------- */
  AK.ECON = {
    winReward: 50,
    loseReward: 15,
    perfectBonus: 30,     // 完美胜利
    characterPrice: 300,  // 解锁角色需金币
    startCoins: 0
  };

  /* ---------------- 角色调色板 ----------------
   * 每个颜色 key 对应身体部件：
   *   skin 皮肤 / hair 头发 / top 上衣 / bottom 下装 / belt 腰带
   *   shoe 鞋 / glove 手套 / accent 主题色（特效与描边）
   */
  /* ============ 角色阵容（原创 · 拳皇风致敬 · 两套战队 · 3v3 淘汰赛） ============
   * 全为原创角色/招式/美术，不使用任何第三方版权素材。
   * 字段说明见 docs/CHARACTER_SCHEMA.md。换角色 / 换皮 = 只改这里，不动引擎。
   * 必杀 type 枚举：projectile 飞行弹 / rush 突进连击 / shock 震地 /
   *                 dash 突进斩 / uppercut 升龙(对空) / beam 能量波(牵制)。
   * 角色可带可选 `moves` 字段覆盖全局 AK.MOVES，实现差异化手感。
   */
  AK.CHARACTERS = [
    /* ---- 烈炎队 team-blaze ---- */
    {
      id: 'ryan',
      name: '烈焰 · 莱恩',
      style: '炎拳流',
      archetype: '均衡',
      team: 'team-blaze',
      desc: '攻守均衡的队长，一发「烈焰波动拳」能远程压制。',
      locked: false,
      build: 'normal',
      stats: { hp: 1.0, atk: 1.0, spd: 1.0, reach: 1.0 },
      special: {
        name: '烈焰波动拳',
        type: 'projectile',
        cost: 100,
        damage: 18,
        speed: 4.2
      },
      palette: {
        skin: '#f2b48c', hair: '#8c2f16', top: '#e0402c', bottom: '#2a2f3a',
        belt: '#f6c945', shoe: '#f4f1e6', glove: '#f6c945', accent: '#ff7a2f',
        trail: 'rgba(255,140,40,0.75)'
      }
    },
    {
      id: 'vela',
      name: '雷光 · 薇拉',
      style: '雷影流',
      archetype: '速度',
      team: 'team-blaze',
      desc: '电系速度型，瞬步三连踢，专打贴身连段。',
      locked: false,
      build: 'slim',
      stats: { hp: 0.88, atk: 0.9, spd: 1.25, reach: 0.95 },
      special: {
        name: '雷霆三连踢',
        type: 'rush',
        cost: 100,
        damage: 9,
        hits: 3
      },
      palette: {
        skin: '#f6c9a8', hair: '#dfe8f2', top: '#2f6fd0', bottom: '#1b2a44',
        belt: '#9fe0ff', shoe: '#e8eef6', glove: '#9fe0ff', accent: '#6fd7ff',
        trail: 'rgba(120,220,255,0.7)'
      }
    },
    {
      id: 'goro',
      name: '岩豪 · 戈罗',
      style: '崩岩流',
      archetype: '重装',
      team: 'team-blaze',
      desc: '血厚力大的摔跤手，近身压制极强，出手偏慢。',
      locked: true,
      build: 'heavy',
      stats: { hp: 1.25, atk: 1.28, spd: 0.82, reach: 1.05 },
      // 自定义招式表（套壳示范）：重装角色出手慢但每下更疼
      moves: {
        heavyPunch: { key: 'B', name: '岩拳', startup: 11, active: 5, recovery: 18, dmg: 14, hitstun: 24, blockstun: 14, push: 4.0, reach: 36, hi: true },
        heavyKick:  { key: 'D', name: '巨踢', startup: 13, active: 6, recovery: 22, dmg: 16, hitstun: 28, blockstun: 16, push: 5.0, reach: 46, hi: false }
      },
      special: {
        name: '崩岩震地击',
        type: 'shock',
        cost: 100,
        damage: 24
      },
      palette: {
        skin: '#d99a6c', hair: '#3a2a1c', top: '#7a6a4a', bottom: '#33452f',
        belt: '#c8a24a', shoe: '#4a3a26', glove: '#c8a24a', accent: '#e8b84a',
        trail: 'rgba(230,180,70,0.7)'
      }
    },
    /* ---- 疾影队 team-shadow ---- */
    {
      id: 'kuro',
      name: '暗影 · 库洛',
      style: '暗杀流',
      archetype: '突进',
      team: 'team-shadow',
      desc: '疾影队领袖，向前瞬斩抓破绽，高手向角色。',
      locked: true,
      build: 'slim',
      stats: { hp: 0.95, atk: 1.05, spd: 1.12, reach: 1.1 },
      special: {
        name: '暗影十字斩',
        type: 'dash',
        cost: 100,
        damage: 20
      },
      palette: {
        skin: '#e8bfa0', hair: '#1b1b25', top: '#3b2b52', bottom: '#1f1f2b',
        belt: '#b45cff', shoe: '#26262f', glove: '#7a4fd0', accent: '#a95cff',
        trail: 'rgba(170,90,255,0.7)'
      }
    },
    {
      id: 'shira',
      name: '疾风 · 希拉',
      style: '风影流',
      archetype: '速度',
      team: 'team-shadow',
      desc: '风一般灵敏的游斗者，位移灵活，专属升龙「风影升龙」专治跳入。',
      locked: false,
      build: 'slim',
      stats: { hp: 0.88, atk: 0.9, spd: 1.25, reach: 0.95 },
      // 自定义招式表（套壳示范）：出手比全局更快，凸显速度型手感
      moves: {
        lightPunch: { key: 'A', name: '迅拳', startup: 3, active: 3, recovery: 6, dmg: 5, hitstun: 12, blockstun: 8, push: 2.0, reach: 30, hi: true },
        lightKick:  { key: 'C', name: '疾脚', startup: 4, active: 3, recovery: 8, dmg: 6, hitstun: 13, blockstun: 8, push: 2.4, reach: 36, hi: false }
      },
      special: {
        name: '风影升龙',
        type: 'uppercut',
        cost: 100,
        damage: 16
      },
      palette: {
        skin: '#f6c9a8', hair: '#dfe8f2', top: '#f4f6fa', bottom: '#2f5fa8',
        belt: '#7fd1f5', shoe: '#e8eef6', glove: '#9fe0ff', accent: '#6fd7ff',
        trail: 'rgba(120,220,255,0.7)'
      }
    },
    {
      id: 'xue',
      name: '冰华 · 雪',
      style: '冰华流',
      archetype: '控场',
      team: 'team-shadow',
      desc: '冷静的控场者，冰华弹幕封锁走位逼对手进节奏。',
      locked: true,
      build: 'normal',
      stats: { hp: 0.96, atk: 0.98, spd: 1.0, reach: 1.12 },
      special: {
        name: '冰华真空波',
        type: 'beam',
        cost: 100,
        damage: 13
      },
      palette: {
        skin: '#eef0f6', hair: '#6fc6e8', top: '#bfe6f2', bottom: '#2f6f8a',
        belt: '#e8fbff', shoe: '#dff4fb', glove: '#e8fbff', accent: '#5fd0f0',
        trail: 'rgba(150,220,255,0.7)'
      }
    }
  ];

  /* ============ 战队（3v3 组队淘汰赛） ============ */
  AK.TEAMS = [
    { id: 'team-blaze', name: '烈炎队', members: ['ryan', 'vela', 'goro'] },
    { id: 'team-shadow', name: '疾影队', members: ['kuro', 'shira', 'xue'] }
  ];

  /* ---------------- 招式帧数据 ----------------
   * startup 起手 / active 判定 / recovery 收招（单位：帧，按 60fps）
   * dmg 基础伤害 / hitstun 硬直 / blockstun 防御硬直 / push 击退
   * reach 攻击判定距离（相对角色前沿）
   */
  AK.MOVES = {
    lightPunch: { key: 'A', name: '轻拳', startup: 4, active: 3, recovery: 7, dmg: 5,  hitstun: 12, blockstun: 8,  push: 2.0, reach: 30, hi: true },
    heavyPunch: { key: 'B', name: '重拳', startup: 8, active: 4, recovery: 15, dmg: 10, hitstun: 20, blockstun: 12, push: 3.6, reach: 34, hi: true },
    lightKick:  { key: 'C', name: '轻脚', startup: 5, active: 3, recovery: 9,  dmg: 6,  hitstun: 13, blockstun: 8,  push: 2.4, reach: 36, hi: false },
    heavyKick:  { key: 'D', name: '重脚', startup: 10, active: 5, recovery: 18, dmg: 12, hitstun: 24, blockstun: 14, push: 4.4, reach: 42, hi: false },
    crouchPunch:{ key: 'A↓', name: '蹲拳', startup: 4, active: 3, recovery: 8,  dmg: 4,  hitstun: 11, blockstun: 7,  push: 1.6, reach: 26, hi: false, low: true },
    crouchKick: { key: 'C↓', name: '扫堂腿', startup: 7, active: 4, recovery: 14, dmg: 8, hitstun: 26, blockstun: 11, push: 2.8, reach: 44, hi: false, low: true, sweep: true },
    jumpPunch:  { key: 'A↑', name: '跳跃拳', startup: 4, active: 6, recovery: 6, dmg: 7,  hitstun: 15, blockstun: 9,  push: 2.0, reach: 28, hi: true, air: true }
  };

  /* ---------------- AI 难度 ---------------- */
  AK.DIFFICULTY = [
    { id: 'easy',   name: '新手', react: 26, aggression: 0.30, blockRate: 0.20, combo: 0.10, specialRate: 0.25 },
    { id: 'normal', name: '普通', react: 16, aggression: 0.50, blockRate: 0.42, combo: 0.35, specialRate: 0.50 },
    { id: 'hard',   name: '困难', react: 10, aggression: 0.68, blockRate: 0.62, combo: 0.60, specialRate: 0.72 },
    { id: 'hell',   name: '地狱', react: 6,  aggression: 0.85, blockRate: 0.80, combo: 0.85, specialRate: 0.92 }
  ];

  /* ---------------- 场景背景 ---------------- */
  AK.STAGES = [
    { id: 'dojo',  name: '深夜道场', sky: ['#1b1030', '#3d1f4a'], floor: '#2a1c2e', accent: '#7a4fd0' },
    { id: 'dock',  name: '黄昏码头', sky: ['#2a1a3a', '#c05a2a'], floor: '#33241e', accent: '#ff8a3d' },
    { id: 'roof',  name: '霓虹天台', sky: ['#0e1d3a', '#2a4a8a'], floor: '#1a2438', accent: '#48d0ff' },
    { id: 'arena', name: '斗魂竞技场', sky: ['#2b0f14', '#8a2020'], floor: '#3a1c1c', accent: '#ff5a4a' }
  ];

  AK.colors = {
    hpFill: '#ffd447',
    hpBack: '#5a1216',
    powerFill: '#4ad7ff',
    powerBack: '#123244',
    white: '#f5f3ea',
    shadow: 'rgba(0,0,0,0.35)'
  };

  AK.characterById = function (id) {
    for (var i = 0; i < AK.CHARACTERS.length; i++) {
      if (AK.CHARACTERS[i].id === id) return AK.CHARACTERS[i];
    }
    return AK.CHARACTERS[0];
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
