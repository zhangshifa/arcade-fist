# 角色「换皮格式」说明（数据驱动套壳）

拳魂 ARCADE FIST 的所有角色都是 **纯数据**，引擎（操作 / AI / 渲染 / 广告 / 赛制）与角色内容完全解耦。这意味着：

> **换角色 = 只改数据，不动引擎。** 你可以用同一套引擎套上任意自有 IP 角色（只要你有版权或授权）。

---

## 一、数据位置

- 角色：`core/constants.js` → `AK.CHARACTERS`（数组）
- 战队：`core/constants.js` → `AK.TEAMS`（数组，元素是 `{ id, name, members:[角色id,...] }`）
- 普通技帧数据：`core/constants.js` → `AK.MOVES`（全局通用，4 键共享）
- 难度 / 场景：`AK.DIFFICULTY` / `AK.STAGES`

同步：`scripts/sync.js` 会把 `core/` 复制到 `web/js/core` 与 `miniprogram/core`，**不要手改副本**。

---

## 二、单角色对象字段

```js
{
  id: 'ryan',                 // 唯一标识（字符串），解锁/选人靠它
  name: '烈焰 · 莱恩',         // 显示名
  style: '炎拳流',            // 流派标签（显示用）
  archetype: '均衡',          // 定位（均衡/速度/重装/控场）—— 仅标注，不影响数值
  team: 'team-blaze',         // 所属战队 id（对应 AK.TEAMS）
  desc: '攻守均衡的入门角色…', // 选人页说明
  locked: false,              // 是否默认锁定（锁定后需看广告/金币解锁）
  build: 'normal',            // 体型：normal | slim | heavy（决定像素骨架）
  stats: { hp:1.0, atk:1.0, spd:1.0, reach:1.0 }, // 倍率，1.0 为基准
  special: {                  // 必杀技
    name: '烈焰波动拳',
    type: 'projectile',       // projectile | rush | shock | dash
    cost: 100,                // 耗气（满气=100，放必杀需满槽）
    damage: 18,               // 基础伤害
    speed: 4.2,               // projectile 用：弹速
    hits: 3                   // rush 用：段数
  },
  palette: {                  // 配色（决定像素外观，零素材）
    skin:'#f2b48c', hair:'#8c2f16', top:'#e0402c', bottom:'#2a2f3a',
    belt:'#f6c945', shoe:'#f4f1e6', glove:'#f6c945', accent:'#ff7a2f',
    trail:'rgba(255,140,40,0.75)'
  }
}
```

### 字段说明
| 字段 | 必填 | 作用 |
|------|------|------|
| `id` | ✅ | 唯一键，解锁/选人/战队引用都靠它 |
| `name`/`style`/`desc` | ✅ | UI 展示 |
| `team` | ✅ | 加入哪个战队（3v3 用） |
| `locked` | ✅ | `true` 时默认锁定，走广告/金币解锁 |
| `build` | ✅ | `normal`/`slim`/`heavy`，影响像素骨架高矮胖瘦 |
| `stats` | ✅ | 四项倍率，引擎据此缩放血/攻/速/手长 |
| `special.type` | ✅ | 决定必杀表现，见下表 |
| `special.cost` | ✅ | 建议 100（满气），可用更小值做「小必杀」 |
| `palette.accent` | ✅ | 主题色，用于特效、描边、必杀文字 |

### 必杀 type 一览
| type | 引擎表现 | 额外字段 |
|------|----------|----------|
| `projectile` | 发射飞行道具 | `speed` |
| `rush` | 贴身多段连击 | `hits` |
| `shock` | 地面冲击波（扫地击飞） | — |
| `dash` | 长距离突进斩 | — |

> 新增必杀形态：在 `core/game.js` 的 `fireSpecial` 里加一个 `else if (sp.type==='xxx')` 分支即可，无需改动角色数据。

---

## 三、战队对象字段

```js
{
  id: 'team-blaze',
  name: '烈炎队',
  members: ['ryan', 'vela', 'goro']   // 3 个角色 id，顺序即上场顺序
}
```

3v3 淘汰赛：玩家从全部角色中选 3 人组成自己的战队；电脑随机或固定选一队。KO 后按顺序换下一名，全队阵亡判负。

---

## 四、套用你自己的角色（换皮流程）

1. 准备你的授权角色数据（同上字段结构），可来自美术外包/你自有 IP。
2. 直接覆盖或追加到 `AK.CHARACTERS`，并把 `id` 编入某个 `AK.TEAMS.members`。
3. 若需要专属像素骨架，扩展 `core/sprites.js` 的 `drawFighter` 增加 `build` 分支（如 `mecha`/`beast`）。
4. `node scripts/sync.js` 同步两端 → 跑 `node scripts/smoke-test.js` 验证 → 推送。

引擎、4 键操作、AI、气槽必杀、广告、3v3 赛制全部复用，**零引擎改动**。

---

## 五、普通技（4 键，全局共享）

A 轻拳 / B 重拳 / C 轻脚 / D 重脚；加方向派生蹲拳、扫堂腿、跳跃拳。帧数据在 `AK.MOVES`，可按角色 `stats.reach` 缩放判定距离。要加角色专属普通技，可在角色对象里加 `moves` 覆盖字段（引擎读取时 `ch.moves || AK.MOVES`），目前版本全局共享以保证平衡与可控体积。
