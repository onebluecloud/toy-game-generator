#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIFFICULTIES = ["mellow", "standard", "espresso"];
const REQUIRED_PROJECT_FILES = [
  "package.json",
  "README.md",
  "docs/v3-productization.md",
  "specs/game-spec.schema.json",
  "kits/play-kits.json",
  "kits/style-kits.json",
  "kits/mechanic-kits.json",
  "kits/enemy-kits.json",
  "kits/strings/en.json",
  "kits/strings/zh.json",
  "kits/theme-mappings.json",
  "templates/horde-survival.html",
  "templates/runner-lane.html",
  "app/index.html",
  "app/app.js",
  "app/styles.css",
  "scripts/ai-spec.js",
  "scripts/audit.js",
  "scripts/generate.js",
  "scripts/preview.js"
];
const REQUIRED_TEMPLATE_TOKENS = [
  "{{TITLE}}",
  "{{BACKGROUND_A}}",
  "{{INK}}",
  "{{ID}}",
  "{{STYLE_KIT}}",
  "{{MECHANICS}}",
  "{{ENEMY_SET}}",
  "{{LANG}}",
  "{{SPEC_JSON}}"
];

const failures = [];

function main() {
  const args = parseArgs(process.argv.slice(2));
  validateProject();
  if (args.game || args.spec) {
    if (!args.game || !args.spec) fail("Use --game and --spec together.");
    else validateGeneratedGame(resolveFromRoot(args.game), resolveFromRoot(args.spec));
  }
  if (failures.length) {
    console.error("[FAIL] toy-game-generator validation");
    for (const item of failures) console.error("- " + item);
    process.exit(1);
  }
  console.log("[OK] toy-game-generator validation passed");
}

function validateProject() {
  for (const rel of REQUIRED_PROJECT_FILES) {
    if (!fs.existsSync(path.join(ROOT, rel))) fail("Missing required file: " + rel);
  }

  const playKits = readJson("kits/play-kits.json");
  const styleKits = readJson("kits/style-kits.json");
  const mechanicKits = readJson("kits/mechanic-kits.json");
  const enemyKits = readJson("kits/enemy-kits.json");
  const stringsEn = readJson("kits/strings/en.json");
  const stringsZh = readJson("kits/strings/zh.json");
  const mappings = readJson("kits/theme-mappings.json");
  const schema = readJson("specs/game-spec.schema.json");
  validateAppShell();
  validateProductDocs();

  requireArray(playKits, "play-kits");
  requireArray(styleKits, "style-kits");
  requireArray(mechanicKits, "mechanic-kits");
  requireArray(enemyKits, "enemy-kits");
  requireArray(mappings, "theme-mappings");
  validateStringsTable(stringsEn, "kits/strings/en.json");
  validateStringsTable(stringsZh, "kits/strings/zh.json");

  const playIds = new Set(playKits.map(item => item.id));
  const styleIds = new Set(styleKits.map(item => item.id));
  const mechanicIds = new Set(mechanicKits.map(item => item.id));
  const enemyIds = new Set(enemyKits.map(item => item.id));

  for (const kit of playKits) {
    requireString(kit.id, "play kit id");
    requireString(kit.template, "template for play kit " + kit.id);
    if (!fs.existsSync(path.join(ROOT, "templates", kit.template))) {
      fail("Template missing for play kit " + kit.id + ": " + kit.template);
    }
    for (const mechanic of kit.requiredMechanics || []) {
      if (!mechanicIds.has(mechanic)) fail("Unknown required mechanic " + mechanic + " in play kit " + kit.id);
    }
  }

  for (const style of styleKits) {
    requireString(style.id, "style kit id");
    validatePalette(style.colors, "style kit " + style.id);
  }

  for (const enemy of enemyKits) {
    requireString(enemy.id, "enemy kit id");
    requireArray(enemy.types, "enemy types for " + enemy.id);
    if (new Set(enemy.types).size !== enemy.types.length) fail("Duplicate enemy types in " + enemy.id);
  }

  for (const mapping of mappings) {
    requireArray(mapping.keywords, "mapping keywords");
    requireString(mapping.maturityLevel, "mapping maturityLevel");
    requireString(mapping.coreExperience, "mapping coreExperience");
    for (const id of mapping.preferredPlayKits || []) if (!playIds.has(id)) fail("Mapping references unknown play kit: " + id);
    for (const id of mapping.preferredStyleKits || []) if (!styleIds.has(id)) fail("Mapping references unknown style kit: " + id);
    for (const id of mapping.preferredEnemySets || []) if (!enemyIds.has(id)) fail("Mapping references unknown enemy kit: " + id);
  }

  const required = schema && schema.required ? schema.required : [];
  for (const field of ["version", "id", "title", "theme", "lang", "strings", "maturityLevel", "coreExperience", "playKit", "styleKit", "mechanics", "enemySet", "enemyTypes", "palette", "roles", "duration", "difficulty", "tuning"]) {
    if (!required.includes(field)) fail("Schema required fields missing " + field);
  }

  const candidateCount = playKits.length * styleKits.length * enemyKits.length * DIFFICULTIES.length;
  if (candidateCount < 50) {
    fail("Candidate space too small for generator MVP: " + candidateCount + " variants");
  }

  for (const kit of playKits) {
    validateTemplate(path.join(ROOT, "templates", kit.template), kit.id);
  }
}

function validateProductDocs() {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const productDoc = fs.readFileSync(path.join(ROOT, "docs/v3-productization.md"), "utf8");
  for (const needle of ["npm run app", "Chinese and English", "DeepSeek", "Current Play Kits"]) {
    if (!readme.includes(needle)) fail("README.md missing " + needle);
  }
  for (const needle of ["Chinese/English GUI", "Optional DeepSeek Mode", "tower-defense", "npm run audit"]) {
    if (!productDoc.includes(needle)) fail("docs/v3-productization.md missing " + needle);
  }
}

function validateAppShell() {
  const html = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "app/app.js"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "app/styles.css"), "utf8");
  for (const needle of [
    "Toy Game Generator",
    "data-role=\"theme-input\"",
    "data-role=\"generate-button\"",
    "data-role=\"game-preview\"",
    "data-role=\"ai-toggle\"",
    "data-role=\"language-select\"",
    "中文",
    "English",
    "download"
  ]) {
    if (!html.includes(needle)) fail("app/index.html missing " + needle);
  }
  for (const needle of ["/api/candidates", "/api/generate", "fetch(", "const I18N", "zh:", "en:", "applyLanguage"]) {
    if (!js.includes(needle)) fail("app/app.js missing " + needle);
  }
  if (externalRequestPattern().test(html) || externalRequestPattern().test(js) || externalRequestPattern().test(css)) {
    fail("GUI contains external request markup");
  }
}

function validateTemplate(file, kitId) {
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, "utf8");
  for (const token of REQUIRED_TEMPLATE_TOKENS) {
    if (!html.includes(token)) fail(path.basename(file) + " missing token " + token);
  }
  for (const needle of ["GAME_KIT", "requestAnimationFrame", "pointerdown", "pointermove", "pointerup", "localStorage"]) {
    if (!html.includes(needle)) fail(path.basename(file) + " missing " + needle);
  }
  if (!html.includes("touch-action:none") && !html.includes("touch-action: none")) {
    fail(path.basename(file) + " missing touch-action none");
  }
  if (externalRequestPattern().test(html)) fail(path.basename(file) + " contains external request markup");
  if (!html.includes("GAME_KIT: " + kitId)) fail(path.basename(file) + " GAME_KIT comment does not match " + kitId);
  if (!html.includes("SPEC.strings")) fail(path.basename(file) + " missing SPEC.strings usage");
}

function validateGeneratedGame(htmlPath, specPath) {
  if (!fs.existsSync(htmlPath)) fail("Generated game missing: " + htmlPath);
  if (!fs.existsSync(specPath)) fail("Generated spec missing: " + specPath);
  if (!fs.existsSync(htmlPath) || !fs.existsSync(specPath)) return;

  const html = fs.readFileSync(htmlPath, "utf8");
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  validateSpec(spec, path.basename(specPath));

  if (html.includes("{{")) fail(path.basename(htmlPath) + " has unreplaced template token");
  if (!html.includes("const SPEC =")) fail(path.basename(htmlPath) + " missing embedded SPEC");
  for (const needle of ["GAME_SPEC_ID: " + spec.id, "GAME_KIT: " + spec.playKit, "requestAnimationFrame", "pointerdown", "pointermove", "pointerup", "localStorage"]) {
    if (!html.includes(needle)) fail(path.basename(htmlPath) + " missing " + needle);
  }
  if (!html.includes("touch-action:none") && !html.includes("touch-action: none")) {
    fail(path.basename(htmlPath) + " missing touch-action none");
  }
  if (externalRequestPattern().test(html)) fail(path.basename(htmlPath) + " contains external request markup");
}

function validateSpec(spec, label) {
  for (const key of ["version", "id", "title", "theme", "lang", "strings", "maturityLevel", "coreExperience", "playKit", "styleKit", "mechanics", "enemySet", "enemyTypes", "palette", "roles", "duration", "difficulty", "tuning"]) {
    if (!(key in spec)) fail(label + " missing " + key);
  }
  if (spec.version !== "0.1") fail(label + " version must be 0.1");
  if (!/^[a-z0-9-]+$/.test(spec.id || "")) fail(label + " id must be lowercase slug");
  requireString(spec.title, label + " title");
  requireString(spec.theme, label + " theme");
  if (!["en", "zh"].includes(spec.lang)) fail(label + " unknown lang " + spec.lang);
  validateSpecStrings(spec.strings, label + " strings");
  if (!["toy", "casual", "arcade", "premium", "satirical"].includes(spec.maturityLevel)) fail(label + " unknown maturityLevel " + spec.maturityLevel);
  requireString(spec.coreExperience, label + " coreExperience");
  requireString(spec.playKit, label + " playKit");
  requireString(spec.styleKit, label + " styleKit");
  requireArray(spec.mechanics, label + " mechanics");
  requireArray(spec.enemySet, label + " enemySet");
  requireArray(spec.enemyTypes, label + " enemyTypes");
  validatePalette(spec.palette, label + " palette");
  for (const role of ["player", "objective", "threat", "reward", "special", "environment"]) {
    if (!spec.roles || typeof spec.roles[role] !== "string" || !spec.roles[role].trim()) fail(label + " role missing " + role);
  }
  if (!Number.isInteger(spec.duration) || spec.duration < 30 || spec.duration > 180) fail(label + " duration out of range");
  if (!DIFFICULTIES.includes(spec.difficulty)) fail(label + " unknown difficulty " + spec.difficulty);
  for (const key of ["speed", "spawnRate", "scoreMultiplier"]) {
    if (!spec.tuning || typeof spec.tuning[key] !== "number" || spec.tuning[key] <= 0) fail(label + " tuning missing positive " + key);
  }
}

function validateStringsTable(table, label) {
  if (!table || typeof table !== "object") fail(label + " must be an object");
  if (!table.common || typeof table.common !== "object") fail(label + " missing common strings");
  validateSpecStrings(table.common, label + " common");
}

function validateSpecStrings(strings, label) {
  for (const key of ["start", "restart", "score", "best", "time", "gameOver"]) {
    if (!strings || typeof strings[key] !== "string" || !strings[key].trim()) fail(label + " missing " + key);
  }
  if (!String(strings && strings.time || "").includes("{n}")) fail(label + " time must include {n}");
}

function validatePalette(palette, label) {
  for (const key of ["backgroundA", "backgroundB", "accent", "good", "bad", "ink"]) {
    if (!palette || !/^#[0-9a-fA-F]{6}$/.test(palette[key] || "")) {
      fail(label + " palette missing hex " + key);
    }
  }
}

function readJson(rel) {
  const file = path.join(ROOT, rel);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail("Cannot parse " + rel + ": " + error.message);
    return null;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--game" || arg === "--spec") {
      out[arg.slice(2)] = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/validate.js [--game examples/game.html --spec examples/game.spec.json]");
      process.exit(0);
    } else {
      fail("Unknown argument: " + arg);
    }
  }
  return out;
}

function resolveFromRoot(input) {
  return path.isAbsolute(input) ? input : path.join(ROOT, input);
}

function requireArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) fail(label + " must be a non-empty array");
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(label + " must be a non-empty string");
}

function externalRequestPattern() {
  return /<(script|link|img|audio|video|source)\b[^>]*(src|href)=["']https?:\/\//i;
}

function fail(message) {
  failures.push(message);
}

main();
