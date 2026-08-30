/**
 * 本文件由 scripts/sync.js 从 core/ 自动生成，请勿手改。
 * 修改请编辑仓库根目录 core/ 下的同名文件后重新执行：node scripts/sync.js
 */
/*!
 * 拳魂 ARCADE FIST — AI 对手
 * 基于「决策周期 + 意图队列」，难度只调参数，不做作弊。
 */
(function (root) {
  'use strict';
  var AK = (root.AK = root.AK || {});

  function AI(levelId) {
    this.setLevel(levelId || 'normal');
    this.timer = 0;
    this.plan = 'approach';
    this.planT = 0;
    this.holdBlock = 0;
    this.input = {};
  }

  AI.prototype.setLevel = function (id) {
    this.cfg = AK.DIFFICULTY.filter(function (d) { return d.id === id; })[0] || AK.DIFFICULTY[1];
  };

  AI.prototype.blank = function () {
    return { left: false, right: false, up: false, down: false, block: false, a: false, b: false, c: false, d: false, special: false };
  };

  AI.prototype.reset = function () {
    this.timer = 0;
    this.plan = 'approach';
    this.planT = 0;
    this.holdBlock = 0;
  };

  /** @returns input 对象 */
  AI.prototype.think = function (self, opp, game) {
    var inp = this.blank();
    if (self.state === 'ko' || opp.state === 'ko' || game.roundOver) return inp;

    var dist = Math.abs(opp.x - self.x);
    var dir = (opp.x > self.x) ? 1 : -1;
    var cfg = this.cfg;
    var facingRight = dir > 0;

    // 1) 反应式防御：看到对手起招
    if (opp.state === 'attack' && opp.move && opp.moveFrame <= opp.move.startup + 1 && dist < 70) {
      if (this.holdBlock <= 0 && Math.random() < cfg.blockRate) {
        this.holdBlock = 14 + Math.floor(Math.random() * 10);
      }
    }
    if (this.holdBlock > 0) {
      this.holdBlock--;
      inp.block = true;
      // 对手下段攻击时蹲防
      if (opp.move && opp.move.low) inp.down = true;
      // 边防边微调距离
      if (dist < 34) inp[facingRight ? 'left' : 'right'] = true;
      return inp;
    }

    // 2) 决策周期
    this.timer--;
    if (this.timer <= 0) {
      this.timer = cfg.react + Math.floor(Math.random() * cfg.react);
      this.planT = 0;
      this.plan = this.decide(self, opp, dist, game);
    }
    this.planT++;

    switch (this.plan) {
      case 'approach':
        inp[facingRight ? 'right' : 'left'] = true;
        if (dist > 150 && Math.random() < 0.03) inp.up = true;
        break;

      case 'retreat':
        inp[facingRight ? 'left' : 'right'] = true;
        if (this.planT > 26) this.plan = 'approach';
        break;

      case 'wait':
        if (this.planT > 20) this.plan = 'approach';
        break;

      case 'jumpIn':
        if (self.onGround) inp.up = true;
        inp[facingRight ? 'right' : 'left'] = true;
        if (dist < 46 && !self.onGround) inp.b = true;
        if (this.planT > 40) this.plan = 'attack';
        break;

      case 'special':
        if (self.power >= self.ch.special.cost && self.canAct()) {
          inp.special = true;
        } else {
          this.plan = 'attack';
        }
        break;

      case 'attack':
      case 'combo':
        this.doAttack(inp, self, opp, dist);
        break;

      case 'crouch':
        inp.down = true;
        if (this.planT > 18) this.plan = 'attack';
        break;
    }
    return inp;
  };

  AI.prototype.decide = function (self, opp, dist, game) {
    var cfg = this.cfg;
    var r = Math.random();

    // 必杀：气满 + 距离合适
    if (self.power >= self.ch.special.cost && dist < 190 && r < cfg.specialRate * 0.35) {
      return 'special';
    }
    // 对手硬直中 → 追打
    if ((opp.state === 'hitstun' || opp.state === 'sweep' || opp.state === 'blockstun') && dist < 90) {
      return r < cfg.combo ? 'combo' : 'approach';
    }
    // 远距离
    if (dist > 96) {
      if (r < 0.16) return 'jumpIn';
      if (r < 0.24) return 'wait';
      return 'approach';
    }
    // 中近距离
    if (dist > 52) {
      if (r < cfg.aggression * 0.5) return 'jumpIn';
      if (r < cfg.aggression * 0.62) return 'approach';
      if (r < cfg.aggression * 0.72) return 'retreat';
      return 'approach';
    }
    // 贴身
    if (r < cfg.aggression) return 'attack';
    if (r < cfg.aggression + 0.12) return 'crouch';
    if (r < cfg.aggression + 0.2) return 'retreat';
    return 'wait';
  };

  AI.prototype.doAttack = function (inp, self, opp, dist) {
    var cfg = this.cfg;
    var r = Math.random();
    // 距离适配招式
    var pool;
    if (dist < 34) pool = ['a', 'a', 'c', 'b', 'd'];
    else if (dist < 48) pool = ['c', 'b', 'd', 'a'];
    else pool = ['d', 'c'];

    var key = pool[Math.floor(Math.random() * pool.length)];
    inp[key] = true;

    // 下段骚扰
    if (r < 0.18) inp.down = true;
    // 连段追击：命中后继续按
    if (this.plan === 'combo' && self.moveHit && r < cfg.combo) {
      inp[key] = true;
    }
    if (this.planT > 30) this.plan = 'approach';
  };

  AK.AI = AI;
})(typeof globalThis !== 'undefined' ? globalThis : this);

module.exports = (typeof globalThis !== 'undefined' ? globalThis : this).AK;
