#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const core = require("../lib/generator-core.js");

const ROOT = path.resolve(__dirname, "..");
const DIFFICULTIES = core.DIFFICULTIES;

// Back-link baked into every generated game ("Make your own →" / "做一个你的 →").
// Set TGG_BADGE_URL="" to disable.
const SITE_URL = process.env.TGG_BADGE_URL != null
  ? process.env.TGG_BADGE_URL
  : "https://onebluecloud.github.io/toy-game-generator/";

function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogs = loadCatalogs();

  if (args.help) return printHelp();
  if (!args.theme) fail("Missing --theme. Example: node scripts/generate.js --theme \"coffee bean survival\"");
  const lang = args.lang || "en";

  const rankedCandidates = core.rankCandidates(catalogs, args.theme);
  const candidates = core.filterCandidates(rankedCandidates, {
    playKit: args.playKit,
    styleKit: args.styleKit,
    enemySet: args.enemySet,
    difficulty: args.difficulty
  });
  if (!candidates.length) fail("No candidate matches the requested overrides.");

  if (args.list) {
    printCandidates(candidates, args.limit || 12);
    return;
  }

  const count = parsePositiveInteger(args.count || "1", "--count");
  if (count > candidates.length) {
    fail("Requested " + count + " variants, but only " + candidates.length + " candidates match the filters.");
  }
  if (count > 1) {
    const outDir = path.resolve(ROOT, args.outDir || "examples/batch");
    fs.mkdirSync(outDir, { recursive: true });
    const generated = [];
    for (const candidate of candidates.slice(0, count)) {
      const spec = core.buildSpec(candidate, args.theme, lang, catalogs);
      const fileBase = spec.id;
      const htmlPath = path.join(outDir, fileBase + ".html");
      const specPath = path.join(outDir, fileBase + ".spec.json");
      writeGame(candidate, spec, htmlPath, specPath);
      generated.push(htmlPath);
    }
    console.log("[OK] Generated " + generated.length + " games in " + outDir);
    return;
  }

  const spec = core.buildSpec(candidates[0], args.theme, lang, catalogs);
  const outPath = path.resolve(ROOT, args.out || path.join("examples", spec.id + ".html"));
  const specPath = path.resolve(ROOT, args.specOut || outPath.replace(/\.html?$/i, "") + ".spec.json");
  writeGame(candidates[0], spec, outPath, specPath);
  console.log("[OK] Generated game: " + outPath);
  console.log("[OK] Generated spec: " + specPath);
}

function loadCatalogs() {
  return {
    playKits: readJson("kits/play-kits.json"),
    styleKits: readJson("kits/style-kits.json"),
    mechanicKits: readJson("kits/mechanic-kits.json"),
    enemyKits: readJson("kits/enemy-kits.json"),
    mappings: readJson("kits/theme-mappings.json"),
    strings: {
      en: readJson("kits/strings/en.json"),
      zh: readJson("kits/strings/zh.json")
    }
  };
}

function writeGame(candidate, spec, htmlPath, specPath) {
  const templatePath = path.join(ROOT, "templates", candidate.playKit.template);
  const templateText = fs.readFileSync(templatePath, "utf8");
  const html = core.renderGameHtml(candidate, spec, templateText, { badgeUrl: SITE_URL });

  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(htmlPath, html, "utf8");
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n", "utf8");
}

function printCandidates(candidates, limit) {
  console.log("Ranked candidates:");
  for (const candidate of candidates.slice(0, limit)) {
    console.log([
      String(Math.round(candidate.score)).padStart(3, " "),
      candidate.playKit.id,
      candidate.styleKit.id,
      candidate.enemyKit.id,
      candidate.difficulty,
      candidate.mechanics.join("+")
    ].join(" | "));
  }
  console.log("Total candidate space: " + candidates.length);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--theme") args.theme = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--spec-out") args.specOut = argv[++i];
    else if (arg === "--out-dir") args.outDir = argv[++i];
    else if (arg === "--play-kit") args.playKit = argv[++i];
    else if (arg === "--style-kit") args.styleKit = argv[++i];
    else if (arg === "--enemy-set") args.enemySet = argv[++i];
    else if (arg === "--difficulty") args.difficulty = argv[++i];
    else if (arg === "--lang") args.lang = argv[++i];
    else if (arg === "--count") args.count = argv[++i];
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--list") args.list = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else fail("Unknown argument: " + arg);
  }
  if (args.difficulty && !DIFFICULTIES.includes(args.difficulty)) {
    fail("Unknown --difficulty " + args.difficulty + ". Use mellow, standard, or espresso.");
  }
  if (args.lang && !["en", "zh"].includes(args.lang)) {
    fail("Unknown --lang " + args.lang + ". Use en or zh.");
  }
  return args;
}

function parsePositiveInteger(input, label) {
  if (!/^[1-9][0-9]*$/.test(String(input || ""))) {
    fail(label + " must be a positive integer.");
  }
  return Number(input);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function printHelp() {
  console.log([
    "Usage:",
    "  node scripts/generate.js --theme \"coffee bean survival\"",
    "  node scripts/generate.js --theme \"赛车游戏\" --difficulty espresso",
    "  node scripts/generate.js --theme \"computer virus\" --list",
    "",
    "Options:",
    "  --out <file>         Write one HTML game",
    "  --spec-out <file>    Write one GameSpec JSON",
    "  --count <n>          Generate top n variants into --out-dir",
    "  --out-dir <dir>      Batch output directory",
    "  --play-kit <id>      Force a play kit",
    "  --style-kit <id>     Force a style kit",
    "  --enemy-set <id>     Force an enemy kit",
    "  --difficulty <id>    mellow, standard, espresso",
    "  --lang <id>          en or zh",
    "  --list               Print ranked candidates"
  ].join("\n"));
}

function fail(message) {
  console.error("[FAIL] " + message);
  process.exit(1);
}

main();
