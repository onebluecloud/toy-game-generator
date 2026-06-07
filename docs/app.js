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
      sub: "深海考古、算命、电脑病毒、退休规划…… 任意主题，几秒出一个点开就能玩的网页小游戏。",
      honest: "生成逻辑 100% 跑在你的浏览器里，无后端、不上传任何东西。",
      go: "生成游戏", random: "🎲 随机一个", tryLabel: "试试这些：",
      fullscreen: "⛶ 全屏试玩", download: "⬇ 下载 HTML", again: "↻ 换一个",
      playHint: "手机端直接在上方触屏游玩；点「全屏试玩」更过瘾。",
      what: "它是什么：不是「AI 现写代码」，而是 11 个手工打磨的玩法模板 + 你的主题词，从 8640 个组合里挑最契合的一个，换皮换文案换节奏。玩法本体是验证过「能玩」的代码。",
      placeholder: "输入任意词，比如：深海考古",
      empty: "先输入一个词吧～",
      chips: ["深海考古", "算命", "电脑病毒", "退休规划", "摸鱼", "赛车", "咖啡店", "考研倒计时"]
    },
    en: {
      h1: "Type a word,<br>get a playable game in seconds",
      sub: "Deep-sea archaeology, fortune telling, computer virus, retirement planning… any theme, a playable browser game in seconds.",
      honest: "Generation runs 100% in your browser. No backend, nothing uploaded.",
      go: "Generate", random: "🎲 Random", tryLabel: "Try one:",
      fullscreen: "⛶ Fullscreen", download: "⬇ Download HTML", again: "↻ Another",
      playHint: "Play right above by touch; tap Fullscreen for the full thing.",
      what: "What it is: not \"AI writes code\" — it's 11 hand-built play templates + your theme, picking the best fit out of 8640 combos and reskinning title, copy, and pacing. The gameplay itself is validated, playable code.",
      placeholder: "Type anything, e.g. deep-sea archaeology",
      empty: "Type a word first :)",
      chips: ["deep-sea archaeology", "fortune telling", "computer virus", "retirement planning", "office slacking", "street racing", "coffee shop", "exam countdown"]
    }
  };

  var lang = "zh";
  var lastTheme = "", variantIdx = 0, lastHtml = "", lastSpec = null;

  var $ = function (id) { return document.getElementById(id); };
  var form = $("form"), themeInput = $("theme"), result = $("result");
  var frame = $("frame"), gameTitle = $("gameTitle"), gameKit = $("gameKit");
  var chips = $("chips");

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
      b.addEventListener("click", function () { themeInput.value = theme; generate(theme, {}); });
      chips.appendChild(b);
    });
  }

  function generate(theme, opts) {
    opts = opts || {};
    theme = (theme || "").trim();
    if (!theme) { themeInput.focus(); return; }

    var ranked = core.rankCandidates(DATA.catalogs, theme);
    var top = ranked.slice(0, 12);
    var idx = 0;
    if (opts.cycle && theme === lastTheme && top.length > 1) {
      variantIdx = (variantIdx + 1) % top.length;
      idx = variantIdx;
    } else {
      variantIdx = 0;
    }
    lastTheme = theme;

    var candidate = top[idx];
    var spec = core.buildSpec(candidate, theme, lang, DATA.catalogs);
    var html = core.renderGameHtml(candidate, spec, DATA.templates[candidate.playKit.template], { badgeUrl: SITE });
    lastHtml = html;
    lastSpec = spec;

    gameTitle.textContent = spec.title;
    gameKit.textContent = spec.playKit;
    frame.srcdoc = html;
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    generate(themeInput.value, {});
  });

  $("random").addEventListener("click", function () {
    var pool = I18N[lang].chips;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    themeInput.value = pick;
    generate(pick, {});
  });

  $("again").addEventListener("click", function () {
    generate(lastTheme || themeInput.value, { cycle: true });
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

  $("lang-zh").addEventListener("click", function () { setLang("zh"); });
  $("lang-en").addEventListener("click", function () { setLang("en"); });

  function setLang(next) {
    if (lang === next) return;
    lang = next;
    applyLang();
    if (!result.hidden && lastTheme) generate(lastTheme, {}); // re-render current game in new language
  }

  applyLang();
})();
