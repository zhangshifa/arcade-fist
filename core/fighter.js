/*!
 * 拳魂 ARCADE FIST — 角色状态机与格斗判定
 * 平台无关。输入为抽象 input 对象，由 Web 键盘/触屏 或 小程序触摸/AI 提供。
 */
(function (root) {
  'use strict';
  var AK = (root.AK = root.AK || {});
  var S = AK.sprites;
  var P = S.P;

  var GRAVITY = 0.62;
  var JUMP_V = -9.6;
  var BASE_SPEED = 2.5;
  var BODY_HALF = 13;

  function Fighter(ch, x, facing, isAI) {
    this.ch = ch;
    this.x = x;
    this.y = AK.GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.isAI = !!isAI;

    this.maxHp = Math.round(AK.RULES.maxHp * ch.stats.hp);
    this.hp = this.maxHp;
    this.power = 0;
    this.maxPower = AK.RULES.maxPower;

    this.state = 'idle';
    this.st = 0;              // 当前状态计时
    this.move = null;
    this.moveFrame = 0;
    this.moveHit = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.hitstop = 0;
    this.flash = 0;
    this.onGround = true;
    this.airMoveLocked = false;
    this.poseBuf = S.pose();
    this.poseTarget = S.pose();
    this.animT = 0;
    this.specialPhase = 0;
    this.rushHits = 0;
    this.victoryT = 0;
    this.blockHold = 0;
  }

  Fighter.prototype.width = function () { return BODY_HALF * 2; };

  /* ---------------- 包围盒 ---------------- */
  Fighter.prototype.hurtBox = function () {
    var crouch = this.state === 'crouch' || (this.move && this.move.low && this.state === 'attack');
    var top = this.y - (crouch ? 58 : 88);
    return { x: this.x - BODY_HALF, y: top, w: BODY_HALF * 2, h: this.y - top };
  };

  Fighter.prototype.hitBox = function () {
    if (this.state !== 'attack' || !this.move) return null;
    var m = this.move;
    if (this.moveFrame < m.startup || this.moveFrame >= m.startup + m.active) return null;
    var reach = m.reach * this.ch.stats.reach;
    var x = this.facing > 0 ? this.x + 6 : this.x - 6 - reach;
    var yTop, h;
    if (m.low) { yTop = this.y - 30; h = 26; }
    else if (this.state === 'jumpAttack' || !this.onGround) { yTop = this.y - 78; h = 34; }
    else if (m.name === '重脚') { yTop = this.y - 84; h = 40; }
    else { yTop = this.y - 80; h = 30; }
    return { x: x, y: yTop, w: reach, h: h, move: m };
  };

  /* ---------------- 状态切换 ---------------- */
  Fighter.prototype.setState = function (s) {
    this.state = s;
    this.st = 0;
    this.move = null;
    this.moveFrame = 0;
    this.moveHit = false;
  };

  Fighter.prototype.canAct = function () {
    return this.state === 'idle' || this.state === 'walk' || this.state === 'crouch';
  };

  Fighter.prototype.isBusy = function () {
    return this.state === 'attack' || this.state === 'hitstun' || this.state === 'blockstun' ||
           this.state === 'ko' || this.state === 'special' || this.state === 'sweep';
  };

  /* 发起普通招式 */
  Fighter.prototype.tryMove = function (name) {
    if (this.state === 'ko') return false;
    var m = AK.MOVES[name];
    if (!m) return false;

    // 取消：命中后的连段取消窗口（命中后 recovery 内可接下一招）
    var canCancel = this.state === 'attack' && this.moveHit && this.moveFrame >= this.move.startup;
    if (!this.canAct() && !canCancel) return false;
    if (this.state === 'attack' && !canCancel) return false;

    var crouching = this.state === 'crouch';
    var air = !this.onGround;
    if (air) {
      if (name !== 'lightPunch' && name !== 'heavyPunch' && name !== 'lightKick' && name !== 'heavyKick') return false;
      this.state = 'jumpAttack';
    } else if (crouching) {
      if (name === 'lightPunch' || name === 'heavyPunch') name = 'crouchPunch';
      else if (name === 'lightKick' || name === 'heavyKick') name = 'crouchKick';
      this.state = 'attack';
    } else {
      this.state = 'attack';
    }

    this.move = AK.MOVES[name];
    this.moveFrame = 0;
    this.moveHit = false;
    this.st = 0;
    if (canCancel) this.combo++;
    return true;
  };

  /* 发起必杀技 */
  Fighter.prototype.trySpecial = function (game) {
    if (this.state === 'ko' || this.state === 'special') return false;
    if (this.power < this.ch.special.cost) return false;
    if (!this.canAct()) return false;
    this.state = 'special';
    this.st = 0;
    this.specialPhase = 0;
    this.rushHits = 0;
    this.power = 0;
    this.vx = 0;
    if (game) game.onSpecialStart(this);
    return true;
  };

  /* 跳跃 / 移动 */
  Fighter.prototype.tryJump = function () {
    if (!this.onGround || this.isBusy()) return false;
    if (this.state === 'crouch') this.setState('idle');
    this.onGround = false;
    this.vy = JUMP_V;
    this.state = 'jump';
    this.st = 0;
    return true;
  };

  /* ---------------- 受击 ---------------- */
  Fighter.prototype.applyHit = function (game, m, attacker, opts) {
    opts = opts || {};
    var blocked = false;
    var isLow = !!m.low;
    var guarding = this.state === 'block' || (this.blockHold > 0 && this.canAct());

    // 扫堂腿 / 下段攻击必须蹲防；简化：蹲防才挡下段
    if (guarding) {
      if (isLow) blocked = this.state === 'crouchBlock';
      else blocked = true;
    }

    var dmg = m.dmg * attacker.ch.stats.atk;
    var comboIdx = Math.min(attacker.combo, AK.RULES.comboDecay.length - 1);
    dmg *= AK.RULES.comboDecay[comboIdx];
    dmg = Math.max(1, Math.round(dmg));

    if (blocked) {
      var chip = Math.max(0, Math.round(dmg * AK.RULES.chipDamageOnBlock));
      this.hp -= chip;
      this.power = Math.min(this.maxPower, this.power + dmg * 0.6);
      this.setState('blockstun');
      this.blockstunFrames = m.blockstun;
      this.vx = attacker.facing * m.push * 0.55 * (this.ch.stats.hp < 1 ? 1.15 : 1);
      game.onBlocked(this, attacker, m, chip);
    } else {
      this.hp -= dmg;
      this.power = Math.min(this.maxPower, this.power + dmg * 0.9);
      this.flash = 6;
      if (m.sweep) {
        this.setState('sweep');   // 被扫倒
        this.st = 0;
        this.vx = attacker.facing * m.push * 0.7;
      } else {
        this.setState('hitstun');
        this.hitstunFrames = m.hitstun;
        this.vx = attacker.facing * m.push;
      }
      attacker.combo++;
      attacker.comboTimer = 60;
      game.onHit(this, attacker, m, dmg);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.setState('ko');
      this.vx = attacker.facing * 3.2;
      this.vy = -4.0;
      this.onGround = false;
    }
    return { blocked: blocked, dmg: dmg };
  };

  /* ---------------- 每帧更新 ---------------- */
  /**
   * @param input {left,right,up,down,block,a,b,c,d,special}
   */
  Fighter.prototype.update = function (game, input, opp) {
    var R = AK.RULES;
    this.st++;
    if (this.flash > 0) this.flash--;
    if (this.hitstop > 0) { this.hitstop--; return; }

    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer === 0) this.combo = 0;
    }

    var spd = this.ch.stats.spd;
    var prevState = this.state;

    switch (this.state) {
      case 'idle':
      case 'walk':
      case 'crouch':
        this.handleGround(game, input, opp, spd);
        break;
      case 'jump':
        this.handleAir(game, input, spd);
        break;
      case 'attack':
        this.updateAttack(game, input, opp);
        break;
      case 'jumpAttack':
        this.updateAttack(game, input, opp);
        this.handleAir(game, input, spd, true);
        break;
      case 'block':
      case 'crouchBlock':
        this.vx *= 0.7;
        this.facing = opp ? (opp.x >= this.x ? 1 : -1) : this.facing;
        if (!input.block) {
          this.setState(this.onGround ? 'idle' : 'jump');
        } else if (input.down && this.state === 'block') {
          this.setState('crouchBlock');
        } else if (!input.down && this.state === 'crouchBlock') {
          this.setState('block');
        }
        break;
      case 'hitstun':
        this.vx *= 0.86;
        if (--this.hitstunFrames <= 0) this.setState('idle');
        break;
      case 'blockstun':
        this.vx *= 0.84;
        if (--this.blockstunFrames <= 0) this.setState('idle');
        break;
      case 'sweep':
        this.vx *= 0.9;
        if (this.st > 34) this.setState('idle');
        break;
      case 'special':
        this.updateSpecial(game, input, opp);
        break;
      case 'ko':
        this.vx *= 0.93;
        break;
      case 'victory':
        this.victoryT++;
        this.vx = 0;
        break;
    }

    /* 物理 */
    if (!this.onGround) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= AK.GROUND_Y) {
        this.y = AK.GROUND_Y;
        this.vy = 0;
        this.onGround = true;
        if (this.state === 'jump') this.setState('idle');
        else if (this.state === 'jumpAttack') this.setState('idle');
        else if (this.state === 'ko') this.vx = 0;
      }
    }
    this.x += this.vx;
    if (this.onGround && this.state !== 'ko' && this.state !== 'sweep') this.vx *= 0.72;

    /* 边界 */
    if (this.x < AK.STAGE_MIN_X) this.x = AK.STAGE_MIN_X;
    if (this.x > AK.STAGE_MAX_X) this.x = AK.STAGE_MAX_X;

    /* 自动面向（仅自由状态；防御/受击时保持朝向，避免判定翻转） */
    if (opp && (this.state === 'idle' || this.state === 'walk' || this.state === 'crouch')) {
      this.facing = opp.x >= this.x ? 1 : -1;
    }

    /* 姿态解算 */
    this.resolvePose(prevState);
  };

  /** 按住防御键即进入防御（简化操作，适配触屏） */
  Fighter.prototype.handleGround = function (game, input, opp, spd) {
    var moving = false;
    var dir = 0;
    if (input.left) dir -= 1;
    if (input.right) dir += 1;

    // 后撤步速度略慢
    var away = false;
    if (opp && dir !== 0) {
      var towardOpp = opp.x >= this.x ? 1 : -1;
      away = dir !== towardOpp;
    }
    if (input.block && this.onGround) {
      this.setState(input.down ? 'crouchBlock' : 'block');
      this.vx = 0;
      return;
    }

    if (input.down) {
      if (this.state !== 'crouch') this.setState('crouch');
      this.vx = 0;
      return;
    }
    if (this.state === 'crouch') this.setState('idle');

    if (input.up) { this.tryJump(); return; }

    // 攻击输入
    if (input.special) { if (this.trySpecial(game)) return; }
    if (input.d) { if (this.tryMove('heavyKick')) return; }
    if (input.c) { if (this.tryMove('lightKick')) return; }
    if (input.b) { if (this.tryMove('heavyPunch')) return; }
    if (input.a) { if (this.tryMove('lightPunch')) return; }

    if (dir !== 0) {
      this.vx = dir * BASE_SPEED * spd * (away ? 0.72 : 1);
      moving = true;
      this.setState('walk');
    } else {
      this.vx *= 0.6;
      if (this.state !== 'idle') this.setState('idle');
    }
    this.walkPhase = (this.walkPhase || 0) + (moving ? 0.22 * spd : 0);
  };

  Fighter.prototype.handleAir = function (game, input, spd, noInput) {
    if (!noInput) {
      if (input.a || input.b) { if (this.tryMove(input.b ? 'heavyPunch' : 'lightPunch')) return; }
      if (input.c || input.d) { if (this.tryMove(input.d ? 'heavyKick' : 'lightKick')) return; }
    }
    // 空中微调
    if (input.left) this.vx = -BASE_SPEED * 0.62 * spd;
    else if (input.right) this.vx = BASE_SPEED * 0.62 * spd;
    else this.vx *= 0.98;
  };

  Fighter.prototype.updateAttack = function (game, input, opp) {
    var m = this.move;
    this.moveFrame++;
    if (this.onGround) this.vx *= 0.8;

    // 判定帧：交给 game 统一检测（避免双向重复）
    var total = m.startup + m.active + m.recovery;
    if (this.moveFrame >= total) {
      this.setState(this.onGround ? 'idle' : 'jump');
    }
  };

  Fighter.prototype.updateSpecial = function (game, input, opp) {
    var sp = this.ch.special;
    this.specialPhase++;
    // 0-18 蓄力，18 释放，之后硬直到 46
    if (this.specialPhase === 18) {
      game.fireSpecial(this, opp);
    }
    if (this.specialPhase >= 52) {
      this.setState('idle');
    }
  };

  /* ---------------- 姿态解算 ---------------- */
  Fighter.prototype.resolvePose = function (prevState) {
    var POSES = S.POSES;
    var target = this.poseTarget;
    var base;

    switch (this.state) {
      case 'idle':
        base = POSES.stand();
        // 呼吸
        var br = Math.sin(this.st * 0.09) * 0.6;
        base[P.HIPY] += br;
        base[P.HDY] += br * 0.5;
        base[P.AF1] += Math.sin(this.st * 0.09) * 0.03;
        base[P.AB1] += Math.sin(this.st * 0.09 + 1) * 0.03;
        break;
      case 'walk':
        base = POSES.walk();
        var ph = this.walkPhase || 0;
        var sw = Math.sin(ph) * 0.36;
        base[P.LF1] += sw; base[P.LF2] -= sw * 0.5;
        base[P.LB1] -= sw; base[P.LB2] += sw * 0.5;
        base[P.AF1] -= sw * 0.25;
        base[P.AB1] += sw * 0.25;
        base[P.HIPY] += Math.abs(Math.sin(ph)) * 1.4;
        break;
      case 'crouch':
        base = POSES.crouch();
        break;
      case 'jump':
      case 'jumpAttack':
        base = POSES.jump();
        break;
      case 'attack':
        base = this.attackPose();
        break;
      case 'block':
        base = POSES.block();
        break;
      case 'crouchBlock':
        base = POSES.block();
        base[P.HIPY] = 15;
        base[P.LF1] = 1.30; base[P.LF2] = -1.15;
        base[P.LB1] = 1.15; base[P.LB2] = -1.35;
        break;
      case 'hitstun':
        base = POSES.hit();
        base[P.LEAN] -= Math.min(0.2, this.st * 0.02);
        break;
      case 'blockstun':
        base = POSES.block();
        base[P.HDX] -= 2;
        break;
      case 'sweep':
        base = POSES.ko();
        base[P.HIPY] = 30;
        break;
      case 'special':
        base = this.specialPhase < 18
          ? S.lerpPose(POSES.stand(), POSES.specialCast(), Math.min(1, this.specialPhase / 12))
          : S.lerpPose(POSES.specialCast(), POSES.specialFire(), Math.min(1, (this.specialPhase - 18) / 5));
        break;
      case 'ko':
        base = POSES.ko();
        break;
      case 'victory':
        base = POSES.victory();
        base[P.HIPY] += Math.sin(this.victoryT * 0.1) * 1.5;
        break;
      default:
        base = POSES.stand();
    }

    // 平滑过渡
    var k = (this.state !== prevState) ? 0.55 : 0.34;
    if (this.state === 'attack' || this.state === 'special') k = 0.85;
    S.lerpPose(this.poseBuf, base, k, this.poseBuf);
  };

  Fighter.prototype.attackPose = function () {
    var m = this.move;
    var f = this.moveFrame;
    var total = m.startup + m.active + m.recovery;
    var POSES = S.POSES;
    var start = POSES.stand();
    var end;

    switch (m.name) {
      case '轻拳': end = POSES.punchLight(); break;
      case '重拳': end = POSES.punchHeavy(); break;
      case '轻脚': end = POSES.kickLight(); break;
      case '重脚': end = POSES.kickHeavy(); break;
      case '蹲拳': end = POSES.crouchPunch(); break;
      case '扫堂腿': end = POSES.crouchKick(); break;
      default: end = POSES.punchLight();
    }

    var t;
    if (f < m.startup) {
      // 起手：从预备拉到出招（前 60% 回拉，后 40% 爆发出去）
      var a = f / Math.max(1, m.startup);
      t = a < 0.45 ? -a * 0.5 : (a - 0.45) / 0.55;
      return S.lerpPose(start, end, Math.max(-0.25, t));
    } else if (f < m.startup + m.active) {
      t = 1;
      return end;
    } else {
      var r = (f - m.startup - m.active) / Math.max(1, m.recovery);
      t = 1 - r * r;
      return S.lerpPose(start, end, Math.max(0, t));
    }
  };

  /* ---------------- 绘制 ---------------- */
  Fighter.prototype.draw = function (ctx, game) {
    var crouch = this.state === 'crouch' || this.state === 'crouchBlock' || (this.move && this.move.low);
    var shadowW = crouch ? 30 : 24;
    var airborne = !this.onGround;
    var shA = airborne ? 0.18 * (1 - Math.min(0.6, (AK.GROUND_Y - this.y) / 120)) : 0.32;
    S.drawShadow(ctx, this.x, AK.GROUND_Y, shadowW, shA);

    var rot = 0;
    if (this.state === 'ko') rot = this.facing * -1.35;
    else if (this.state === 'sweep') rot = this.facing * -0.95;

    var koDrop = (this.state === 'ko' || this.state === 'sweep') ? 18 : 0;

    S.drawFighter(ctx, {
      x: this.x,
      y: this.y + koDrop,
      facing: this.facing,
      pose: this.poseBuf,
      palette: this.ch.palette,
      build: this.ch.build,
      scale: 1,
      flash: this.flash,
      rotate: rot,
      eyes: (this.state === 'ko' || this.state === 'sweep') ? 'closed' : 'open'
    });

    // 蹲防 / 防御火花提示
    if (this.state === 'block' || this.state === 'crouchBlock') {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#9fe0ff';
      var gx = this.x + this.facing * 14;
      ctx.fillRect(Math.round(gx - 1), Math.round(this.y - (crouch ? 52 : 76)), 2, crouch ? 48 : 68);
      ctx.restore();
    }
  };

  AK.Fighter = Fighter;
})(typeof globalThis !== 'undefined' ? globalThis : this);
