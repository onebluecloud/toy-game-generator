#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = 8791;
const HOST = "127.0.0.1";
const OUT = path.join(ROOT, "examples", "audit", "gui-generated");

main().catch(error => {
  console.error("[FAIL] product audit - " + error.message);
  process.exit(1);
});

async function main() {
  assertFiles();
  cleanDir(OUT);
  const server = await startServer();
  try {
    await assertGuiLoads();
    await assertCandidateApi();
    await assertGenerateApi();
    await assertAiMissingKeyError();
    console.log("[OK] product audit passed");
  } finally {
    server.kill();
  }
}

function assertFiles() {
  const packageJson = readJson("package.json");
  if (!packageJson.scripts || packageJson.scripts.app !== "node scripts/preview.js --app") {
    throw new Error("package.json missing app script");
  }
  for (const rel of [
    "app/index.html",
    "app/app.js",
    "app/styles.css",
    "scripts/ai-spec.js"
  ]) {
    if (!fs.existsSync(path.join(ROOT, rel))) throw new Error("Missing required product file: " + rel);
  }
  const html = readText("app/index.html");
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
    if (!html.includes(needle)) throw new Error("GUI missing " + needle);
  }
  const appJs = readText("app/app.js");
  for (const needle of ["const I18N", "zh:", "en:", "applyLanguage", "lang: currentLang"]) {
    if (!appJs.includes(needle)) throw new Error("GUI i18n missing " + needle);
  }
}

async function assertGuiLoads() {
  const health = await requestJson("GET", "/api/health");
  if (!health.ok || health.playKitCount < 3) throw new Error("Unexpected health response");
  const html = await requestText("GET", "/app/");
  if (!html.includes("Toy Game Generator")) throw new Error("GUI did not load app shell");
}

async function assertCandidateApi() {
  const result = await requestJson("GET", "/api/candidates?theme=" + encodeURIComponent("算命游戏"));
  if (!Array.isArray(result.candidates) || !result.candidates.length) throw new Error("No candidates returned");
  const top = result.candidates[0];
  if (top.playKit !== "case-deduction" || top.styleKit !== "occult-archive") {
    throw new Error("Fortune candidate did not keep premium deduction route");
  }
}

async function assertGenerateApi() {
  const result = await requestJson("POST", "/api/generate", {
    theme: "算命游戏",
    lang: "zh",
    outDir: "examples/audit/gui-generated"
  });
  if (!result.ok) throw new Error("Generate API did not return ok");
  if (!result.gameUrl || !result.specUrl) throw new Error("Generate API missing preview URLs");
  if (!result.spec || result.spec.playKit !== "case-deduction") throw new Error("Generate API returned wrong spec");
  if (result.spec.lang !== "zh") throw new Error("Generate API did not pass through requested lang");
  if (!fs.existsSync(path.join(ROOT, result.files.html))) throw new Error("Generated HTML file missing");
  if (!fs.existsSync(path.join(ROOT, result.files.spec))) throw new Error("Generated spec file missing");
}

async function assertAiMissingKeyError() {
  const result = await requestJson("POST", "/api/generate", {
    theme: "赛车游戏",
    ai: true
  }, 400);
  if (!String(result.error || "").includes("DEEPSEEK_API_KEY")) {
    throw new Error("AI mode missing-key error did not mention DEEPSEEK_API_KEY");
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/preview.js", "--app", "--port", String(PORT), "--host", HOST], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let settled = false;
    let output = "";
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill();
        reject(new Error("Preview app server did not start. Output: " + output.trim()));
      }
    }, 4000);
    child.stdout.on("data", chunk => {
      output += chunk.toString();
      if (!settled && output.includes("http://" + HOST + ":" + PORT)) {
        settled = true;
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on("data", chunk => {
      output += chunk.toString();
    });
    child.on("exit", code => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("Preview app server exited with " + code + ". Output: " + output.trim()));
      }
    });
  });
}

function requestJson(method, pathname, body, expectedStatus = 200) {
  return request(method, pathname, body, expectedStatus).then(text => JSON.parse(text));
}

function requestText(method, pathname, body, expectedStatus = 200) {
  return request(method, pathname, body, expectedStatus);
}

function request(method, pathname, body, expectedStatus) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: pathname,
      method,
      headers: payload ? {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      } : {}
    }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode !== expectedStatus) {
          reject(new Error(method + " " + pathname + " expected " + expectedStatus + ", got " + res.statusCode + ": " + text));
        } else {
          resolve(text);
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function readJson(rel) {
  return JSON.parse(readText(rel));
}

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function cleanDir(dir) {
  const target = path.resolve(dir);
  if (!target.startsWith(ROOT)) throw new Error("Refusing to remove outside project: " + target);
  fs.rmSync(target, { recursive: true, force: true });
}
