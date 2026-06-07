# Toy Game Generator

输入任意一个词 —— `深海考古`、`算命`、`电脑病毒`、`退休规划` —— 几秒钟拿到一个**点开就能玩**的网页小游戏。一个 HTML 文件，离线可玩，手机也能玩。

Type any phrase — *deep-sea archaeology*, *fortune telling*, *computer virus*, *retirement planning* — and get a **playable** browser mini-game in seconds. One self-contained HTML file. Works offline. Works on mobile.

## ▶ 在线试玩 / Live demo

**https://onebluecloud.github.io/toy-game-generator/**

直接在浏览器里输入主题、切换中/英文、生成、试玩、下载。整套生成逻辑跑在你的浏览器里，**没有后端、不上传任何东西**。

Type a theme, switch language, generate, play, and download — entirely in your browser. **No backend, nothing uploaded.**

## 它是什么 / What it actually is

诚实地讲：它不是"AI 现写游戏代码"。它是一个 **GameSpec + 玩法套件(play kit)+ 模板** 的组合引擎：

- 15 个手写打磨的玩法模板（吸血鬼幸存者式生存、跑酷、塔防、卡组、消除、弹道、节奏、攀爬、放置、战棋、推理、合成 2048、羊了个羊三消、打砖块、一键飞 flappy）
- 你的主题词决定**标题、角色、配色、节奏、皮肤**，并从 12096 个候选组合里排序挑出最契合的一个
- 玩法本体是模板提供的、经过验证"能玩"的代码；主题换的是皮和文案，不是从零写规则

So you know exactly what you're getting: this is **not** "AI writes a game from scratch." It's a **GameSpec + play-kit + template** composition engine. Your theme picks the best-fitting combo out of 12096 candidates and drives the title, roles, palette, pacing, and skin. The gameplay itself is hand-built, validated template code.

> 可选的 DeepSeek 模式只用来把自然语言更好地映射到允许的套件 ID，**它不写任何游戏代码**。
> Optional DeepSeek mode only maps natural language to allowed catalog IDs — it never writes game code.

## 本地使用 / Run it yourself

### GUI（中英文 / Chinese and English）

```powershell
npm run app
# 打开 http://127.0.0.1:8787/app/
```

排序候选、生成游戏、iframe 预览、下载 HTML 和 GameSpec JSON。生成语言跟随界面语言。

### CLI

```powershell
# 生成一个中文游戏
npm run generate -- --theme "算命游戏" --lang zh

# 看排序候选
npm run generate -- --theme "computer virus" --list

# 批量生成 top 3
npm run generate -- --theme "电脑病毒清理游戏" --count 3 --out-dir examples/batch
```

`--lang` 接受 `en` 或 `zh`，默认 `en`。

### 重新构建在线站点 / Rebuild the live site

```powershell
npm run build:site   # 把生成器核心 + 套件数据打包进 docs/
```

`docs/` 就是 GitHub Pages 部署目录，构建后本地直接打开 `docs/index.html` 也能跑。

## 校验 / Validate

```powershell
npm run validate
npm run audit
```

`validate` 校验单个游戏结构与 spec 一致性；`audit` 从零重新生成全部套件样例并跑 25 项检查（含 i18n 守卫：模板无 CJK 残留、`html lang` 与 `spec.lang` 一致、陌生主题不退回 coffee/cafe 命名）。

## 玩法套件 / Current Play Kits

`horde-survival` · `runner-lane` · `case-deduction` · `tower-defense` · `deck-builder` · `match-puzzle` · `physics-arc` · `rhythm-tap` · `platform-climb` · `idle-automation` · `grid-tactics` · `merge-drop` · `tile-match` · `brick-breaker` · `flappy-gap`

## 已知边界 / Known boundary

`case-deduction` 的案件正文目前仍是固定英文样例，UI 已本地化，但案情内容尚未随主题/语言生成。自动校验能证明"能生成、能打开、语言一致、结构有效"，**不能证明一定好玩** —— 数值与手感仍需真人试玩调参。

`case-deduction` clue fiction is still a fixed English sample set (its UI chrome is localized). Automated checks prove a game generates, opens, and is structurally valid — they do **not** prove it's fun. Tuning still needs human playtesting.

## License

MIT —— 见 [LICENSE](LICENSE)。随便用、改、商用。
