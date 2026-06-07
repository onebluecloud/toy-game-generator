#!/usr/bin/env node
"use strict";

// Bundles the generator core + kit data + templates into docs/ so the live
// GitHub Pages site can generate playable games fully client-side (no backend).
//
//   docs/generator-core.js   <- copy of lib/generator-core.js (UMD -> window.ToyGameCore)
//   docs/data.js             <- window.TGG_DATA = { catalogs, templates }
//
// index.html / app.js / styles.css are authored source files and are NOT touched here.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function main() {
  fs.mkdirSync(DOCS, { recursive: true });

  const catalogs = {
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

  const templates = {};
  const templateDir = path.join(ROOT, "templates");
  for (const file of fs.readdirSync(templateDir).filter(name => name.endsWith(".html"))) {
    templates[file] = fs.readFileSync(path.join(templateDir, file), "utf8");
  }

  const data = { catalogs, templates };
  // Written as an external JS file (not inline), so template "</script>" cannot break parsing.
  fs.writeFileSync(
    path.join(DOCS, "data.js"),
    "window.TGG_DATA = " + JSON.stringify(data) + ";\n",
    "utf8"
  );

  fs.copyFileSync(
    path.join(ROOT, "lib", "generator-core.js"),
    path.join(DOCS, "generator-core.js")
  );

  // Disable Jekyll processing on GitHub Pages.
  fs.writeFileSync(path.join(DOCS, ".nojekyll"), "", "utf8");

  const kb = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(0);
  console.log("[OK] Wrote docs/data.js (" + kb + " KB), docs/generator-core.js, docs/.nojekyll");
  console.log("[OK] Bundled " + Object.keys(templates).length + " templates, " + catalogs.playKits.length + " play kits");
}

main();
