# 拳魂 ARCADE FIST

> 原创像素街机格斗 · 点开即玩 · 广告变现

一个**致敬街机格斗玩法**的原创小程序 / H5 游戏：4 键格斗操作、必杀气槽、回合制 BO3、AI 难度分级、程序化像素美术（零外部素材）。**全部角色、招式、美术均为原创**，不含任何第三方版权素材，可安心上架与商业化。

主要营收为**广告**（激励视频 / 插屏 / Banner），开发期默认走**调试模拟广告**，逻辑与真实广告回调语义完全一致，上线仅改配置即可切换。

---

## ✨ 特性

- **点开即玩**：H5 版双击 `web/index.html` 即可运行，无需构建、无 ES module CORS 问题；小程序导入 `miniprogram/` 目录即可在开发者工具中运行。
- **3v3 组队淘汰赛（拳皇式赛制）**：玩家选 3 人组建战队，依次上场，KO 后换下一名，全队阵亡判负；胜者保留残血进入下一场。HUD 实时显示双方 3 名队员状态（当前 / 待命 / 阵亡）。
- **4 键格斗手感**：A/B 拳、C/D 脚、↓防、必杀（满气槽触发）。触屏虚拟按键 + 键盘双输入。
- **四种必杀技**：远程波动（projectile）、突进连踢（rush）、震地波（shock）、暗影突进（dash）。
- **6 名原创角色 · 2 支战队**：烈炎队（莱恩 / 薇拉 / 戈罗）、疾影队（库洛 / 希拉 / 雪），各有风格与数值定位（详见 `docs/CHARACTERS.md`）。
- **数据驱动「换皮」架构**：角色 / 招式 / 美术全是纯数据（`core/constants.js`），套用你自己的 IP 角色只改数据不动引擎（详见 `docs/CHARACTER_SCHEMA.md`）。
- **4 档 AI 难度**：新手 / 普通 / 困难 / 地狱。
- **完整对战流程**：组建战队 → 入场 → 第 N 战 → KO → 换人 → 全灭结算 → 复活 / 双倍奖励。
- **广告变现闭环**：看广告解锁角色、看广告复活、看广告翻倍金币、回合结束插屏（频次控制）。
- **0 素材依赖**：角色用骨骼 + 像素块程序化绘制；音效用 WebAudio 实时合成（小程序降级为振动反馈）。

---

## 📁 目录结构

```
arcade-fist/
├─ core/                 # 平台无关游戏核心（单一真相源）
│  ├─ constants.js       # 规则、角色数据、招式帧数据、广告/经济配置
│  ├─ sprites.js         # 程序化像素角色绘制
│  ├─ fighter.js         # 角色状态机与格斗判定
│  ├─ ai.js              # AI 对手
│  ├─ audio.js           # 音效（Web 合成 / 小程序振动）
│  ├─ ads.js             # 广告变现抽象层（调试模拟 + 真实广告双通道）
│  ├─ storage.js         # 本地存档
│  └─ game.js            # 场景机 + 对战流程 + 渲染 + 虚拟按键 + 接⼝
├─ web/                  # H5 点开即玩版（core/ 经 sync 复制进来）
│  ├─ index.html
│  ├─ style.css
│  ├─ js/main.js
│  └─ js/core/*
├─ miniprogram/          # 微信小程序版（core/ 经 sync 复制进来）
│  ├─ app.js / app.json / app.wxss / project.config.json / sitemap.json
│  ├─ pages/index/*
│  └─ core/*
├─ scripts/
│  ├─ sync.js            # 把 core/ 同步到 web 与 miniprogram
│  ├─ smoke-test.js      # 无头冒烟测试（51 项）
│  └─ github-push-api.mjs# 通过 api.github.com 推送（沙箱外运行）
├─ docs/
│  └─ AD_CONFIG.md       # 广告位配置与上线指南
├─ requirements.md        # 需求原文存档
└─ README.md
```

---

## 🚀 运行

### H5（点开即玩）
直接双击 `web/index.html`（或用任意静态服务器打开）。
- 键盘：`←→` 移动，`↑` 跳，`↓` 蹲，`J/K` 拳，`U/I` 脚，`L` / `Shift` 防御，`空格` 必杀。
- 移动端：屏幕左下方向/防御、右下攻击/必杀虚拟按键。

### 微信小程序（调试模式）
1. 微信开发者工具 → 导入项目 → 选择本仓库 `miniprogram/` 目录。
2. AppID 选「测试号」（`project.config.json` 已设为 `touristappid`）即可直接编译。
3. 默认 `AK.ADS.debug = true`，不请求真实广告，走内建模拟广告面板，可完整验证变现流程。

---

## 🛠 开发命令

```bash
node scripts/sync.js        # 改了 core/ 后同步到两端（web + miniprogram）
node scripts/smoke-test.js  # 跑无头冒烟测试（验证核心逻辑/广告/经济）
```

> 修改游戏逻辑只改 `core/`，再用 `sync.js` 同步；**不要手改 `web/js/core` 与 `miniprogram/core`**（它们头部有自动生成声明）。

---

## 💰 广告变现

| 场景 | 类型 | 触发点 |
| --- | --- | --- |
| 解锁角色 | 激励视频 | 选人页「看广告解锁」 |
| 失败复活 | 激励视频 | 结算页「观看广告·复活再战」 |
| 金币翻倍 | 激励视频 | 结算页「看广告 x3 金币」 |
| 回合结束 | 插屏 | 每 N 个回合（默认 3）弹一次，含频次控制 |
| 持续曝光 | Banner | 预留接口（配置广告位后启用） |

调试模式下广告为 **Canvas 内模拟面板**：含倒计时、可关闭、按真实广告语义回调 `onClose(isEnded)`，完整观看才发放奖励。

**上线切换真实广告**：见 [`docs/AD_CONFIG.md`](docs/AD_CONFIG.md) —— 仅改 `core/constants.js` 里的 `AK.ADS.debug = false` 与广告位 ID，游戏代码零改动。

---

## 📤 推送到 GitHub

```bash
# token 从环境变量注入（绝不入库），在可访问 api.github.com 的环境运行：
GITHUB_TOKEN=<你的token> node scripts/github-push-api.mjs
```

脚本会：查重 → 建库（若为空则先 Contents 引导 main 分支）→ Git Data API 建 blob/tree/commit → 更新 `main`。

---

## ⚖️ 版权声明

本作为**原创致敬作品**，角色、招式、美术、音效全部由代码程序化生成，与任何第三方格斗游戏 IP 无关。上架前请确保替换为自有素材或保持原创，避免侵权。
