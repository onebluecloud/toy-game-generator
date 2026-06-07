#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "examples", "audit");

const checks = [];

function main() {
  cleanDir(OUT);
  fs.mkdirSync(OUT, { recursive: true });

  check("project validation", () => runNode(["scripts/validate.js"]));
  check("product app and API audit", () => runNode(["scripts/audit-product.js"]));
  check("templates keep UI chrome outside hard-coded CJK", () => {
    const offenders = [];
    for (const file of fs.readdirSync(path.join(ROOT, "templates")).filter(name => name.endsWith(".html"))) {
      const text = fs.readFileSync(path.join(ROOT, "templates", file), "utf8");
      if (/[\u4e00-\u9fff]/.test(text)) offenders.push(file);
    }
    if (offenders.length) throw new Error("CJK text remains in templates: " + offenders.join(", "));
  });
  check("lang flag writes GameSpec strings and html lang", () => {
    const enHtml = path.join(OUT, "i18n-en.html");
    const enSpec = path.join(OUT, "i18n-en.spec.json");
    const zhHtml = path.join(OUT, "i18n-zh.html");
    const zhSpec = path.join(OUT, "i18n-zh.spec.json");
    runNode(["scripts/generate.js", "--theme", "deep sea archaeology", "--lang", "en", "--out", enHtml, "--spec-out", enSpec]);
    runNode(["scripts/generate.js", "--theme", "深海考古", "--lang", "zh", "--out", zhHtml, "--spec-out", zhSpec]);
    runNode(["scripts/validate.js", "--game", enHtml, "--spec", enSpec]);
    runNode(["scripts/validate.js", "--game", zhHtml, "--spec", zhSpec]);
    assertLanguage(enHtml, enSpec, "en", ["Score", "Best", "START", "RESTART"]);
    assertLanguage(zhHtml, zhSpec, "zh", ["分数", "最高", "开始", "重开"]);
    const zhParsed = readJson(zhSpec);
    const zhVisible = [zhParsed.title, ...Object.values(zhParsed.roles || {})].join(" ");
    if (/[A-Za-z]/.test(zhVisible)) throw new Error("zh title/roles leaked ASCII text: " + zhVisible);
  });
  check("theme-derived titles and roles avoid coffee leakage", () => {
    const samples = [
      ["deep sea archaeology", "Deep Sea"],
      ["retirement planning", "Retirement Planning"],
      ["urban insomnia", "Urban Insomnia"],
      ["solar invoice cleanup", "Solar Invoice"],
      ["museum security", "Museum Security"]
    ];
    for (const [theme, titlePrefix] of samples) {
      const html = path.join(OUT, slugForFile(theme) + ".html");
      const specFile = path.join(OUT, slugForFile(theme) + ".spec.json");
      runNode(["scripts/generate.js", "--theme", theme, "--lang", "en", "--out", html, "--spec-out", specFile]);
      runNode(["scripts/validate.js", "--game", html, "--spec", specFile]);
      const spec = readJson(specFile);
      if (!spec.title.startsWith(titlePrefix)) throw new Error(spec.title + " did not start with " + titlePrefix);
      const visible = JSON.stringify({ title: spec.title, roles: spec.roles }).toLowerCase();
      if (/\b(coffee|cafe|bean)\b/.test(visible)) throw new Error(theme + " leaked coffee/cafe/bean in title or roles: " + visible);
      if (!visible.includes(theme.split(/\s+/)[0])) throw new Error(theme + " roles/title did not preserve theme word: " + visible);
    }
  });
  check("coffee prompt maps to horde survival toy diorama", () => {
    const html = path.join(OUT, "coffee.html");
    const spec = path.join(OUT, "coffee.spec.json");
    runNode(["scripts/generate.js", "--theme", "咖啡豆割草游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      playKit: "horde-survival",
      styleKit: "toy-diorama",
      enemySet: "sleepy-swarm",
      difficulty: "standard"
    });
  });
  check("racing prompt maps to runner lane pixel neon", () => {
    const html = path.join(OUT, "racing.html");
    const spec = path.join(OUT, "racing.spec.json");
    runNode(["scripts/generate.js", "--theme", "racing neon car", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      playKit: "runner-lane",
      styleKit: "pixel-neon",
      enemySet: "traffic-pack",
      difficulty: "standard"
    });
  });
  check("computer prompt maps to glitch enemy set", () => {
    const html = path.join(OUT, "computer.html");
    const spec = path.join(OUT, "computer.spec.json");
    runNode(["scripts/generate.js", "--theme", "电脑病毒清理游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      playKit: "horde-survival",
      styleKit: "pixel-neon",
      enemySet: "glitch-pack",
      difficulty: "standard"
    });
  });
  check("tower defense prompt maps to tower defense", () => {
    const html = path.join(OUT, "tower-defense.html");
    const spec = path.join(OUT, "tower-defense.spec.json");
    runNode(["scripts/generate.js", "--theme", "守护咖啡店塔防游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      titleSuffix: "Defense",
      playKit: "tower-defense",
      styleKit: "paper-cut",
      enemySet: "siege-pack",
      difficulty: "standard"
    });
  });
  check("deck builder prompt maps to deck builder", () => {
    const html = path.join(OUT, "deck-builder.html");
    const spec = path.join(OUT, "deck-builder.spec.json");
    runNode(["scripts/generate.js", "--theme", "商业谈判卡牌构筑游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      titleSuffix: "Deck",
      playKit: "deck-builder",
      styleKit: "clinical-ritual",
      enemySet: "dilemma-pack",
      difficulty: "standard"
    });
  });
  check("match puzzle prompt maps to match puzzle", () => {
    const html = path.join(OUT, "match-puzzle.html");
    const spec = path.join(OUT, "match-puzzle.spec.json");
    runNode(["scripts/generate.js", "--theme", "咖啡豆消除游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      titleSuffix: "Match",
      playKit: "match-puzzle",
      styleKit: "toy-diorama",
      enemySet: "clutter-pack",
      difficulty: "standard"
    });
  });
  check("physics arc prompt maps to physics arc", () => {
    const html = path.join(OUT, "physics-arc.html");
    const spec = path.join(OUT, "physics-arc.spec.json");
    runNode(["scripts/generate.js", "--theme", "投掷救援弹射游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      titleSuffix: "Arc",
      playKit: "physics-arc",
      styleKit: "paper-cut",
      enemySet: "obstacle-pack",
      difficulty: "standard"
    });
  });
  check("rhythm prompt maps to rhythm tap", () => {
    const html = path.join(OUT, "rhythm-tap.html");
    const spec = path.join(OUT, "rhythm-tap.spec.json");
    runNode(["scripts/generate.js", "--theme", "音乐节奏点击游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      titleSuffix: "Beat",
      playKit: "rhythm-tap",
      styleKit: "pixel-neon",
      enemySet: "beat-pack",
      difficulty: "standard"
    });
  });
  check("platform prompt maps to platform climb", () => {
    const html = path.join(OUT, "platform-climb.html");
    const spec = path.join(OUT, "platform-climb.spec.json");
    runNode(["scripts/generate.js", "--theme", "冒险爬塔平台跳跃游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      titleSuffix: "Climb",
      playKit: "platform-climb",
      styleKit: "paper-cut",
      enemySet: "hazard-pack",
      difficulty: "standard"
    });
  });
  check("idle automation prompt maps to idle automation", () => {
    const html = path.join(OUT, "idle-automation.html");
    const spec = path.join(OUT, "idle-automation.spec.json");
    runNode(["scripts/generate.js", "--theme", "咖啡店经营自动化游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      titleSuffix: "Loop",
      playKit: "idle-automation",
      styleKit: "toy-diorama",
      enemySet: "bottleneck-pack",
      difficulty: "standard"
    });
  });
  check("grid tactics prompt maps to grid tactics", () => {
    const html = path.join(OUT, "grid-tactics.html");
    const spec = path.join(OUT, "grid-tactics.spec.json");
    runNode(["scripts/generate.js", "--theme", "病毒围堵战术棋盘游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      titleSuffix: "Grid",
      playKit: "grid-tactics",
      styleKit: "pixel-neon",
      enemySet: "tactic-pack",
      difficulty: "standard"
    });
  });
  check("fortune prompt maps to premium case deduction", () => {
    const html = path.join(OUT, "fortune.html");
    const spec = path.join(OUT, "fortune.spec.json");
    runNode(["scripts/generate.js", "--theme", "算命游戏", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    assertSpec(spec, {
      playKit: "case-deduction",
      styleKit: "occult-archive",
      enemySet: "ambiguity-pack",
      difficulty: "standard",
      maturityLevel: "premium",
      coreIncludes: "interpret"
    });
  });
  check("fortune list exposes case-deduction candidates", () => {
    const output = runNode(["scripts/generate.js", "--theme", "占卜推理游戏", "--list", "--limit", "5"]).stdout;
    const rows = output.split(/\r?\n/).filter(line => /^\s*\d+\s+\|/.test(line));
    if (!rows.length) throw new Error("No ranked candidates printed.");
    if (!rows.some(row => row.includes("case-deduction"))) {
      throw new Error("Top fortune candidates did not include case-deduction.");
    }
  });
  check("fortune batch keeps mature premium route", () => {
    const dir = path.join(OUT, "fortune-batch");
    cleanDir(dir);
    runNode(["scripts/generate.js", "--theme", "算命游戏", "--count", "3", "--out-dir", dir]);
    const specs = listSpecs(dir);
    if (specs.length !== 3) throw new Error("Expected 3 fortune specs, got " + specs.length);
    for (const spec of specs) {
      const parsed = readJson(spec);
      if (parsed.playKit !== "case-deduction") throw new Error("Fortune batch leaked non-case play kit: " + parsed.playKit);
      if (parsed.maturityLevel !== "premium") throw new Error("Fortune batch leaked non-premium maturity: " + parsed.maturityLevel);
      if (parsed.styleKit === "toy-diorama") throw new Error("Fortune batch leaked toy-diorama style.");
    }
  });
  check("vague prompt still generates a valid fallback game", () => {
    const html = path.join(OUT, "vague.html");
    const spec = path.join(OUT, "vague.spec.json");
    runNode(["scripts/generate.js", "--theme", "一团说不清楚的压力", "--out", html, "--spec-out", spec]);
    runNode(["scripts/validate.js", "--game", html, "--spec", spec]);
    const parsed = readJson(spec);
    if (!parsed.roles || !parsed.roles.player || !parsed.palette || !parsed.enemyTypes.length) {
      throw new Error("Fallback spec is missing usable roles, palette, or enemies.");
    }
  });
  check("filtered list only includes matching style and difficulty", () => {
    const output = runNode(["scripts/generate.js", "--theme", "赛车游戏", "--list", "--limit", "5", "--style-kit", "paper-cut", "--difficulty", "espresso"]).stdout;
    const rows = output.split(/\r?\n/).filter(line => /^\s*\d+\s+\|/.test(line));
    if (!rows.length) throw new Error("No ranked candidates printed.");
    for (const row of rows) {
      if (!row.includes("paper-cut") || !row.includes("espresso")) {
        throw new Error("Filtered list leaked non-matching row: " + row);
      }
    }
  });
  check("forced batch applies every filter", () => {
    const dir = path.join(OUT, "forced-batch");
    cleanDir(dir);
    runNode([
      "scripts/generate.js",
      "--theme", "赛车游戏",
      "--count", "2",
      "--out-dir", dir,
      "--play-kit", "runner-lane",
      "--style-kit", "paper-cut",
      "--enemy-set", "traffic-pack",
      "--difficulty", "espresso"
    ]);
    const specs = listSpecs(dir);
    if (specs.length !== 2) throw new Error("Expected 2 forced batch specs, got " + specs.length);
    for (const spec of specs) {
      runNode(["scripts/validate.js", "--game", spec.replace(/\.spec\.json$/, ".html"), "--spec", spec]);
      assertSpec(spec, {
        playKit: "runner-lane",
        styleKit: "paper-cut",
        enemySet: "traffic-pack",
        difficulty: "espresso"
      });
    }
  });
  check("batch ids are unique", () => {
    const dir = path.join(OUT, "unique-batch");
    cleanDir(dir);
    runNode(["scripts/generate.js", "--theme", "电脑病毒清理游戏", "--count", "12", "--out-dir", dir]);
    const specs = listSpecs(dir);
    if (specs.length !== 12) throw new Error("Expected 12 specs, got " + specs.length);
    const ids = specs.map(file => readJson(file).id);
    const unique = new Set(ids);
    if (unique.size !== ids.length) throw new Error("Duplicate spec ids found in batch.");
  });
  check("invalid count fails", () => {
    runNode(["scripts/generate.js", "--theme", "咖啡", "--count", "nope", "--out-dir", path.join(OUT, "bad-count")], { expectFailure: true, expectedText: "--count must be a positive integer" });
  });
  check("over-requested filtered count fails", () => {
    runNode([
      "scripts/generate.js",
      "--theme", "赛车游戏",
      "--count", "3",
      "--out-dir", path.join(OUT, "too-many"),
      "--play-kit", "runner-lane",
      "--style-kit", "paper-cut",
      "--enemy-set", "traffic-pack",
      "--difficulty", "espresso"
    ], { expectFailure: true, expectedText: "only 2 candidates match" });
  });

  const failed = checks.filter(item => !item.passed);
  for (const item of checks) {
    console.log((item.passed ? "[OK] " : "[FAIL] ") + item.name + (item.error ? " - " + item.error : ""));
  }
  if (failed.length) process.exit(1);
  console.log("[OK] toy-game-generator audit passed (" + checks.length + " checks)");
}

function check(name, fn) {
  try {
    fn();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
  }
}

function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true
  });
  const text = (result.stdout || "") + (result.stderr || "");
  if (options.expectFailure) {
    if (result.status === 0) throw new Error("Expected command to fail: node " + args.join(" "));
    if (options.expectedText && !text.includes(options.expectedText)) {
      throw new Error("Failure did not include expected text: " + options.expectedText);
    }
    return result;
  }
  if (result.status !== 0) {
    throw new Error("Command failed: node " + args.join(" ") + "\n" + text.trim());
  }
  return result;
}

function assertSpec(file, expected) {
  const spec = readJson(file);
  if (expected.title && spec.title !== expected.title) throw new Error(path.basename(file) + " title expected " + expected.title + ", got " + spec.title);
  if (expected.titleSuffix && !(typeof spec.title === "string" && spec.title.trim().length > 1)) throw new Error(path.basename(file) + " produced an empty title");
  if (spec.playKit !== expected.playKit) throw new Error(path.basename(file) + " playKit expected " + expected.playKit + ", got " + spec.playKit);
  if (spec.styleKit !== expected.styleKit) throw new Error(path.basename(file) + " styleKit expected " + expected.styleKit + ", got " + spec.styleKit);
  if ((spec.enemySet || []).join("+") !== expected.enemySet) throw new Error(path.basename(file) + " enemySet expected " + expected.enemySet + ", got " + (spec.enemySet || []).join("+"));
  if (spec.difficulty !== expected.difficulty) throw new Error(path.basename(file) + " difficulty expected " + expected.difficulty + ", got " + spec.difficulty);
  if (expected.maturityLevel && spec.maturityLevel !== expected.maturityLevel) throw new Error(path.basename(file) + " maturityLevel expected " + expected.maturityLevel + ", got " + spec.maturityLevel);
  if (expected.coreIncludes && !String(spec.coreExperience || "").toLowerCase().includes(expected.coreIncludes)) {
    throw new Error(path.basename(file) + " coreExperience did not include " + expected.coreIncludes);
  }
}

function assertLanguage(htmlFile, specFile, lang, expectedStrings) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const spec = readJson(specFile);
  if (spec.lang !== lang) throw new Error(path.basename(specFile) + " lang expected " + lang + ", got " + spec.lang);
  if (!html.includes("<html lang=\"" + lang + "\"")) throw new Error(path.basename(htmlFile) + " html lang did not match " + lang);
  if (!spec.strings || typeof spec.strings !== "object") throw new Error(path.basename(specFile) + " missing strings object");
  for (const key of ["start", "restart", "score", "best", "time", "gameOver"]) {
    if (typeof spec.strings[key] !== "string" || !spec.strings[key]) throw new Error(path.basename(specFile) + " missing string " + key);
  }
  for (const needle of expectedStrings) {
    if (!html.includes(needle)) throw new Error(path.basename(htmlFile) + " missing localized text " + needle);
  }
}

function slugForFile(input) {
  return String(input).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "sample";
}

function listSpecs(dir) {
  return fs.readdirSync(dir)
    .filter(name => name.endsWith(".spec.json"))
    .map(name => path.join(dir, name))
    .sort();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function cleanDir(dir) {
  const target = path.resolve(dir);
  if (!target.startsWith(ROOT)) throw new Error("Refusing to remove outside project: " + target);
  fs.rmSync(target, { recursive: true, force: true });
}

main();
