"use strict";
// Toy Game Generator — pure core.
// No fs / no DOM. Runs identically in Node (CLI, audit) and in the browser (live site).
// Callers pass in `catalogs` (kits + strings) and `templates` (id -> template text);
// the core does ranking, GameSpec construction, and HTML rendering.

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ToyGameCore = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const DIFFICULTIES = ["mellow", "standard", "espresso"];
  const MECHANIC_VARIANTS = [
    [],
    ["combo-streak"],
    ["risk-reward"],
    ["combo-streak", "risk-reward"]
  ];

  // ---- High-level entry points -------------------------------------------------

  // catalogs: { playKits, styleKits, mechanicKits, enemyKits, mappings, strings: { en, zh } }
  // templates: { "<file>": "<template text>" }
  // options: { lang, filters, badgeUrl }
  function generateGame(catalogs, templates, theme, options) {
    options = options || {};
    const lang = options.lang === "zh" ? "zh" : "en";
    const ranked = rankCandidates(catalogs, theme);
    const candidates = filterCandidates(ranked, options.filters || {});
    if (!candidates.length) throw new Error("No candidate matches the requested overrides.");
    const candidate = candidates[0];
    const spec = buildSpec(candidate, theme, lang, catalogs);
    const templateText = templates[candidate.playKit.template];
    if (templateText == null) throw new Error("Missing template: " + candidate.playKit.template);
    const html = renderGameHtml(candidate, spec, templateText, { badgeUrl: options.badgeUrl });
    return { candidate, spec, html };
  }

  function rankCandidates(catalogs, theme) {
    const mapping = inferMapping(catalogs.mappings, theme, catalogs.playKits);
    const themeWords = tokenize(theme);
    const candidates = [];
    const seen = new Set();

    for (const playKit of catalogs.playKits) {
      for (const styleKit of catalogs.styleKits) {
        for (const enemyKit of catalogs.enemyKits) {
          for (const difficulty of DIFFICULTIES) {
            for (const extraMechanics of MECHANIC_VARIANTS) {
              const mechanics = unique([...(playKit.requiredMechanics || []), ...extraMechanics])
                .filter(id => catalogs.mechanicKits.some(item => item.id === id));
              const signature = [playKit.id, styleKit.id, enemyKit.id, difficulty, mechanics.join("+")].join("|");
              if (seen.has(signature)) continue;
              seen.add(signature);
              const score = scoreCandidate({ playKit, styleKit, enemyKit, difficulty, mechanics, mapping, themeWords });
              candidates.push({ playKit, styleKit, enemyKit, difficulty, mechanics, mapping, score });
            }
          }
        }
      }
    }

    candidates.sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta) return scoreDelta;
      return themedTieBreak(theme, a) - themedTieBreak(theme, b);
    });
    return candidates;
  }

  function filterCandidates(candidates, filters) {
    filters = filters || {};
    let filtered = candidates;
    if (filters.playKit) filtered = filtered.filter(item => item.playKit.id === filters.playKit);
    if (filters.styleKit) filtered = filtered.filter(item => item.styleKit.id === filters.styleKit);
    if (filters.enemySet) filtered = filtered.filter(item => item.enemyKit.id === filters.enemySet);
    if (filters.difficulty) filtered = filtered.filter(item => item.difficulty === filters.difficulty);
    return filtered;
  }

  function buildSpec(candidate, theme, lang, catalogs) {
    const tuning = tuningFor(candidate.difficulty, candidate.playKit.id);
    const title = titleFor(theme, candidate, lang);
    const baseId = slugify(title);
    const mechanicSlug = candidate.mechanics.length ? candidate.mechanics.map(slugify).join("-") : "base";
    const suffix = [candidate.playKit.id, candidate.styleKit.id, candidate.enemyKit.id, candidate.difficulty, mechanicSlug]
      .map(slugify)
      .join("-");
    const rawId = slugify(baseId + "-" + suffix);
    return {
      version: "0.1",
      id: compactId(rawId),
      title,
      theme,
      lang,
      strings: stringsFor(candidate, lang, catalogs),
      maturityLevel: candidate.mapping.maturityLevel || "arcade",
      coreExperience: candidate.mapping.coreExperience || "score under pressure with readable risk and reward",
      playKit: candidate.playKit.id,
      styleKit: candidate.styleKit.id,
      mechanics: candidate.mechanics.length ? candidate.mechanics : candidate.playKit.requiredMechanics,
      enemySet: [candidate.enemyKit.id],
      enemyTypes: candidate.enemyKit.types,
      palette: candidate.styleKit.colors,
      roles: rolesFor(theme, candidate, lang),
      duration: tuning.duration,
      difficulty: candidate.difficulty,
      tuning: {
        speed: tuning.speed,
        spawnRate: tuning.spawnRate,
        scoreMultiplier: tuning.scoreMultiplier
      }
    };
  }

  function renderGameHtml(candidate, spec, templateText, options) {
    options = options || {};
    let html = renderTemplate(templateText, {
      TITLE: escapeHtml(spec.title),
      BACKGROUND_A: spec.palette.backgroundA,
      INK: spec.palette.ink,
      ID: spec.id,
      STYLE_KIT: candidate.styleKit.id,
      MECHANICS: spec.mechanics.join(","),
      ENEMY_SET: spec.enemySet.join(","),
      LANG: spec.lang,
      SPEC_JSON: safeJson(spec)
    });
    if (options.badgeUrl) {
      html = injectBadge(html, options.badgeUrl, spec.lang);
    }
    return html;
  }

  // ---- Back-link badge ---------------------------------------------------------

  function badgeText(lang) {
    return lang === "zh" ? "做一个你的 →" : "Make your own →";
  }

  function injectBadge(html, url, lang) {
    const safeUrl = escapeHtml(url);
    const text = escapeHtml(badgeText(lang));
    const badge = '<a href="' + safeUrl + '" target="_blank" rel="noopener" ' +
      'style="position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:9;' +
      'font:600 12px/1 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#fff;' +
      'background:rgba(0,0,0,.42);padding:7px 12px;border-radius:999px;text-decoration:none;' +
      'opacity:.78;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)">' + text + '</a>';
    if (html.includes("</body>")) return html.replace("</body>", badge + "\n</body>");
    return html + badge;
  }

  // ---- Spec building helpers (verbatim from the original generator) -------------

  function inferMapping(mappings, theme, playKits) {
    const scored = mappings.map(mapping => {
      const score = (mapping.keywords || []).reduce((sum, keyword) => {
        return sum + (includesLoose(theme, keyword) ? 1 : 0);
      }, 0);
      return { mapping, score };
    }).sort((a, b) => b.score - a.score);

    if (scored[0] && scored[0].score > 0) return scored[0].mapping;

    // No keyword match: spread unfamiliar themes across play kits by theme hash so
    // they don't all collapse to horde-survival. case-deduction is excluded from the
    // fallback because its clue fiction is fixed English regardless of theme.
    const eligible = (playKits || [])
      .map(k => k.id)
      .filter(id => id !== "case-deduction");
    const fallbackKit = eligible.length
      ? eligible[hashNumber(theme) % eligible.length]
      : "horde-survival";

    return {
      keywords: [],
      roles: {
        player: compactTheme(theme) + " hero",
        objective: "score as high as possible",
        threat: "pressure hazards",
        reward: "bright pickups",
        special: "burst bonus",
        environment: "arcade arena"
      },
      preferredPlayKits: [fallbackKit],
      preferredStyleKits: ["pixel-neon"],
      preferredEnemySets: ["glitch-pack"],
      maturityLevel: "casual",
      coreExperience: "turn a vague pressure into a readable arcade score loop"
    };
  }

  function scoreCandidate({ playKit, styleKit, enemyKit, difficulty, mechanics, mapping, themeWords }) {
    let score = (playKit.baseScore || 0) + (styleKit.baseScore || 0) + (enemyKit.baseScore || 0);
    score += overlapScore(playKit.bestFor, themeWords) * 3;
    score += overlapScore(styleKit.bestFor, themeWords) * 3;
    score += overlapScore(enemyKit.bestFor, themeWords) * 3;
    if ((mapping.preferredPlayKits || []).includes(playKit.id)) score += 25;
    if ((mapping.preferredStyleKits || []).includes(styleKit.id)) score += 18;
    if ((mapping.preferredEnemySets || []).includes(enemyKit.id)) score += 18;
    if (mapping.maturityLevel === "premium") {
      if (["occult-archive", "noir-ledger", "clinical-ritual"].includes(styleKit.id)) score += 8;
      if (styleKit.id === "toy-diorama") score -= 12;
      if (playKit.id === "case-deduction") score += 6;
    }
    if (difficulty === "standard") score += 4;
    if (difficulty === "mellow") score += 1;
    if (mechanics.includes("combo-streak")) score += 3;
    if (mechanics.includes("risk-reward") && playKit.id === "runner-lane") score += 4;
    return score;
  }

  function tuningFor(difficulty, playKitId) {
    const base = {
      mellow: { duration: 75, speed: 0.86, spawnRate: 0.82, scoreMultiplier: 1 },
      standard: { duration: 60, speed: 1, spawnRate: 1, scoreMultiplier: 1 },
      espresso: { duration: 60, speed: 1.18, spawnRate: 1.28, scoreMultiplier: 1.25 }
    }[difficulty];
    const runnerBoost = playKitId === "runner-lane" ? 1.08 : 1;
    const duration = playKitId === "case-deduction" ? Math.max(base.duration, difficulty === "espresso" ? 65 : 75) : base.duration;
    return { ...base, duration, speed: round(base.speed * runnerBoost) };
  }

  // Title patterns give each game a real "game name" feel and vary across kits.
  // EN patterns MUST start with "{t}" so theme-prefix checks keep holding.
  const TITLE_PATTERNS = {
    en: {
      "horde-survival": ["{t} Rush", "{t} Survivors", "{t} Onslaught"],
      "runner-lane": ["{t} Racer", "{t} Rush Hour", "{t} Overdrive"],
      "case-deduction": ["{t} Case Files", "{t} Mystery", "{t} Cold Case"],
      "tower-defense": ["{t} Defense", "{t} Siege", "{t} Last Stand"],
      "deck-builder": ["{t} Decks", "{t} Card Battle", "{t} Showdown"],
      "match-puzzle": ["{t} Match", "{t} Crush", "{t} Combo"],
      "physics-arc": ["{t} Slingshot", "{t} Arc", "{t} Trick Shot"],
      "rhythm-tap": ["{t} Beat", "{t} Rhythm", "{t} Tap Tap"],
      "platform-climb": ["{t} Climb", "{t} Jumper", "{t} Ascent"],
      "idle-automation": ["{t} Tycoon", "{t} Factory", "{t} Idle"],
      "grid-tactics": ["{t} Tactics", "{t} Containment", "{t} Grid"],
      "merge-drop": ["{t} Merge", "{t} 2048", "{t} Fusion"],
      "tile-match": ["{t} Triple", "{t} Tiles", "{t} Match 3"],
      "brick-breaker": ["{t} Breaker", "{t} Bricks", "{t} Smash"],
      "flappy-gap": ["{t} Flap", "{t} Wings", "{t} Sky Dash"],
      "merge-defense": ["{t} Defenders", "{t} Stand", "{t} Frontline"]
    },
    zh: {
      "horde-survival": ["{t}大作战", "{t}突围战", "勇闯{t}"],
      "runner-lane": ["{t}飙车", "极速{t}", "{t}狂飙"],
      "case-deduction": ["{t}疑案", "{t}推理社", "{t}悬案"],
      "tower-defense": ["{t}保卫战", "死守{t}", "{t}塔防"],
      "deck-builder": ["{t}牌局", "{t}卡牌对决", "{t}牌战"],
      "match-puzzle": ["{t}消消乐", "开心{t}", "{t}连消"],
      "physics-arc": ["{t}弹弓", "{t}弹射", "百发百中{t}"],
      "rhythm-tap": ["{t}音游", "跟着{t}打拍", "{t}节奏"],
      "platform-climb": ["{t}跳跳乐", "勇攀{t}", "{t}爬塔"],
      "idle-automation": ["{t}大亨", "{t}工厂", "{t}养成记"],
      "grid-tactics": ["{t}围堵战", "包围{t}", "{t}棋局"],
      "merge-drop": ["合成{t}", "{t}消消大", "{t}合体"],
      "tile-match": ["{t}叠叠消", "{t}三消", "消消{t}"],
      "brick-breaker": ["{t}打砖块", "敲碎{t}", "{t}弹球"],
      "flappy-gap": ["{t}一键飞", "飞跃{t}", "{t}冲刺"],
      "merge-defense": ["{t}守卫战", "{t}保卫战", "{t}合体大战"]
    }
  };
  function titleFor(theme, candidate, lang) {
    const t = titlePrefix(theme);
    const table = TITLE_PATTERNS[lang === "zh" ? "zh" : "en"];
    const pats = table[candidate.playKit.id] || [lang === "zh" ? "{t} " + titleSuffixFor(candidate.playKit.id, lang) : "{t} " + titleSuffixFor(candidate.playKit.id, lang)];
    const idx = hashNumber(theme + "|" + candidate.playKit.id) % pats.length;
    return pats[idx].replace("{t}", t);
  }

  function titleSuffixFor(playKitId, lang) {
    const en = {
      "horde-survival": "Rush",
      "runner-lane": "Run",
      "case-deduction": "Case",
      "tower-defense": "Defense",
      "deck-builder": "Deck",
      "match-puzzle": "Match",
      "physics-arc": "Arc",
      "rhythm-tap": "Beat",
      "platform-climb": "Climb",
      "idle-automation": "Loop",
      "grid-tactics": "Grid",
      "merge-drop": "Merge",
      "tile-match": "Tiles",
      "brick-breaker": "Bricks",
      "flappy-gap": "Flap",
      "merge-defense": "Defense"
    };
    const zh = {
      "horde-survival": "突围",
      "runner-lane": "疾驰",
      "case-deduction": "档案",
      "tower-defense": "防线",
      "deck-builder": "卡组",
      "match-puzzle": "连消",
      "physics-arc": "弹道",
      "rhythm-tap": "节拍",
      "platform-climb": "攀登",
      "idle-automation": "循环",
      "grid-tactics": "棋局",
      "merge-drop": "合成",
      "tile-match": "三消",
      "brick-breaker": "弹球",
      "flappy-gap": "起飞",
      "merge-defense": "塔防"
    };
    const table = lang === "zh" ? zh : en;
    return table[playKitId] || (lang === "zh" ? "游戏" : "Game");
  }

  function titlePrefix(theme) {
    const words = compactTheme(theme).match(/[a-z0-9]+|[一-鿿]+/gi) || [];
    if (!words.length) return "Arcade";
    const hasAscii = words.some(word => /^[a-z0-9]+$/i.test(word));
    const picked = hasAscii ? words.filter(word => /^[a-z0-9]+$/i.test(word)).slice(0, 2) : words.slice(0, 1);
    return hasAscii ? titleCase(picked.join(" ")) : picked.join("");
  }

  function rolesFor(theme, candidate, lang) {
    const topic = roleTopic(theme);
    const lowerTopic = topic.toLowerCase();
    const en = {
      "horde-survival": ["operator", "survive the " + lowerTopic + " surge", "swarming pressure", "momentum pickups", "upgrade burst", "pressure arena"],
      "runner-lane": ["driver", "thread through " + lowerTopic + " lanes", "lane hazards", "boost windows", "nitro break", "fast corridor"],
      "case-deduction": ["reader", "interpret " + lowerTopic + " signals", "ambiguous evidence", "confirmed pattern", "certainty lock", "quiet archive"],
      "tower-defense": ["warden", "protect the " + lowerTopic + " route", "wave pressure", "earned build nodes", "upgrade volley", "defense map"],
      "deck-builder": ["negotiator", "play the best " + lowerTopic + " hand", "turn pressure", "combo value", "energy swing", "decision table"],
      "match-puzzle": ["cleaner", "clear " + lowerTopic + " clusters", "board clutter", "chain bonus", "board sweep", "puzzle tray"],
      "physics-arc": ["launcher", "land precise " + lowerTopic + " shots", "blocking walls", "rescued targets", "perfect arc", "target range"],
      "rhythm-tap": ["conductor", "hit the " + lowerTopic + " beat", "miss pressure", "streak value", "perfect timing", "rhythm lane"],
      "platform-climb": ["climber", "rise through " + lowerTopic + " platforms", "bad landings", "height score", "recovery jump", "vertical field"],
      "idle-automation": ["planner", "grow the " + lowerTopic + " loop", "bottlenecks", "cash flow", "upgrade cycle", "production line"],
      "grid-tactics": ["tactician", "contain the " + lowerTopic + " grid", "moving threats", "locked cells", "area control", "tactical board"],
      "merge-drop": ["merger", "merge the " + lowerTopic + " stack", "rising clutter", "chain merges", "big-number burst", "drop board"],
      "tile-match": ["sorter", "clear the " + lowerTopic + " tiles in threes", "a filling tray", "triple clears", "tray combo", "tile heap"],
      "brick-breaker": ["paddler", "break the " + lowerTopic + " wall", "a falling ball", "combo breaks", "clear bonus", "brick field"],
      "flappy-gap": ["flyer", "fly the " + lowerTopic + " gauntlet", "tight pipes", "clean passes", "near miss", "scrolling sky"],
      "merge-defense": ["commander", "place and merge units to hold the " + lowerTopic + " lanes", "advancing waves", "stronger merges", "high-level fusion", "sunny field"]
    };
    const zh = {
      "horde-survival": ["操作员", "顶住" + topic + "涌潮", "围压", "动能补给", "升级爆发", "压力场"],
      "runner-lane": ["车手", "穿过" + topic + "车道", "路障", "加速窗口", "氮气突破", "高速走廊"],
      "case-deduction": ["解读者", "解读" + topic + "信号", "模糊证据", "确认模式", "确信锁定", "静默档案室"],
      "tower-defense": ["守卫", "守住" + topic + "路线", "波次压力", "建造节点", "升级齐射", "防守地图"],
      "deck-builder": ["牌手", "打出最佳" + topic + "手牌", "回合压力", "连携价值", "能量反转", "决策桌"],
      "match-puzzle": ["清理员", "清除" + topic + "集群", "棋盘杂讯", "连锁奖励", "棋盘扫除", "拼图托盘"],
      "physics-arc": ["发射员", "命中精准" + topic + "目标", "阻挡墙", "救援目标", "完美弹道", "目标靶场"],
      "rhythm-tap": ["指挥者", "踩准" + topic + "节拍", "漏拍压力", "连击价值", "完美时机", "节奏轨道"],
      "platform-climb": ["攀登者", "穿越" + topic + "平台上升", "落脚风险", "高度分数", "恢复跳跃", "垂直场"],
      "idle-automation": ["规划师", "扩大" + topic + "循环", "瓶颈", "现金流", "升级周期", "生产线"],
      "grid-tactics": ["战术员", "控制" + topic + "棋局", "移动威胁", "锁定格", "区域控制", "战术棋盘"],
      "merge-drop": ["合成师", "合并" + topic + "方块", "堆叠压力", "连锁合并", "爆数时刻", "掉落台"],
      "tile-match": ["理牌人", "三连消掉" + topic + "牌", "渐满的卡槽", "三连消除", "清槽连击", "牌堆"],
      "brick-breaker": ["挡板手", "击碎" + topic + "砖墙", "下坠的球", "连击破砖", "通关奖励", "砖场"],
      "flappy-gap": ["飞行者", "穿过" + topic + "缝隙", "逼仄管道", "干净通过", "擦身而过", "卷动天空"],
      "merge-defense": ["指挥官", "合并单位守住" + topic + "防线", "逼近的波次", "更强的合体", "高级融合", "阳光防线"]
    };
    const templates = lang === "zh" ? zh : en;
    const values = templates[candidate.playKit.id] || templates["horde-survival"];
    return {
      player: topic + " " + values[0],
      objective: values[1],
      threat: values[2],
      reward: values[3],
      special: values[4],
      environment: values[5]
    };
  }

  function roleTopic(theme) {
    const words = compactTheme(theme).match(/[a-z0-9]+|[一-鿿]+/gi) || ["arcade"];
    const ascii = words.filter(word => /^[a-z0-9]+$/i.test(word)).slice(0, 3);
    return ascii.length ? ascii.join(" ") : words.slice(0, 1).join("");
  }

  function stringsFor(candidate, lang, catalogs) {
    const table = catalogs.strings[lang] || catalogs.strings.en;
    return deepMerge(table.common || {}, table[candidate.playKit.id] || {});
  }

  // ---- Generic helpers ---------------------------------------------------------

  function renderTemplate(template, values) {
    let out = template;
    for (const [key, value] of Object.entries(values)) {
      out = out.split("{{" + key + "}}").join(String(value));
    }
    return out;
  }

  function tokenize(input) {
    const lower = String(input || "").toLowerCase();
    const words = lower.match(/[a-z0-9]+|[一-鿿]+/g) || [];
    return new Set(words);
  }

  function overlapScore(items, themeWords) {
    return (items || []).reduce((sum, item) => sum + (hasLooseToken(themeWords, item) ? 1 : 0), 0);
  }

  function hasLooseToken(themeWords, item) {
    const key = String(item || "").toLowerCase();
    for (const word of themeWords) {
      if (word.includes(key) || key.includes(word)) return true;
    }
    return false;
  }

  function includesLoose(input, needle) {
    return String(input || "").toLowerCase().includes(String(needle || "").toLowerCase());
  }

  function compactTheme(input) {
    return String(input || "arcade").trim().replace(/\s+/g, " ");
  }

  function slugify(input) {
    const ascii = String(input || "game").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (ascii) return ascii;
    let hash = 0;
    for (const ch of String(input)) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
    return "game-" + Math.abs(hash).toString(36);
  }

  function compactId(input) {
    const value = slugify(input);
    if (value.length <= 96) return value;
    return value.slice(0, 78).replace(/-+$/g, "") + "-" + shortHash(value);
  }

  function shortHash(input) {
    let hash = 2166136261;
    for (const ch of String(input)) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function deepMerge(base, override) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const [key, value] of Object.entries(override || {})) {
      if (value && typeof value === "object" && !Array.isArray(value) && out[key] && typeof out[key] === "object" && !Array.isArray(out[key])) {
        out[key] = deepMerge(out[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  function themedTieBreak(theme, candidate) {
    return hashNumber(theme + "|" + candidate.playKit.id + "|" + candidate.styleKit.id + "|" + candidate.enemyKit.id + "|" + candidate.difficulty + "|" + candidate.mechanics.join("+"));
  }

  function hashNumber(input) {
    let hash = 2166136261;
    for (const ch of String(input)) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function titleCase(input) {
    return input.replace(/\b[a-z]/g, ch => ch.toUpperCase());
  }

  function escapeHtml(input) {
    return String(input).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
  }

  function safeJson(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  return {
    DIFFICULTIES,
    MECHANIC_VARIANTS,
    generateGame,
    rankCandidates,
    filterCandidates,
    buildSpec,
    renderGameHtml,
    renderTemplate,
    badgeText,
    slugify
  };
});
