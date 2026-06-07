"use strict";
(function () {
  var DATA = window.TGG_DATA;
  var core = window.ToyGameCore;
  if (!DATA || !core) { console.error("Missing TGG_DATA or ToyGameCore"); return; }

  // Site root — baked into downloaded/shared games as the "make your own" back-link.
  var SITE = location.href.split(/[?#]/)[0].replace(/index\.html$/, "");

  var I18N = {
    zh: {
      h1: "输入一个词，<br>秒生成一个能玩的小游戏",
      sub: "电脑病毒、算命、塔防、消除…… 任意主题，几秒出一个点开就能玩的网页小游戏。",
      honest: "生成逻辑 100% 跑在你的浏览器里，无后端、不上传任何东西。",
      go: "生成游戏", random: "🎲 随机一个", tryLabel: "试试这些（每个都是不同玩法）：",
      fullscreen: "⛶ 全屏试玩", download: "⬇ 下载 HTML", again: "↻ 换个玩法",
      copyLink: "🔗 复制链接", copied: "✓ 链接已复制",
      playHint: "手机端直接在上方触屏游玩；「换个玩法」会切到完全不同的游戏类型。",
      what: "它是什么：不是「AI 现写代码」，而是 16 套手工打磨的玩法模板 + 你的主题词，从 12960 个组合里挑最契合的一个，换皮换文案换节奏。玩法本体是验证过「能玩」的代码。",
      placeholder: "输入任意词，比如：深海考古",
      chips: ["合成塔防", "合成大西瓜", "羊了个羊", "打砖块", "flappy 一键飞", "电脑病毒", "赛车", "末日塔防", "算命", "音乐节奏", "宝石消除", "弹射救援", "商业谈判"]
    },
    en: {
      h1: "Type a word,<br>get a playable game in seconds",
      sub: "Computer virus, fortune telling, tower defense, match puzzle… any theme, a playable browser game in seconds.",
      honest: "Generation runs 100% in your browser. No backend, nothing uploaded.",
      go: "Generate", random: "🎲 Random", tryLabel: "Try these (each is a different genre):",
      fullscreen: "⛶ Fullscreen", download: "⬇ Download HTML", again: "↻ Switch genre",
      copyLink: "🔗 Copy link", copied: "✓ Link copied",
      playHint: "Play right above by touch; \"Switch genre\" jumps to a completely different game type.",
      what: "What it is: not \"AI writes code\" — it's 16 hand-built play templates + your theme, picking the best fit out of 12960 combos and reskinning title, copy, and pacing. The gameplay itself is validated, playable code.",
      placeholder: "Type anything, e.g. deep-sea archaeology",
      chips: ["merge defense", "watermelon merge", "sheep stack", "brick breaker", "flappy bird", "computer virus", "street racing", "tower defense", "fortune telling", "music rhythm", "gem match", "slingshot rescue", "business negotiation"]
    }
  };

  var HOWTO = {
    zh: {
      "horde-survival": "手指拖动走位躲怪，会自动开火；升级时三选一变强，活到时间结束。",
      "runner-lane": "手指左右控制赛车，躲对手车、吃金币和氮气，贴身超车有连击加分。",
      "case-deduction": "把左侧证据拖进中间档案，再点右侧最可能的解读；信任耗尽前判对得分。",
      "tower-defense": "点路上的空位放炮塔（再点可升级），拦住一波波敌人别让它们冲过终点。",
      "deck-builder": "点卡牌出牌：攻击削减对方压力、护盾挡伤、能量回能；点上方空白处结束回合。",
      "match-puzzle": "点相邻同色 2 个以上的方块成片消除，越大片分越高，限时刷分。",
      "physics-arc": "从发射器往后拖再松手，按预览弧线把球打中目标，子弹数量有限。",
      "rhythm-tap": "音符落到下方判定线时，点它所在的轨道，越准分越高，别漏拍。",
      "platform-climb": "手指左右移动，点击屏幕跳跃，踩着平台往上爬，别踩红色危险块、别掉下去。",
      "idle-automation": "点工作站升级提升产能；变红是瓶颈，点它清理恢复生产；攒现金滚雪球。",
      "grid-tactics": "每点一下走一格或封一格，把不断逼近的敌人围堵住，别让它们碰到你。",
      "merge-drop": "点某一列把数字块落下，相同数字叠在一起会合并翻倍，尽量合出更大的数。",
      "tile-match": "点最上层的牌收进底部卡槽，凑齐 3 张相同自动消除；卡槽放满 7 个就输。",
      "brick-breaker": "手指左右移动挡板接住球，把上方砖块全部打碎，别让球掉下去。",
      "flappy-gap": "不停点击让它往上飞，穿过一个个管道缝隙，碰到管道或落地就结束。",
      "merge-defense": "点空格子花金币放炮台；把两个同等级炮台拖到一起合并升级，越高级越强；别让怪冲到底线。"
    },
    en: {
      "horde-survival": "Drag to move and dodge; you auto-fire. Pick one upgrade on level-up. Survive.",
      "runner-lane": "Steer left/right, dodge rival cars, grab coins & nitro; near-miss for combo.",
      "case-deduction": "Drag clues into the ledger, then pick the likeliest reading before trust runs out.",
      "tower-defense": "Tap empty nodes to build towers (tap again to upgrade); stop every wave.",
      "deck-builder": "Tap cards to play (attack / shield / energy); tap the top to end the turn.",
      "match-puzzle": "Tap groups of 2+ same-color tiles to clear; bigger groups score more.",
      "physics-arc": "Drag back from the launcher and release to arc the ball into targets.",
      "rhythm-tap": "Tap the note's lane as it reaches the line. Stay on beat, don't miss.",
      "platform-climb": "Move with your finger, tap to jump; climb up, avoid red blocks and gaps.",
      "idle-automation": "Tap stations to upgrade; tap red bottlenecks to clear; snowball your cash.",
      "grid-tactics": "Each tap moves or seals one tile; contain the closing enemies.",
      "merge-drop": "Tap a column to drop a number; equal numbers stack and merge, doubling up.",
      "tile-match": "Tap top tiles into the tray; three of a kind clears; 7 in the tray and you lose.",
      "brick-breaker": "Move the paddle to bounce the ball and break every brick.",
      "flappy-gap": "Tap to fly up through the pipe gaps without crashing.",
      "merge-defense": "Tap empty tiles to place a unit (costs coins); drag two same-level units together to merge and upgrade; stop enemies before they reach the bottom."
    }
  };

  var lang = "zh";
  var lastTheme = "", lastKit = "", lastHtml = "", lastSpec = null;
  var distinctList = [], distinctIdx = 0, distinctTheme = "";

  var $ = function (id) { return document.getElementById(id); };
  var form = $("form"), themeInput = $("theme"), result = $("result");
  var frame = $("frame"), gameTitle = $("gameTitle"), gameKit = $("gameKit"), chips = $("chips");

  function applyLang() {
    var t = I18N[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (t[key] != null) el.innerHTML = t[key];
    });
    themeInput.placeholder = t.placeholder;
    $("lang-zh").classList.toggle("on", lang === "zh");
    $("lang-en").classList.toggle("on", lang === "en");
    renderChips();
  }

  function renderChips() {
    chips.querySelectorAll(".chip").forEach(function (c) { c.remove(); });
    I18N[lang].chips.forEach(function (theme) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = theme;
      b.addEventListener("click", function () { themeInput.value = theme; generate(theme); });
      chips.appendChild(b);
    });
  }

  // One best candidate per distinct play kit, in ranked order — so "switch genre"
  // walks through genuinely different gameplay instead of reskins of the same kit.
  function rankDistinct(theme) {
    var ranked = core.rankCandidates(DATA.catalogs, theme);
    var seen = {}, out = [];
    for (var i = 0; i < ranked.length; i++) {
      var k = ranked[i].playKit.id;
      if (!seen[k]) { seen[k] = 1; out.push(ranked[i]); }
    }
    return out;
  }

  function show(candidate, theme) {
    var spec = core.buildSpec(candidate, theme, lang, DATA.catalogs);
    var html = core.renderGameHtml(candidate, spec, DATA.templates[candidate.playKit.template], { badgeUrl: SITE });
    lastHtml = html; lastSpec = spec; lastKit = candidate.playKit.id; lastTheme = theme;
    gameTitle.textContent = spec.title;
    gameKit.textContent = spec.playKit;
    $("howto").textContent = (HOWTO[lang] && HOWTO[lang][candidate.playKit.id]) || "";
    frame.srcdoc = html;
    result.hidden = false;
    try { history.replaceState(null, "", gameHash(theme, lastKit, lang)); } catch (e) {}
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Shareable deep link: #t=<theme>&k=<playKit>&l=<lang> opens that exact game.
  function gameHash(theme, kit, lng) {
    return "#t=" + encodeURIComponent(theme) + "&k=" + encodeURIComponent(kit) + "&l=" + lng;
  }
  function fromHash() {
    var h = location.hash.replace(/^#/, "");
    if (!h) return null;
    var p = {};
    h.split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
    return p.t ? { theme: p.t, kit: p.k, lang: p.l } : null;
  }
  // Generate a theme but prefer a specific play kit (used by deep links).
  function showByKit(theme, kit) {
    distinctList = rankDistinct(theme);
    distinctTheme = theme;
    distinctIdx = 0;
    for (var i = 0; i < distinctList.length; i++) {
      if (distinctList[i].playKit.id === kit) { distinctIdx = i; break; }
    }
    show(distinctList[distinctIdx], theme);
  }

  function generate(theme) {
    theme = (theme || "").trim();
    if (!theme) { themeInput.focus(); return; }
    distinctList = rankDistinct(theme);
    distinctTheme = theme;
    distinctIdx = 0;
    show(distinctList[0], theme);
  }

  // "Switch genre": same theme, next distinct play kit.
  function switchGenre() {
    var theme = lastTheme || themeInput.value.trim();
    if (!theme) { themeInput.focus(); return; }
    if (distinctTheme !== theme || !distinctList.length) {
      distinctList = rankDistinct(theme); distinctTheme = theme; distinctIdx = 0;
    } else {
      distinctIdx = (distinctIdx + 1) % distinctList.length;
    }
    show(distinctList[distinctIdx], theme);
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); generate(themeInput.value); });
  $("again").addEventListener("click", switchGenre);

  $("random").addEventListener("click", function () {
    var prevKit = lastKit;
    var pool = I18N[lang].chips;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    themeInput.value = pick;
    generate(pick);
    if (lastKit === prevKit && distinctList.length > 1) switchGenre(); // avoid repeating previous genre
  });

  $("fullscreen").addEventListener("click", function () {
    var el = frame;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
  });

  $("download").addEventListener("click", function () {
    if (!lastHtml) return;
    var blob = new Blob([lastHtml], { type: "text/html;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (lastSpec && lastSpec.id ? lastSpec.id : "toy-game") + ".html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  });

  $("copylink").addEventListener("click", function () {
    if (!lastTheme) return;
    var url = location.href.split("#")[0] + gameHash(lastTheme, lastKit, lang);
    var btn = $("copylink");
    var done = function () { btn.textContent = I18N[lang].copied; setTimeout(function () { btn.textContent = I18N[lang].copyLink; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () { window.prompt("", url); });
    } else { window.prompt("", url); }
  });

  $("lang-zh").addEventListener("click", function () { setLang("zh"); });
  $("lang-en").addEventListener("click", function () { setLang("en"); });

  function setLang(next) {
    if (lang === next) return;
    lang = next;
    applyLang();
    if (!result.hidden && lastTheme) { distinctList = []; generate(lastTheme); } // re-render in new language
  }

  (function init() {
    var hp = fromHash();
    if (hp && (hp.lang === "en" || hp.lang === "zh")) lang = hp.lang;
    applyLang();
    if (hp && hp.theme) { themeInput.value = hp.theme; showByKit(hp.theme, hp.kit); }
  })();
})();
