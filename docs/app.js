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
      what: "它是什么：不是「AI 现写代码」，而是 11 套手工打磨的玩法模板 + 你的主题词，从 8640 个组合里挑最契合的一个，换皮换文案换节奏。玩法本体是验证过「能玩」的代码。",
      placeholder: "输入任意词，比如：深海考古",
      chips: ["电脑病毒", "赛车", "末日塔防", "算命", "音乐节奏", "宝石消除", "病毒围堵", "弹射救援", "商业谈判", "爬塔跳跃", "工厂自动化"]
    },
    en: {
      h1: "Type a word,<br>get a playable game in seconds",
      sub: "Computer virus, fortune telling, tower defense, match puzzle… any theme, a playable browser game in seconds.",
      honest: "Generation runs 100% in your browser. No backend, nothing uploaded.",
      go: "Generate", random: "🎲 Random", tryLabel: "Try these (each is a different genre):",
      fullscreen: "⛶ Fullscreen", download: "⬇ Download HTML", again: "↻ Switch genre",
      copyLink: "🔗 Copy link", copied: "✓ Link copied",
      playHint: "Play right above by touch; \"Switch genre\" jumps to a completely different game type.",
      what: "What it is: not \"AI writes code\" — it's 11 hand-built play templates + your theme, picking the best fit out of 8640 combos and reskinning title, copy, and pacing. The gameplay itself is validated, playable code.",
      placeholder: "Type anything, e.g. deep-sea archaeology",
      chips: ["computer virus", "street racing", "tower defense", "fortune telling", "music rhythm", "gem match", "containment grid", "slingshot rescue", "business negotiation", "platform climb", "factory automation"]
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
