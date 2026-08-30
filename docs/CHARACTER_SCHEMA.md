# 角色换皮格式（CHARACTER_SCHEMA）

> 拳魂 ARCADE FIST 是**数据驱动**的格斗引擎：角色 = `core/constants.js` 里的一个对象。
> 换角色 / 套壳 / 加新角色 **只改数据，不动引擎**（`core/game.js`、`core/fighter.js` 无需碰）。

## 一个角色对象的全部字段

```js
{
  id: 'retsua',          // 唯一标识（ASCII，必填，选人/存档都用它）
  name: '炎武 · 烈云',    // 显示名（支持中文·分隔）
  team: 'team-blaze',    // 所属战队 id（对应 AK.TEAMS[].id）
  style: '炎之均衡',      // 流派标签（显示用）
  archetype: '均衡',      // 原型标签（显示用）
  desc: '攻守均衡的队长…', // 选人页简介
  locked: false,          // 是否默认锁定（true 时需看广告/金币解锁）
  build: 'normal',        // 体型：normal / slim / heavy —— 决定像素骨架比例
  stats: {                // 数值倍率（相对基准 1.0）
    hp: 1.0,              // 血量倍率
    atk: 1.0,             // 攻击倍率
    spd: 1.0,             // 移动/出手速度倍率
    reach: 1.0            // 攻击距离倍率
  },
  // 可选：覆盖全局 AK.MOVES，做差异化手感（见下文）
  moves: {
    heavyPunch: { key:'B', name:'岩拳', startup:11, active:5, recovery:18,
                  dmg:14, hitstun:24, blockstun:14, push:4.0, reach:36, hi:true }
  },
  special: {              // 必杀技
    name: '烈焰波动弹',    // 必杀显示名
    type: 'projectile',   // 见下方枚举
    cost: 100,            // 消耗气槽（当前固定满气放）
    damage: 18,           // 基础伤害（再乘 stats.atk）
    speed: 4.4,           // 仅 projectile 用：弹道速度
    hits: 3               // 仅 rush 用：连击段数
  },
  palette: {              // 像素配色（全部 hex/rgba）
    skin:'#f2b48c', hair:'#8c2f16', top:'#e0402c', bottom:'#2a2f3a',
    belt:'#f6c945', shoe:'#f4f1e6', glove:'#f6c945', accent:'#ff7a2f',
    trail:'rgba(255,140,40,0.75)' // 必杀特效拖尾色
  }
}
```

## 必杀 `type` 枚举

| type | 机制 | fireSpecial 分支 | stepEffects 分支 | 专属参数 |
|---|---|---|---|---|
| `projectile` | 飞行弹道 | `game.js` fireSpecial | stepEffects 飞行道具 | `speed` |
| `rush` | 突进多段 | → | rush | `hits` |
| `shock` | 砸地近身 | → | shock | — |
| `dash` | 突进斩 | → | dash | — |
| `uppercut` | 对空升龙 | → | uppercut | — |
| `beam` | 前方真空波 | → | beam | — |

## 添加 / 替换角色（3 步）

1. 在 `core/constants.js` 的 `AK.CHARACTERS` 数组追加 / 修改一个对象。
2. 若新角色属于新战队，在 `AK.TEAMS` 追加 `{ id, name, members:[id1,id2,id3] }`。
3. `node scripts/sync.js` 同步到 `web/js/core` 与 `miniprogram/core`，跑 `node scripts/smoke-test.js`。

> 引擎自动读取 `stats` / `build` / `palette` / `special`，无需任何额外接线。

## 添加新必杀类型（引擎扩展点）

1. `core/constants.js`：在 `AK.MOVES` 附近注释的枚举表补充说明（可选）。
2. `core/game.js` `fireSpecial()`：加 `else if (sp.type === '新类型') { this.effects.push({ type:'新类型', ... }) }`。
3. `core/game.js` `stepEffects()`：在特效循环加 `else if (e.type === '新类型') { ...判定与粒子... }`。
4. 冒烟测试第 `[5]` 段会自动遍历所有角色验证必杀释放，无需手写新用例。

## 每角色自定义招式表（`moves`）

引擎取招式时优先用 `ch.moves[name]`，否则用全局 `AK.MOVES[name`
（`core/fighter.js` 的 `moveData()`）。

- 只覆盖你想改的招式名（其余沿用全局）。
- 覆盖对象需保持字段完整：`startup / active / recovery / dmg / hitstun / blockstun / push / reach / hi / low?`。
- 例：重装角色把 `heavyPunch` 改慢改重，速度角色把 `lightPunch` 改快。

## 美术说明

角色外观 **零外部素材**：由 `core/sprites.js` 按 `build` 骨架 + `palette` 配色程序化绘制像素。
要换美术风格，改 `sprites.js` 的绘制函数或扩展 `palette` 字段即可，仍不碰角色数据契约。
