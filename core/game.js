/*!
 * 拳魂 ARCADE FIST — 游戏主逻辑
 * 场景机 + 对战流程 + 渲染 + 广告接入 + 虚拟按键
 * 坐标系固定为 480x270 逻辑分辨率，由平台层做缩放适配。
 */
(function (root) {
  'use strict';
  var AK = (root.AK = root.AK || {});
  var S = AK.sprites;
  var W = AK.VIEW.W, H = AK.VIEW.H;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  /* ================= 虚拟按键布局 ================= */
  var PAD = [
    { id: 'left',    x: 14,  y: 186, w: 30, h: 30, label: '◀', type: 'dir' },
    { id: 'right',   x: 78,  y: 186, w: 30, h: 30, label: '▶', type: 'dir' },
    { id: 'up',      x: 46,  y: 158, w: 30, h: 26, label: '▲', type: 'dir' },
    { id: 'down',    x: 46,  y: 216, w: 30, h: 26, label: '▼', type: 'dir' },
    { id: 'block',   x: 118, y: 186, w: 34, h: 30, label: '防', type: 'act' },
    { id: 'special', x: 342, y: 152, w: 56, h: 26, label: '必杀', type: 'act', accent: true },
    { id: 'a',       x: 406, y: 186, w: 26, h: 26, label: 'A', type: 'act' },
    { id: 'b',       x: 436, y: 186, w: 26, h: 26, label: 'B', type: 'act' },
    { id: 'c',       x: 406, y: 216, w: 26, h: 26, label: 'C', type: 'act' },
    { id: 'd',       x: 436, y: 216, w: 26, h: 26, label: 'D', type: 'act' }
  ];

  /* ================= 构造函数 ================= */
  function Game(opts) {
    opts = opts || {};
    this.platform = opts.platform || 'web';
    this.view = { scale: 1, ox: 0, oy: 0 };
    this.acc = 0;
    this.frame = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.hotspots = [];
    this.touchMap = {};

    this.held = {};
    this.press = {};

    this.particles = [];
    this.effects = [];
    this.projectiles = [];

    this.scene = 'title';
    this.roundCount = 0;
    this.reviveUsed = false;

    this.sel = {
      team: ['ryan', 'vela', 'shira'], // 玩家组建的战队（3 人）
      difficulty: 1,
      stage: 0,
      lockTarget: -1             // 选人页选中但未解锁的角色下标
    };

    this.teamMode = true;
    this.p1Team = [];
    this.p2Team = [];
    this.teamPos = [0, 0];
    this.koFlags = [[false, false, false], [false, false, false]];
    this.matchDiff = 'normal';

    this.save = AK.storage.getJSON('ak_save', null) || {
      coins: AK.ECON.startCoins,
      unlocked: ['ryan', 'vela', 'shira'],
      wins: 0,
      losses: 0,
      streak: 0,
      bestStreak: 0,
      muted: false
    };
    if (!this.save.unlocked) this.save.unlocked = ['ryan', 'vela', 'shira'];

    this.toast = null;
    this.pendingAd = null;

    AK.ads.init(this.platform, { onLog: opts.onLog || function () {} });
    AK.audio.init({ isWx: this.platform === 'wx' });
    AK.audio.setMuted(!!this.save.muted);

    this.stage = AK.STAGES[0];
    this.bgSeed = 1;
  }

  /* ================= 存档 ================= */
  Game.prototype.persist = function () {
    AK.storage.setJSON('ak_save', this.save);
  };

  Game.prototype.showToast = function (text, frames) {
    this.toast = { text: text, t: frames || 110 };
  };

  Game.prototype.addCoins = function (n) {
    this.save.coins = Math.max(0, (this.save.coins | 0) + n);
    this.persist();
    if (n > 0) AK.audio.play('coin');
  };

  Game.prototype.isUnlocked = function (id) {
    return this.save.unlocked.indexOf(id) >= 0;
  };

  /* ================= 场景切换 ================= */
  Game.prototype.setScene = function (s) {
    this.scene = s;
    this.sceneT = 0;
    AK.audio.play('ui');
  };

  /* ================= 对局流程（3v3 组队淘汰赛） ================= */
  Game.prototype.randomTeam = function () {
    var t = AK.TEAMS[Math.floor(Math.random() * AK.TEAMS.length)];
    return t.members.slice();
  };

  Game.prototype.randomOthers = function (id, n) {
    var pool = AK.CHARACTERS.filter(function (c) { return c.id !== id; });
    var out = [];
    while (n-- > 0 && pool.length) {
      out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    }
    return out;
  };

  /**
   * 开始一场 3v3。
   * @param p1 玩家战队：角色 id 数组，或单个 id（自动补 2 人凑成 3v3）
   * @param diffId 难度
   * @param p2 电脑战队：角色 id 数组（默认随机一队）
   */
  Game.prototype.startMatch = function (p1, diffId, p2) {
    var p1Team = Array.isArray(p1) ? p1.slice(0, 3) : [p1].concat(this.randomOthers(p1, 2));
    while (p1Team.length < 3) p1Team.push(this.randomOthers(p1Team[p1Team.length - 1] || 'ryan', 1)[0]);
    var p2Team = p2 ? (Array.isArray(p2) ? p2.slice(0, 3) : [p2].concat(this.randomOthers(p2, 2)))
                    : this.randomTeam();

    this.p1Team = p1Team;
    this.p2Team = p2Team;
    this.teamPos = [0, 0];
    this.koFlags = [p1Team.map(function () { return false; }), p2Team.map(function () { return false; })];
    this.matchDiff = diffId || 'normal';
    this.ai = new AK.AI(this.matchDiff);
    this.f1 = new AK.Fighter(AK.characterById(p1Team[0]), 150, 1, false);
    this.f2 = new AK.Fighter(AK.characterById(p2Team[0]), 330, -1, true);
    this.wins = [0, 0];
    this.reviveUsed = false;
    this.matchOver = false;
    this.roundNo = 0;
    this.perfect = [true, true];
    this.beginRound(true);
    this.setScene('battle');
  };

  /** 开打前生成某侧的当前队员 */
  Game.prototype.spawnMember = function (side) {
    var team = side === 0 ? this.p1Team : this.p2Team;
    var id = team[this.teamPos[side]];
    var ch = AK.characterById(id);
    var f = new AK.Fighter(ch, side === 0 ? 150 : 330, side === 0 ? 1 : -1, side === 0 ? false : true);
    return f;
  };

  /**
   * 开始一场对决（1v1）。
   * @param first true=整场比赛第一场（双方满血满气）；false=换人后续场（胜者保留残血，败者新满血）
   */
  Game.prototype.beginRound = function (first) {
    this.roundNo++;
    this.roundCount++;
    AK.__roundCount = this.roundCount;
    if (first) {
      this.f1.hp = this.f1.maxHp;
      this.f2.hp = this.f2.maxHp;
      this.f1.power = 0;
      this.f2.power = 0;
    }
    this.f1.x = 150; this.f1.y = AK.GROUND_Y; this.f1.vx = 0; this.f1.vy = 0;
    this.f2.x = 330; this.f2.y = AK.GROUND_Y; this.f2.vx = 0; this.f2.vy = 0;
    this.f1.facing = 1; this.f2.facing = -1;
    this.f1.setState('idle'); this.f2.setState('idle');
    this.f1.combo = 0; this.f2.combo = 0;
    this.ai.reset();
    this.projectiles.length = 0;
    this.effects.length = 0;
    this.particles.length = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.timer = AK.RULES.roundTime * 60;
    this.roundOver = false;
    this.roundWinner = -1;
    this.koT = 0;
    this.stage = AK.STAGES[(this.roundNo - 1) % AK.STAGES.length];
    this.bgSeed = Math.random();
    this.held = {};
    this.press = {};
  };

  Game.prototype.endRound = function (winner) {
    if (this.roundOver) return;
    this.roundOver = true;
    this.roundWinner = winner;
    this.phase = 'ko';
    this.koT = 0;
    this.wins[winner]++;
    var loser = winner === 0 ? 1 : 0;
    this.koFlags[loser][this.teamPos[loser]] = true; // 当前败方队员阵亡
    if (winner === 0 ? this.f2.hp > 0 : this.f1.hp > 0) {
      // 时间到判胜，非 KO
      AK.audio.play('bell');
    } else {
      AK.audio.play('ko');
      this.shake = 14;
    }
    if (this.f1.hp < this.f1.maxHp - 0.5 || this.f2.hp < this.f2.maxHp - 0.5) this.perfect[winner] = false;
    var wnr = winner === 0 ? this.f1 : this.f2;
    wnr.setState('victory');
    wnr.victoryT = 0;
  };

  Game.prototype.endMatch = function () {
    this.matchOver = true;
    var win = this.wins[0] >= this.p2Team.length;
    var coins = win ? AK.ECON.winReward : AK.ECON.loseReward;
    if (win && this.perfect[0] && this.wins[1] === 0) coins += AK.ECON.perfectBonus;
    this.matchResult = {
      win: win,
      coins: coins,
      doubled: false,
      score: this.wins[0] + ' - ' + this.wins[1]
    };
    this.save.coins += coins;
    if (win) {
      this.save.wins++;
      this.save.streak++;
      if (this.save.streak > this.save.bestStreak) this.save.bestStreak = this.save.streak;
    } else {
      this.save.losses++;
      this.save.streak = 0;
    }
    this.persist();
    AK.audio.play(win ? 'win' : 'lose');
    this.setScene('result');
  };

  /* ================= 主更新 ================= */
  Game.prototype.update = function (dt) {
    AK.ads.update();
    if (AK.ads.isMockShowing()) return; // 广告播放中冻结游戏

    this.acc += dt;
    var step = 1000 / 60;
    var guard = 0;
    while (this.acc >= step && guard < 5) {
      this.acc -= step;
      this.step();
      guard++;
    }
    if (this.toast) { this.toast.t--; if (this.toast.t <= 0) this.toast = null; }
    if (this.shake > 0) this.shake *= 0.86;
  };

  Game.prototype.step = function () {
    this.frame++;
    this.sceneT++;
    if (this.shake < 0.4) this.shake = 0;

    if (this.scene === 'battle') this.stepBattle();
    this.stepParticles();
  };

  Game.prototype.stepBattle = function () {
    var f1 = this.f1, f2 = this.f2;

    /* --- 阶段机 --- */
    if (this.phase === 'intro') {
      this.phaseT++;
      if (this.phaseT === 1) AK.audio.play('bell');
      if (this.phaseT > 90) { this.phase = 'fight'; this.phaseT = 0; AK.audio.play('bell'); }
      this.stepParticles();
      return;
    }
    if (this.phase === 'ko') {
      this.phaseT++;
      this.koT++;
      // 双方继续物理更新（倒地动画）
      f1.update(this, this.emptyInput(), f2);
      f2.update(this, this.emptyInput(), f1);
      this.stepEffects();
      if (this.koT > 130) {
        var loser = this.roundWinner === 0 ? 1 : 0;
        var allKo = true;
        for (var li = 0; li < this.koFlags[loser].length; li++) { if (!this.koFlags[loser][li]) { allKo = false; break; } }
        if (allKo) {
          this.endMatch();
        } else {
          this.teamPos[loser]++;
          this[loser === 0 ? 'f1' : 'f2'] = this.spawnMember(loser);
          this.beginRound(false);
        }
      }
      return;
    }

    /* --- 对战中 --- */
    if (!this.roundOver) {
      this.timer--;
      if (this.timer <= 0) {
        this.timer = 0;
        var w = f1.hp / f1.maxHp >= f2.hp / f2.maxHp ? 0 : 1;
        if (f1.hp / f1.maxHp === f2.hp / f2.maxHp) w = -1;
        if (w === -1) { this.wins[0]++; this.wins[1]++; this.endRound(0); this.wins[0]--; }
        else this.endRound(w);
        return;
      }
    }

    if (this.hitstop > 0) { this.hitstop--; this.stepParticles(); return; }

    /* --- 输入 --- */
    var i1 = {
      left: !!this.held.left, right: !!this.held.right, up: !!this.held.up,
      down: !!this.held.down, block: !!this.held.block,
      a: !!this.press.a, b: !!this.press.b, c: !!this.press.c, d: !!this.press.d,
      special: !!this.press.special
    };
    var i2 = this.ai.think(f2, f1, this);
    if (this.phase !== 'fight') { i1 = this.emptyInput(); i2 = this.emptyInput(); }

    f1.update(this, i1, f2);
    f2.update(this, i2, f1);
    this.press = {};

    /* --- 分离与推进 --- */
    this.separate(f1, f2);

    /* --- 命中判定 --- */
    this.detectHit(f1, f2);
    this.detectHit(f2, f1);

    /* --- 特效 --- */
    this.stepEffects();

    /* --- 死亡判定 --- */
    if (f1.hp <= 0 && !this.roundOver) this.endRound(1);
    else if (f2.hp <= 0 && !this.roundOver) this.endRound(0);
  };

  Game.prototype.emptyInput = function () {
    return { left: false, right: false, up: false, down: false, block: false, a: false, b: false, c: false, d: false, special: false };
  };

  Game.prototype.separate = function (a, b) {
    var d = b.x - a.x;
    var ad = Math.abs(d);
    var min = 30;
    if (ad < min) {
      var push = (min - ad) / 2;
      var s = d >= 0 ? 1 : -1;
      a.x -= push * s;
      b.x += push * s;
      a.x = clamp(a.x, AK.STAGE_MIN_X, AK.STAGE_MAX_X);
      b.x = clamp(b.x, AK.STAGE_MIN_X, AK.STAGE_MAX_X);
    }
  };

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  Game.prototype.detectHit = function (atk, def) {
    if (this.roundOver) return;
    if (def.state === 'ko') return;
    var hb = atk.hitBox();
    if (!hb || atk.moveHit) return;
    var hurt = def.hurtBox();
    if (overlap(hb, hurt)) {
      atk.moveHit = true;
      var res = def.applyHit(this, hb.move, atk);
      this.hitstop = res.blocked ? 3 : (hb.move.dmg >= 10 ? 8 : 5);
      this.shake = res.blocked ? 3 : (hb.move.dmg >= 10 ? 9 : 5);
    }
  };

  /* ================= 回调：命中 / 防御 / 必杀 ================= */
  Game.prototype.onHit = function (victim, attacker, move, dmg) {
    var cx = victim.x - victim.facing * 10;
    var cy = move.low ? victim.y - 22 : victim.y - 62;
    this.burst(cx, cy, move.sweep ? 10 : 16, move.dmg >= 10 ? '#ffd447' : '#ffffff', move.dmg >= 10 ? 1.5 : 1);
    AK.audio.play(move.dmg >= 10 ? 'heavy' : 'hit');
    if (attacker.combo >= 2) {
      this.popText(cx, cy - 22, attacker.combo + ' HIT!', '#ffd447');
    }
    this.dmgPop = { x: cx, y: cy - 10, v: '-' + dmg, t: 30 };
  };

  Game.prototype.onBlocked = function (victim, attacker, move, chip) {
    var cx = victim.x - victim.facing * 14;
    var cy = move.low ? victim.y - 22 : victim.y - 62;
    this.burst(cx, cy, 8, '#9fe0ff', 0.9);
    AK.audio.play('block');
  };

  Game.prototype.onSpecialStart = function (fighter) {
    AK.audio.play('special');
    this.shake = 6;
    this.popText(fighter.x, fighter.y - 108, fighter.ch.special.name, fighter.ch.palette.accent);
    this.flashScreen = 10;
  };

  /** 必杀释放：按角色类型生成不同效果 */
  Game.prototype.fireSpecial = function (fighter, opp) {
    var sp = fighter.ch.special;
    AK.audio.play('fire');
    this.shake = 10;
    var dmg = sp.damage * fighter.ch.stats.atk;

    if (sp.type === 'projectile') {
      this.projectiles.push({
        x: fighter.x + fighter.facing * 22,
        y: fighter.y - 58,
        vx: fighter.facing * sp.speed,
        dmg: dmg,
        owner: fighter,
        r: 11,
        life: 150,
        type: 'fire',
        color: fighter.ch.palette.accent,
        trail: []
      });
    } else if (sp.type === 'rush') {
      this.effects.push({
        type: 'rush', fighter: fighter, opp: opp, dmg: dmg,
        hitsLeft: sp.hits || 3, t: 0, hit: false
      });
    } else if (sp.type === 'shock') {
      this.effects.push({
        type: 'shock', x: fighter.x, y: AK.GROUND_Y, dir: fighter.facing,
        fighter: fighter, opp: opp, dmg: dmg, t: 0, hit: false, w: 26
      });
      for (var i = 0; i < 18; i++) {
        this.particles.push({
          x: fighter.x + (Math.random() - 0.5) * 40, y: AK.GROUND_Y - 2,
          vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3.4,
          life: 26, color: fighter.ch.palette.accent, size: 2 + Math.random() * 3, g: 0.28
        });
      }
    } else if (sp.type === 'dash') {
      this.effects.push({
        type: 'dash', fighter: fighter, opp: opp, dmg: dmg,
        t: 0, hit: false, startX: fighter.x, targetX: fighter.x + fighter.facing * 96
      });
    } else if (sp.type === 'uppercut') {
      /* 升龙：对空无敌起手，身前升起一道能量柱，多段判定 */
      this.effects.push({
        type: 'uppercut', x: fighter.x + fighter.facing * 16, y: fighter.y - 40,
        dir: fighter.facing, fighter: fighter, opp: opp, dmg: dmg,
        t: 0, hit: false, hitsLeft: 3
      });
      for (var u = 0; u < 14; u++) {
        this.particles.push({
          x: fighter.x + fighter.facing * 12, y: fighter.y - 30 - Math.random() * 40,
          vx: fighter.facing * (1 + Math.random()), vy: -Math.random() * 3,
          life: 24, color: fighter.ch.palette.accent, size: 2 + Math.random() * 2, g: 0.1
        });
      }
    } else if (sp.type === 'beam') {
      /* 能量波：身前喷出真空波，向前扩张、多段判定（牵制型必杀） */
      this.effects.push({
        type: 'beam', x: fighter.x + fighter.facing * 18, y: fighter.y - 56,
        dir: fighter.facing, fighter: fighter, opp: opp, dmg: dmg * 0.6,
        t: 0, hit: false, hitsLeft: 5, reach: 30
      });
    }
  };

  Game.prototype.stepEffects = function () {
    var self = this;
    var i, e, p;

    /* 飞行道具 */
    for (i = this.projectiles.length - 1; i >= 0; i--) {
      p = this.projectiles[i];
      p.x += p.vx;
      p.life--;
      p.trail.push({ x: p.x, y: p.y, a: 1 });
      if (p.trail.length > 6) p.trail.shift();
      for (var t = 0; t < p.trail.length; t++) p.trail[t].a *= 0.86;

      var target = p.owner === this.f1 ? this.f2 : this.f1;
      if (target && target.state !== 'ko' && !this.roundOver) {
        var box = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
        if (overlap(box, target.hurtBox())) {
          var fakeMove = { dmg: p.dmg, hitstun: 30, blockstun: 14, push: 4.5, name: '必杀', low: false, startup: 0, active: 1, reach: 0 };
          var res = target.applyHit(this, fakeMove, p.owner);
          if (res.blocked) target.power = Math.min(target.maxPower, target.power + p.dmg * 0.4);
          p.owner.combo++;
          p.owner.comboTimer = 60;
          this.hitstop = 8;
          this.shake = 12;
          this.burst(p.x, p.y, 22, p.color, 1.6);
          this.projectiles.splice(i, 1);
          continue;
        }
      }
      if (p.life <= 0 || p.x < -30 || p.x > W + 30) this.projectiles.splice(i, 1);
    }

    /* 特殊效果 */
    for (i = this.effects.length - 1; i >= 0; i--) {
      e = this.effects[i];
      e.t++;

      if (e.type === 'rush') {
        // 三连突进：每 7 帧一次判定，位置向对手逼近
        if (e.t % 7 === 1 && e.hitsLeft > 0) {
          var d = e.opp.x - e.fighter.x;
          e.fighter.x += Math.sign(d) * Math.min(Math.abs(d) - 26, 34);
          e.fighter.x = clamp(e.fighter.x, AK.STAGE_MIN_X, AK.STAGE_MAX_X);
          var box2 = { x: e.fighter.facing > 0 ? e.fighter.x : e.fighter.x - 44, y: e.fighter.y - 74, w: 44, h: 40 };
          if (e.opp.state !== 'ko' && overlap(box2, e.opp.hurtBox())) {
            var fm = { dmg: e.dmg, hitstun: 22, blockstun: 12, push: 2.6, name: '连踢', low: false, startup: 0, active: 1, reach: 0 };
            e.opp.applyHit(this, fm, e.fighter);
            e.hitsLeft--;
            this.hitstop = 6;
            this.shake = 7;
            this.burst(e.opp.x, e.opp.y - 56, 12, e.fighter.ch.palette.accent, 1.2);
          }
          this.particles.push({
            x: e.fighter.x, y: e.fighter.y - 50, vx: -e.fighter.facing * 1.2, vy: 0,
            life: 14, color: e.fighter.ch.palette.trail, size: 10, g: 0, ghost: true
          });
        }
        if (e.t > 26 || e.hitsLeft <= 0) this.effects.splice(i, 1);

      } else if (e.type === 'shock') {
        e.x += e.dir * 4.2;
        e.w += 1.4;
        if (!e.hit && e.opp.state !== 'ko') {
          var sb = { x: Math.min(e.x, e.x + e.dir * e.w), y: AK.GROUND_Y - 44, w: e.w, h: 44 };
          if (overlap(sb, e.opp.hurtBox())) {
            var fm2 = { dmg: e.dmg, hitstun: 40, blockstun: 18, push: 6, name: '震地', low: false, startup: 0, active: 1, reach: 0, sweep: true };
            e.opp.applyHit(this, fm2, e.fighter);
            e.hit = true;
            this.hitstop = 10;
            this.shake = 18;
            this.burst(e.opp.x, AK.GROUND_Y - 10, 26, e.fighter.ch.palette.accent, 1.8);
          }
        }
        for (var k = 0; k < 3; k++) {
          this.particles.push({
            x: e.x + (Math.random() - 0.5) * 20, y: AK.GROUND_Y - Math.random() * 12,
            vx: (Math.random() - 0.5) * 2.4, vy: -Math.random() * 2.4,
            life: 22, color: e.fighter.ch.palette.accent, size: 2 + Math.random() * 3, g: 0.3
          });
        }
        if (e.t > 42) this.effects.splice(i, 1);

      } else if (e.type === 'dash') {
        var stepX = (e.targetX - e.startX) / 6;
        if (e.t <= 6) {
          e.fighter.x = e.startX + stepX * e.t;
          e.fighter.x = clamp(e.fighter.x, AK.STAGE_MIN_X, AK.STAGE_MAX_X);
          this.particles.push({
            x: e.fighter.x, y: e.fighter.y - 50, vx: 0, vy: 0,
            life: 12, color: e.fighter.ch.palette.trail, size: 12, g: 0, ghost: true
          });
        }
        if (!e.hit && e.opp.state !== 'ko') {
          var db = { x: e.fighter.facing > 0 ? e.fighter.x : e.fighter.x - 52, y: e.fighter.y - 82, w: 52, h: 62 };
          if (overlap(db, e.opp.hurtBox())) {
            var fm3 = { dmg: e.dmg, hitstun: 34, blockstun: 16, push: 5, name: '十字斩', low: false, startup: 0, active: 1, reach: 0 };
            e.opp.applyHit(this, fm3, e.fighter);
            e.hit = true;
            this.hitstop = 10;
            this.shake = 14;
            this.burst(e.opp.x, e.opp.y - 56, 20, e.fighter.ch.palette.accent, 1.6);
          }
        }
        if (e.t > 16) this.effects.splice(i, 1);
      }

      else if (e.type === 'uppercut') {
        e.t++;
        e.y -= 3.0; // 能量柱上升
        if (e.t % 6 === 1 && e.hitsLeft > 0 && e.opp.state !== 'ko' && !this.roundOver) {
          var ub = { x: e.x - 15, y: e.y - 64, w: 30, h: 70 };
          if (overlap(ub, e.opp.hurtBox())) {
            var fmu = { dmg: e.dmg, hitstun: 26, blockstun: 14, push: 3, name: '昇龙', low: false, startup: 0, active: 1, reach: 0 };
            e.opp.applyHit(this, fmu, e.fighter);
            e.hitsLeft--;
            e.hit = true;
            this.hitstop = 6;
            this.shake = 10;
            this.burst(e.opp.x, e.opp.y - 58, 12, e.fighter.ch.palette.accent, 1.3);
          }
        }
        if (e.t % 2 === 0) {
          this.particles.push({
            x: e.x + (Math.random() - 0.5) * 12, y: e.y - Math.random() * 56,
            vx: e.dir * 0.6, vy: -1.2, life: 18,
            color: e.fighter.ch.palette.accent, size: 2 + Math.random() * 2, g: 0.05
          });
        }
        if (e.t > 30) this.effects.splice(i, 1);

      } else if (e.type === 'beam') {
        e.t++;
        e.reach += 2.4; // 真空波向前扩张
        if (e.t % 5 === 1 && e.hitsLeft > 0 && e.opp.state !== 'ko' && !this.roundOver) {
          var bb = { x: e.dir > 0 ? e.x : e.x - e.reach, y: e.y - 26, w: e.reach, h: 52 };
          if (overlap(bb, e.opp.hurtBox())) {
            var fmb = { dmg: e.dmg, hitstun: 18, blockstun: 12, push: 2.4, name: '真空波', low: false, startup: 0, active: 1, reach: 0 };
            e.opp.applyHit(this, fmb, e.fighter);
            e.hitsLeft--;
            e.hit = true;
            this.hitstop = 5;
            this.shake = 8;
            this.burst(e.opp.x, e.opp.y - 50, 8, e.fighter.ch.palette.accent, 1.1);
          }
        }
        if (e.t % 3 === 0) {
          this.particles.push({
            x: e.x + e.dir * e.reach * Math.random(), y: e.y - 26 + (Math.random() - 0.5) * 40,
            vx: e.dir * (1 + Math.random()), vy: 0, life: 14,
            color: e.fighter.ch.palette.trail, size: 8, g: 0, ghost: true
          });
        }
        if (e.t > 34 || e.hitsLeft <= 0) this.effects.splice(i, 1);
      }
    }
  };

  Game.prototype.stepParticles = function () {
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.x += p.vx || 0;
      p.y += p.vy || 0;
      if (p.g) p.vy += p.g;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.flashScreen > 0) this.flashScreen--;
    if (this.dmgPop) { this.dmgPop.t--; this.dmgPop.y -= 0.6; if (this.dmgPop.t <= 0) this.dmgPop = null; }
    for (var j = this.popTexts ? this.popTexts.length - 1 : -1; j >= 0; j--) {
      this.popTexts[j].t--;
      if (this.popTexts[j].t <= 0) this.popTexts.splice(j, 1);
    }
  };

  Game.prototype.burst = function (x, y, n, color, scale) {
    scale = scale || 1;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = (1 + Math.random() * 3) * scale;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6,
        life: 12 + Math.random() * 14,
        color: color, size: (1 + Math.random() * 2.4) * scale, g: 0.12
      });
    }
  };

  Game.prototype.popText = function (x, y, text, color) {
    if (!this.popTexts) this.popTexts = [];
    this.popTexts.push({ x: x, y: y, text: text, color: color, t: 60 });
  };

  /* ================= 渲染 ================= */
  Game.prototype.render = function (ctx) {
    var v = this.view;
    ctx.save();
    ctx.setTransform(v.scale, 0, 0, v.scale, v.ox, v.oy);
    if (this.shake > 0.5) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this.hotspots.length = 0;

    if (this.scene === 'title') this.drawTitle(ctx);
    else if (this.scene === 'select') this.drawSelect(ctx);
    else if (this.scene === 'battle') this.drawBattle(ctx);
    else if (this.scene === 'result') this.drawResult(ctx);

    // 顶部常驻信息
    this.drawTopBar(ctx);
    this.drawToast(ctx);

    // 广告层（调试模式模拟广告 / 真实广告由系统绘制）
    AK.ads.render(ctx, W, H);

    ctx.restore();
  };

  /* ---------------- 背景 ---------------- */
  Game.prototype.drawBackground = function (ctx) {
    var st = this.stage;
    var g = ctx.createLinearGradient(0, 0, 0, AK.GROUND_Y);
    g.addColorStop(0, st.sky[0]);
    g.addColorStop(1, st.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, AK.GROUND_Y);

    // 远景剪影
    ctx.fillStyle = S.rgba(st.sky[0], 0.55);
    var seed = this.bgSeed * 100;
    for (var i = 0; i < 14; i++) {
      var bw = 22 + ((i * 37 + seed) | 0) % 34;
      var bh = 40 + ((i * 53 + seed) | 0) % 70;
      var bx = (i * 41 + seed * 3) % (W + 60) - 30;
      ctx.fillRect(Math.round(bx), AK.GROUND_Y - bh, bw, bh);
    }
    // 灯带
    ctx.fillStyle = S.rgba(st.accent, 0.28);
    for (var j = 0; j < 8; j++) {
      ctx.fillRect(10 + j * 60, AK.GROUND_Y - 96, 4, 96);
    }

    // 观众（简单色块 + 呼吸）
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (var k = 0; k < 40; k++) {
      var cx = 6 + k * 12;
      var bob = Math.sin(this.frame * 0.05 + k) * 2;
      ctx.fillRect(cx, AK.GROUND_Y - 30 + bob, 8, 30);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, AK.GROUND_Y - 44, W, 44);

    // 地面
    ctx.fillStyle = st.floor;
    ctx.fillRect(0, AK.GROUND_Y, W, H - AK.GROUND_Y);
    var gf = ctx.createLinearGradient(0, AK.GROUND_Y, 0, H);
    gf.addColorStop(0, 'rgba(255,255,255,0.14)');
    gf.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = gf;
    ctx.fillRect(0, AK.GROUND_Y, W, H - AK.GROUND_Y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, AK.GROUND_Y, W, 2);
  };

  /* ---------------- 对战 ---------------- */
  Game.prototype.drawBattle = function (ctx) {
    this.drawBackground(ctx);

    // 粒子（地面层）
    this.drawParticles(ctx, true);

    this.f1.draw(ctx, this);
    this.f2.draw(ctx, this);

    // 飞行道具
    for (var i = 0; i < this.projectiles.length; i++) {
      var p = this.projectiles[i];
      for (var t = 0; t < p.trail.length; t++) {
        var tr = p.trail[t];
        ctx.globalAlpha = tr.a * 0.5;
        ctx.fillStyle = p.color;
        var trs = p.r * (0.4 + tr.a * 0.6);
        ctx.fillRect(Math.round(tr.x - trs), Math.round(tr.y - trs), trs * 2, trs * 2);
      }
      ctx.globalAlpha = 1;
      var flick = Math.sin(this.frame * 0.6) * 2;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.r), Math.round(p.y - p.r), p.r * 2, p.r * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(Math.round(p.x - p.r * 0.45 + flick * 0.2), Math.round(p.y - p.r * 0.45), Math.round(p.r * 0.9), Math.round(p.r * 0.9));
    }

    // 震地波
    for (var e = 0; e < this.effects.length; e++) {
      if (this.effects[e].type === 'shock') {
        var s = this.effects[e];
        ctx.save();
        ctx.globalAlpha = 0.55 * (1 - s.t / 42);
        ctx.fillStyle = s.fighter.ch.palette.accent;
        var sx = s.dir > 0 ? s.x : s.x - s.w;
        ctx.fillRect(Math.round(sx), AK.GROUND_Y - 46, Math.round(s.w), 46);
        ctx.restore();
      }
    }

    // 粒子（上层）
    this.drawParticles(ctx, false);

    // 伤害数字
    if (this.dmgPop) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.dmgPop.t / 12);
      ctx.fillStyle = '#ff8a6a';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.dmgPop.v, this.dmgPop.x, this.dmgPop.y);
      ctx.restore();
    }
    this.drawPopTexts(ctx);

    // HUD
    this.drawHUD(ctx);

    // 阶段横幅
    if (this.phase === 'intro') {
      var t = this.phaseT;
      var txt = this.roundNo > 1 ? '第 ' + this.roundNo + ' 战' : '第 1 战';
      this.bigText(ctx, txt, 1 - Math.min(1, t / 22));
      if (t > 46) this.bigText(ctx, 'FIGHT!', Math.min(1, (t - 46) / 10));
      // 操作提示（仅第一战）
      if (this.roundNo === 1 && t < 90) {
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#f5f3ea';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('A/B 出拳   C/D 出脚   防 防御   必杀 需满气槽', W / 2, H - 16);
        ctx.restore();
      }
    }
    if (this.phase === 'ko') {
      if (this.koT < 70) {
        this.bigText(ctx, 'K.O.', 1);
      } else {
        var wnr = this.roundWinner === 0 ? this.f1.ch : this.f2.ch;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd447';
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(wnr.name + ' 击败对手', W / 2, 96);
        ctx.restore();
      }
    }

    // 闪屏
    if (this.flashScreen > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashScreen / 22;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    this.drawPad(ctx);
  };

  Game.prototype.drawParticles = function (ctx, groundLayer) {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var isGhost = p.ghost;
      if ((groundLayer && isGhost) || (!groundLayer && !isGhost)) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / 14) * (isGhost ? 0.35 : 1);
      ctx.fillStyle = p.color;
      var s = isGhost ? p.size : Math.max(1, p.size * (p.life / 30));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s), Math.ceil(s));
      ctx.restore();
    }
  };

  Game.prototype.drawPopTexts = function (ctx) {
    if (!this.popTexts) return;
    for (var i = 0; i < this.popTexts.length; i++) {
      var t = this.popTexts[i];
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.t / 20);
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(t.text, t.x, t.y - (60 - t.t) * 0.3);
      ctx.restore();
    }
  };

  Game.prototype.bigText = function (ctx, text, alpha) {
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var sc = 1 + (1 - clamp(alpha, 0, 1)) * 0.5;
    ctx.translate(W / 2, 90);
    ctx.scale(sc, sc);
    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, 2, 3);
    ctx.fillStyle = '#ffd447';
    ctx.fillText(text, 0, 0);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  };

  /* ---------------- HUD ---------------- */
  Game.prototype.drawHUD = function (ctx) {
    var pad = 8, barW = 168, barH = 11;

    // P1 血条
    this.hpBar(ctx, pad, 12, barW, barH, this.f1, false);
    // P2 血条（镜像）
    this.hpBar(ctx, W - pad - barW, 12, barW, barH, this.f2, true);

    // 名字
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f5f3ea';
    ctx.fillText(this.f1.ch.name, pad, 34);
    ctx.textAlign = 'right';
    ctx.fillText(this.f2.ch.name, W - pad, 34);
    ctx.restore();

    // 双方战队 3 人头像（当前 / 待命 / 阵亡）
    this.drawTeamPanel(ctx, 0, pad, 38);
    this.drawTeamPanel(ctx, 1, W - pad - 34, 38);

    // 计时器
    var sec = Math.ceil(this.timer / 60);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(W / 2 - 26, 8, 52, 34);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - 26, 8, 52, 34);
    ctx.fillStyle = sec <= 10 ? '#ff6a4a' : '#ffd447';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(sec < 10 ? '0' + sec : '' + sec, W / 2, 34);
    ctx.restore();
  };

  Game.prototype.hpBar = function (ctx, x, y, w, h, f, mirror) {
    var ratio = clamp(f.hp / f.maxHp, 0, 1);
    ctx.save();
    // 底框
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    // 背景
    ctx.fillStyle = AK.colors.hpBack;
    ctx.fillRect(x, y, w, h);
    // 伤害残影
    if (this.ghostHp == null) this.ghostHp = {};
    var key = mirror ? 'p2' : 'p1';
    if (this.ghostHp[key] == null) this.ghostHp[key] = 1;
    this.ghostHp[key] += (ratio - this.ghostHp[key]) * (ratio > this.ghostHp[key] ? 1 : 0.06);
    var gw = Math.round(w * clamp(this.ghostHp[key], 0, 1));
    ctx.fillStyle = 'rgba(255,120,90,0.55)';
    if (mirror) ctx.fillRect(x + w - gw, y, gw, h);
    else ctx.fillRect(x, y, gw, h);
    // 血量
    var fw = Math.round(w * ratio);
    var grad = ctx.createLinearGradient(0, y, 0, y + h);
    if (ratio > 0.35) { grad.addColorStop(0, '#ffe98a'); grad.addColorStop(1, '#f0a020'); }
    else { grad.addColorStop(0, '#ff8a6a'); grad.addColorStop(1, '#c02a1a'); }
    ctx.fillStyle = grad;
    if (mirror) ctx.fillRect(x + w - fw, y, fw, h);
    else ctx.fillRect(x, y, fw, h);

    // 气槽
    var py = y + h + 5, ph = 5;
    var pr = clamp(f.power / f.maxPower, 0, 1);
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(x - 2, py - 2, w + 4, ph + 4);
    ctx.fillStyle = AK.colors.powerBack;
    ctx.fillRect(x, py, w, ph);
    var pw = Math.round(w * pr);
    ctx.fillStyle = pr >= 1 ? (Math.sin(this.frame * 0.3) > 0 ? '#ffffff' : '#4ad7ff') : AK.colors.powerFill;
    if (mirror) ctx.fillRect(x + w - pw, py, pw, ph);
    else ctx.fillRect(x, py, pw, ph);
    ctx.restore();
  };

  /* ---------------- 战队面板（双方 3 人头像） ---------------- */
  Game.prototype.drawTeamPanel = function (ctx, side, x, y) {
    var team = side === 0 ? this.p1Team : this.p2Team;
    var n = team.length;
    var sz = 22, gap = 4;
    for (var i = 0; i < n; i++) {
      var px = side === 0 ? x + i * (sz + gap) : x - i * (sz + gap);
      var ch = AK.characterById(team[i]);
      var ko = this.koFlags[side][i];
      var active = this.teamPos[side] === i && !ko;
      ctx.save();
      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(px - 1, y - 1, sz + 2, sz + 2);
      ctx.fillStyle = ko ? 'rgba(40,40,50,0.6)' : ch.palette.top;
      ctx.fillRect(px, y, sz, sz);
      ctx.fillStyle = ko ? 'rgba(120,120,130,0.5)' : ch.palette.accent;
      ctx.fillRect(px + sz * 0.32, y + sz * 0.12, sz * 0.36, sz * 0.36); // 头
      ctx.fillRect(px + sz * 0.22, y + sz * 0.5, sz * 0.56, sz * 0.42);  // 身
      if (active) {
        ctx.strokeStyle = '#ffd447';
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 1, y - 1, sz + 2, sz + 2);
      } else if (!ko) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, y, sz, sz);
      }
      if (ko) {
        ctx.strokeStyle = '#ff5a4a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 3, y + 3); ctx.lineTo(px + sz - 3, y + sz - 3);
        ctx.moveTo(px + sz - 3, y + 3); ctx.lineTo(px + 3, y + sz - 3);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  /* ---------------- 虚拟按键 ---------------- */
  Game.prototype.drawPad = function (ctx) {
    if (this.scene !== 'battle') return;
    ctx.save();
    for (var i = 0; i < PAD.length; i++) {
      var b = PAD[i];
      var active = this.held[b.id] || this.press[b.id];
      var ready = b.id !== 'special' || (this.f1 && this.f1.power >= this.f1.maxPower);
      ctx.globalAlpha = active ? 0.92 : (b.id === 'special' && !ready ? 0.22 : 0.5);
      ctx.fillStyle = active ? (b.accent ? '#ffd447' : '#ffffff') : '#161a26';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.globalAlpha = active ? 1 : (b.id === 'special' && !ready ? 0.3 : 0.65);
      ctx.strokeStyle = b.accent ? '#ffd447' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = active ? '#161a26' : '#f5f3ea';
      ctx.font = 'bold ' + (b.label.length > 1 ? 11 : 14) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  };

  /* ---------------- 顶部信息条 ---------------- */
  Game.prototype.drawTopBar = function (ctx) {
    if (this.scene === 'battle') return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, 22);
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd447';
    ctx.fillText('◆ ' + this.save.coins, 8, 15);
    ctx.fillStyle = 'rgba(245,243,234,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('胜 ' + this.save.wins + ' · 负 ' + this.save.losses + ' · 连胜 ' + this.save.streak, W / 2, 15);
    ctx.textAlign = 'right';
    if (AK.ADS.debug) {
      ctx.fillStyle = '#6fd7ff';
      ctx.fillText('AD DEBUG', W - 8, 15);
    } else {
      ctx.fillStyle = 'rgba(245,243,234,0.5)';
      ctx.fillText(AK.ads.summary(), W - 8, 15);
    }
    ctx.restore();
  };

  Game.prototype.drawToast = function (ctx) {
    if (!this.toast) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.toast.t / 20);
    ctx.font = '12px sans-serif';
    var tw = ctx.measureText(this.toast.text).width + 20;
    ctx.fillStyle = 'rgba(8,10,16,0.9)';
    ctx.fillRect((W - tw) / 2, H - 74, tw, 24);
    ctx.strokeStyle = '#ffd447';
    ctx.lineWidth = 1;
    ctx.strokeRect((W - tw) / 2, H - 74, tw, 24);
    ctx.fillStyle = '#f5f3ea';
    ctx.textAlign = 'center';
    ctx.fillText(this.toast.text, W / 2, H - 57);
    ctx.restore();
  };

  /* ---------------- 标题页 ---------------- */
  Game.prototype.drawTitle = function (ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#180f2c');
    g.addColorStop(1, '#3a1420');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 装饰：对峙的两个剪影
    S.drawFighter(ctx, {
      x: 92, y: 250, facing: 1, pose: S.POSES.stand(),
      palette: AK.CHARACTERS[0].palette, build: 'normal', scale: 1.5, alpha: 0.35
    });
    S.drawFighter(ctx, {
      x: 392, y: 250, facing: -1, pose: S.POSES.stand(),
      palette: AK.CHARACTERS[3].palette, build: 'slim', scale: 1.5, alpha: 0.35
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd447';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('拳  魂', W / 2, 84);
    ctx.fillStyle = '#f5f3ea';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('A R C A D E   F I S T', W / 2, 106);
    ctx.fillStyle = 'rgba(245,243,234,0.55)';
    ctx.font = '10px sans-serif';
    ctx.fillText('原创像素格斗 · 点开即玩', W / 2, 122);
    ctx.restore();

    this.uiButton(ctx, 'start', W / 2 - 62, 140, 124, 30, '开始对战', { primary: true });
    this.uiButton(ctx, 'chars', W / 2 - 62, 176, 60, 24, '角色', {});
    this.uiButton(ctx, 'mute', W / 2 + 2, 176, 60, 24, this.save.muted ? '音效关' : '音效开', {});

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(245,243,234,0.40)';
    ctx.font = '9px sans-serif';
    ctx.fillText('本作为原创致敬作品，不含任何第三方版权素材', W / 2, H - 22);
    ctx.fillText(AK.ADS.debug ? '广告：调试模拟模式（不计入收益）' : '广告：已接入', W / 2, H - 10);
    ctx.restore();
  };

  /* ---------------- 选人页（组建 3 人战队） ---------------- */
  Game.prototype.drawSelect = function (ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#10131f');
    g.addColorStop(1, '#1d2436');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5f3ea';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('组建战队 · 选 ' + this.sel.team.length + '/3 人', W / 2, 22);
    ctx.restore();

    // 6 张角色卡（3 列 × 2 行）
    var cw = 140, chh = 60, gx = 20, gy = 30, gapx = 10, gapy = 6;
    for (var i = 0; i < AK.CHARACTERS.length; i++) {
      var ch = AK.CHARACTERS[i];
      var col = i % 3, row = Math.floor(i / 3);
      var bx = gx + col * (cw + gapx), by = gy + row * (chh + gapy);
      var unlocked = this.isUnlocked(ch.id);
      var idx = this.sel.team.indexOf(ch.id);
      var inTeam = idx >= 0;
      S.drawPortrait(ctx, ch, bx, by, cw, chh, { selected: inTeam });
      if (!unlocked) {
        ctx.save();
        ctx.fillStyle = 'rgba(6,8,14,0.7)';
        ctx.fillRect(bx, by, cw, chh);
        ctx.fillStyle = '#ffd447';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('未解锁 · 点击', bx + cw / 2, by + chh / 2 + 4);
        ctx.restore();
      }
      // 名字
      ctx.save();
      ctx.fillStyle = 'rgba(8,10,16,0.7)';
      ctx.fillRect(bx, by + chh - 14, cw, 14);
      ctx.textAlign = 'left';
      ctx.fillStyle = inTeam ? '#ffd447' : '#f5f3ea';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(ch.name, bx + 4, by + chh - 4);
      ctx.restore();
      // 选中的出场顺位徽标
      if (inTeam) {
        ctx.save();
        ctx.fillStyle = '#ffd447';
        ctx.fillRect(bx, by, 16, 14);
        ctx.fillStyle = '#12151f';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('' + (idx + 1), bx + 8, by + 11);
        ctx.restore();
      }
      this.uiButton(ctx, 'pick:' + i, bx, by, cw, chh, '', { invisible: true });
    }

    // 底部：战队槽位
    var sy = 196;
    for (var s = 0; s < 3; s++) {
      var sx = 20 + s * 64;
      ctx.save();
      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(sx, sy, 58, 30);
      ctx.strokeStyle = s < this.sel.team.length ? '#ffd447' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = s < this.sel.team.length ? 2 : 1;
      ctx.strokeRect(sx, sy, 58, 30);
      if (s < this.sel.team.length) {
        var tc = AK.characterById(this.sel.team[s]);
        ctx.fillStyle = tc.palette.accent;
        ctx.fillRect(sx + 4, sy + 4, 22, 22);
        ctx.fillStyle = '#f5f3ea';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(tc.name.split(' ')[0], sx + 30, sy + 13);
        ctx.fillText(tc.archetype, sx + 30, sy + 24);
      } else {
        ctx.fillStyle = 'rgba(245,243,234,0.35)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('空', sx + 29, sy + 18);
      }
      ctx.restore();
    }
    this.uiButton(ctx, 'random', 214, sy, 56, 30, '随机', {});
    if (AK.ECON.startCoins !== undefined) { /* 占位，避免无用分支告警 */ }

    // 难度 / 解锁（互斥显示）
    if (this.sel.lockTarget >= 0) {
      var lk = AK.CHARACTERS[this.sel.lockTarget];
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd447';
      ctx.font = '10px sans-serif';
      ctx.fillText('解锁 ' + lk.name, W / 2, 214);
      ctx.restore();
      this.uiButton(ctx, 'unlockAd', 214, 222, 100, 22, '看广告解锁', { accent: true });
      this.uiButton(ctx, 'unlockCoin', 320, 222, 100, 22, '◆' + AK.ECON.characterPrice + ' 解锁', {});
    } else {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(245,243,234,0.6)';
      ctx.font = '9px sans-serif';
      ctx.fillText('难度', 48, 214);
      ctx.restore();
      for (var d = 0; d < AK.DIFFICULTY.length; d++) {
        this.uiButton(ctx, 'diff:' + d, 20 + d * 56, 220, 50, 20, AK.DIFFICULTY[d].name, { selected: this.sel.difficulty === d });
      }
    }

    var ready = this.sel.team.length === 3 && this.sel.team.every(function (id) { return this.isUnlocked(id); }, this);
    this.uiButton(ctx, 'fight', W - 92, H - 34, 80, 26, '开 打', { primary: true, disabled: !ready });
    this.uiButton(ctx, 'back', 12, H - 34, 56, 26, '返回', {});
  };

  /* ---------------- 结算页 ---------------- */
  Game.prototype.drawResult = function (ctx) {
    var r = this.matchResult;
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,16,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = r.win ? '#ffd447' : '#ff6a4a';
    ctx.fillText(r.win ? 'YOU WIN!' : 'YOU LOSE', W / 2, 76);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#f5f3ea';
    ctx.fillText(r.score, W / 2, 100);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(245,243,234,0.7)';
    ctx.fillText('◆ 获得金币  ' + r.coins + (r.doubled ? '（已翻倍）' : ''), W / 2, 120);
    ctx.restore();

    var by = 138;
    if (!r.doubled) {
      this.uiButton(ctx, 'doubleReward', W / 2 - 108, by, 104, 26, '看广告 x' + AK.ADS.policy.rewardMultiplier + ' 金币', { accent: true });
    } else {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6fd7ff';
      ctx.font = '11px sans-serif';
      ctx.fillText('奖励已翻倍 ✓', W / 2, by + 17);
      ctx.restore();
    }
    this.uiButton(ctx, 'again', W / 2 + 4, by, 104, 26, '再 来 一 局', { primary: true });

    // 失败且未复活 → 复活按钮
    if (!r.win && !this.reviveUsed) {
      this.uiButton(ctx, 'revive', W / 2 - 108, by + 34, 216, 26, '观看广告 · 复活再战', { accent: true });
    }
    if (!r.win && this.reviveUsed) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(245,243,234,0.45)';
      ctx.font = '10px sans-serif';
      ctx.fillText('本局已使用复活', W / 2, by + 50);
      ctx.restore();
    }

    this.uiButton(ctx, 'toSelect', W / 2 - 108, by + 70, 104, 24, '更换角色', {});
    this.uiButton(ctx, 'toTitle', W / 2 + 4, by + 70, 104, 24, '返回标题', {});

    if (AK.ADS.debug) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(111,215,255,0.6)';
      ctx.font = '9px sans-serif';
      ctx.fillText('调试模式：广告为模拟播放，' + AK.ads.summary(), W / 2, H - 12);
      ctx.restore();
    }
  };

  /* ================= 立即模式 UI ================= */
  Game.prototype.uiButton = function (ctx, id, x, y, w, h, label, opts) {
    opts = opts || {};
    if (opts.invisible) {
      this.hotspots.push({ id: id, x: x, y: y, w: w, h: h });
      return;
    }
    var disabled = !!opts.disabled;
    ctx.save();
    ctx.globalAlpha = disabled ? 0.35 : 1;
    var bg = opts.primary ? '#ffd447' : (opts.accent ? '#6fd7ff' : '#232a3a');
    if (opts.selected) bg = '#3a4a66';
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = opts.selected ? '#ffd447' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = opts.selected ? 2 : 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = (opts.primary || opts.accent) ? '#12151f' : '#f5f3ea';
    ctx.font = 'bold ' + (label.length > 8 ? 10 : 12) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
    if (!disabled) this.hotspots.push({ id: id, x: x, y: y, w: w, h: h });
  };

  /* ================= 输入处理 ================= */
  Game.prototype.toLogical = function (px, py) {
    var v = this.view;
    return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
  };

  Game.prototype.onPointerDown = function (px, py, id) {
    var p = this.toLogical(px, py);

    // 模拟广告优先
    if (AK.ads.isMockShowing()) {
      if (AK.ads.hitCloseButton(p.x, p.y, W, H)) AK.ads.closeMock(true);
      return;
    }

    // 虚拟按键（对战中）
    if (this.scene === 'battle') {
      for (var i = 0; i < PAD.length; i++) {
        var b = PAD[i];
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
          if (b.type === 'dir' || b.id === 'block') this.held[b.id] = true;
          else this.press[b.id] = true;
          this.touchMap[id == null ? b.id : id] = b.id;
          AK.audio.play('move');
          return;
        }
      }
      return;
    }

    // UI 热区
    for (var j = 0; j < this.hotspots.length; j++) {
      var hs = this.hotspots[j];
      if (p.x >= hs.x && p.x <= hs.x + hs.w && p.y >= hs.y && p.y <= hs.y + hs.h) {
        this.onUiClick(hs.id);
        return;
      }
    }
  };

  Game.prototype.onPointerUp = function (px, py, id) {
    var key = id == null ? null : this.touchMap[id];
    if (this.scene === 'battle') {
      if (key) { delete this.held[key]; delete this.touchMap[id]; return; }
      // 无 id 时：按坐标释放
      var p = this.toLogical(px, py);
      if (p.x < 240 && p.y > 150) {
        this.held.left = false; this.held.right = false;
        this.held.up = false; this.held.down = false; this.held.block = false;
      }
    }
    if (key) delete this.held[key];
  };

  Game.prototype.onPointerCancel = function () {
    this.held = {};
    this.touchMap = {};
  };

  Game.prototype.onUiClick = function (id) {
    var self = this;
    AK.audio.play('confirm');
    AK.audio.resume();

    if (id === 'start') { this.setScene('select'); return; }
    if (id === 'back' || id === 'toTitle') { this.setScene('title'); return; }
    if (id === 'toSelect') { this.setScene('select'); return; }
    if (id === 'mute') {
      this.save.muted = !this.save.muted;
      AK.audio.setMuted(this.save.muted);
      this.persist();
      return;
    }
    if (id === 'chars') { this.setScene('select'); return; }

    if (id.indexOf('pick:') === 0) {
      var pi = parseInt(id.split(':')[1], 10);
      var pch = AK.CHARACTERS[pi];
      if (!this.isUnlocked(pch.id)) { this.sel.lockTarget = pi; return; }
      this.sel.lockTarget = -1;
      var ti = this.sel.team.indexOf(pch.id);
      if (ti >= 0) this.sel.team.splice(ti, 1);
      else if (this.sel.team.length < 3) this.sel.team.push(pch.id);
      else this.showToast('战队已满 3 人，先取消一人');
      return;
    }
    if (id === 'random') {
      var pool = AK.CHARACTERS.filter(function (c) { return this.isUnlocked(c.id); }, this);
      // 洗牌取 3
      for (var r = pool.length - 1; r > 0; r--) {
        var j = Math.floor(Math.random() * (r + 1));
        var tmp = pool[r]; pool[r] = pool[j]; pool[j] = tmp;
      }
      this.sel.team = pool.slice(0, 3).map(function (c) { return c.id; });
      this.sel.lockTarget = -1;
      return;
    }
    if (id.indexOf('diff:') === 0) {
      this.sel.difficulty = parseInt(id.split(':')[1], 10);
      return;
    }
    if (id === 'fight') {
      if (this.sel.team.length !== 3) { this.showToast('请先选满 3 名队员'); return; }
      for (var fi = 0; fi < this.sel.team.length; fi++) {
        if (!this.isUnlocked(this.sel.team[fi])) { this.showToast('队伍中有未解锁角色'); return; }
      }
      this.startMatch(this.sel.team.slice(), AK.DIFFICULTY[this.sel.difficulty].id, this.randomTeam());
      return;
    }
    if (id === 'again') {
      this.startMatch(this.p1Team.slice(), this.matchDiff, this.p2Team.slice());
      return;
    }
    if (id === 'unlockCoin') {
      var cur = AK.CHARACTERS[this.sel.lockTarget];
      if (!cur) return;
      if (this.save.coins >= AK.ECON.characterPrice) {
        this.addCoins(-AK.ECON.characterPrice);
        this.save.unlocked.push(cur.id);
        this.persist();
        this.showToast('已解锁 ' + cur.name);
      } else {
        this.showToast('金币不足，可看广告解锁');
      }
      this.sel.lockTarget = -1;
      return;
    }
    if (id === 'unlockAd') {
      var target = AK.CHARACTERS[this.sel.lockTarget];
      if (!target) return;
      AK.ads.showRewarded(function (res) {
        if (res.ok) {
          if (self.save.unlocked.indexOf(target.id) < 0) self.save.unlocked.push(target.id);
          self.persist();
          self.showToast('解锁成功：' + target.name);
        } else {
          self.showToast('需完整观看广告才能解锁');
        }
        self.sel.lockTarget = -1;
      });
      return;
    }
    if (id === 'doubleReward') {
      AK.ads.showRewarded(function (res) {
        if (res.ok) {
          var extra = self.matchResult.coins * (AK.ADS.policy.rewardMultiplier - 1);
          self.addCoins(extra);
          self.matchResult.doubled = true;
          self.matchResult.coins += extra;
          self.showToast('奖励已翻倍 +' + extra);
        } else {
          self.showToast('未完整观看，奖励未翻倍');
        }
      });
      return;
    }
    if (id === 'revive') {
      AK.ads.showRewarded(function (res) {
        if (res.ok) {
          self.reviveUsed = true;
          // 复活玩家战队最后一名倒下的队员
          if (self.teamPos[0] > 0) {
            self.teamPos[0]--;
            self.koFlags[0][self.teamPos[0]] = false;
            self.f1 = self.spawnMember(0);
          }
          self.wins[1] = Math.max(0, self.wins[1] - 1);
          self.matchOver = false;
          self.beginRound(false);
          self.setScene('battle');
          self.showToast('复活成功！继续战斗');
        } else {
          self.showToast('未完整观看，无法复活');
        }
      });
      return;
    }
  };

  /* 键盘（Web） */
  Game.prototype.onKey = function (code, down) {
    if (this.scene === 'battle') {
      var map = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
        KeyJ: 'a', KeyK: 'b', KeyU: 'c', KeyI: 'd',
        Space: 'special', KeyL: 'block', ShiftLeft: 'block'
      };
      var k = map[code];
      if (k) {
        if (down && (k === 'a' || k === 'b' || k === 'c' || k === 'd' || k === 'special')) this.press[k] = true;
        else if (down) this.held[k] = true;
        else { delete this.held[k]; delete this.press[k]; }
        return true;
      }
    }
    if (!down) return false;
    // 菜单快捷键
    if (code === 'Enter' || code === 'Space') {
      if (this.scene === 'title') this.setScene('select');
      else if (this.scene === 'select') this.onUiClick('fight');
      else if (this.scene === 'result') this.onUiClick('again');
      return true;
    }
    if (code === 'Escape') {
      if (this.scene === 'battle') this.setScene('title');
      else if (this.scene === 'select' || this.scene === 'result') this.setScene('title');
      return true;
    }
    return false;
  };

  AK.Game = Game;
  AK.PAD = PAD;
})(typeof globalThis !== 'undefined' ? globalThis : this);
