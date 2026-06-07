#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const url = require("url");
const { spawnSync } = require("child_process");
const { resolveAiOverrides } = require("./ai-spec");

const ROOT = path.resolve(__dirname, "..");
const APP_ROOT = path.join(ROOT, "app");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon"
};

const args = parseArgs(process.argv.slice(2));
const port = Number(args.port || process.env.PORT || 8787);
const host = args.host || "127.0.0.1";
const appMode = Boolean(args.app);

const server = http.createServer(async (req, res) => {
  try {
    const parsed = url.parse(req.url || "/", true);
    if (appMode && parsed.pathname && parsed.pathname.startsWith("/api/")) {
      await handleApi(req, res, parsed);
      return;
    }
    if (appMode && (parsed.pathname === "/" || parsed.pathname === "/app")) {
      redirect(res, "/app/");
      return;
    }
    if (appMode && parsed.pathname && parsed.pathname.startsWith("/app/")) {
      serveApp(res, parsed.pathname);
      return;
    }
    serveProjectPath(res, parsed.pathname || "/");
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(port, host, () => {
  const rootPath = appMode ? "/app/" : "/examples/";
  console.log("[OK] Preview server running at http://" + host + ":" + port + rootPath);
});

async function handleApi(req, res, parsed) {
  if (req.method === "GET" && parsed.pathname === "/api/health") {
    const catalogs = loadCatalogs();
    sendJson(res, 200, {
      ok: true,
      playKitCount: catalogs.playKits.length,
      styleKitCount: catalogs.styleKits.length,
      enemyKitCount: catalogs.enemyKits.length
    });
    return;
  }
  if (req.method === "GET" && parsed.pathname === "/api/candidates") {
    const theme = String(parsed.query.theme || "").trim();
    if (!theme) return sendJson(res, 400, { ok: false, error: "theme is required" });
    const limit = Number(parsed.query.limit || 8);
    sendJson(res, 200, { ok: true, candidates: listCandidates(theme, limit) });
    return;
  }
  if (req.method === "POST" && parsed.pathname === "/api/generate") {
    const body = await readBodyJson(req);
    const theme = String(body.theme || "").trim();
    if (!theme) return sendJson(res, 400, { ok: false, error: "theme is required" });
    try {
      const aiOverrides = body.ai ? await resolveAiOverrides(theme, loadCatalogs()) : {};
      const result = generateGame({
        theme,
        outDir: body.outDir,
        lang: body.lang,
        playKit: body.playKit || aiOverrides.playKit,
        styleKit: body.styleKit || aiOverrides.styleKit,
        enemySet: body.enemySet || aiOverrides.enemySet,
        difficulty: body.difficulty || aiOverrides.difficulty
      });
      sendJson(res, 200, { ok: true, ...result, aiOverrides });
    } catch (error) {
      sendJson(res, body.ai ? 400 : 500, { ok: false, error: error.message });
    }
    return;
  }
  sendJson(res, 404, { ok: false, error: "API route not found" });
}

function serveApp(res, pathname) {
  const rel = pathname === "/app/" ? "index.html" : pathname.replace(/^\/app\//, "");
  const target = safeJoin(APP_ROOT, "/" + rel);
  if (!target) return send(res, 403, "Forbidden");
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) return send(res, 404, "Not found");
  serveFile(res, target);
}

function serveProjectPath(res, pathname) {
  const rel = decodeURIComponent(pathname === "/" ? "/examples/" : pathname);
  const target = safeJoin(ROOT, rel);
  if (!target) return send(res, 403, "Forbidden");
  if (!fs.existsSync(target)) return send(res, 404, "Not found");
  const stat = fs.statSync(target);
  if (stat.isDirectory()) return sendDirectory(res, target, rel);
  serveFile(res, target);
}

function serveFile(res, target) {
  const type = MIME[path.extname(target).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(target).pipe(res);
}

function listCandidates(theme, limit) {
  const result = runNode(["scripts/generate.js", "--theme", theme, "--list", "--limit", String(limit || 8)]);
  return result.stdout.split(/\r?\n/)
    .filter(line => /^\s*\d+\s+\|/.test(line))
    .map(row => {
      const parts = row.split("|").map(item => item.trim());
      return {
        score: Number(parts[0]),
        playKit: parts[1],
        styleKit: parts[2],
        enemySet: parts[3],
        difficulty: parts[4],
        mechanics: parts[5] ? parts[5].split("+").filter(Boolean) : []
      };
    });
}

function generateGame(options) {
  const outDir = safeOutputDir(options.outDir || "examples/gui");
  fs.mkdirSync(outDir.abs, { recursive: true });
  const base = slugify(options.theme) + "-" + Date.now().toString(36);
  const htmlRel = path.posix.join(outDir.rel, base + ".html");
  const specRel = path.posix.join(outDir.rel, base + ".spec.json");
  const nodeArgs = [
    "scripts/generate.js",
    "--theme", options.theme,
    "--out", htmlRel,
    "--spec-out", specRel
  ];
  if (options.playKit) nodeArgs.push("--play-kit", options.playKit);
  if (options.styleKit) nodeArgs.push("--style-kit", options.styleKit);
  if (options.enemySet) nodeArgs.push("--enemy-set", options.enemySet);
  if (options.difficulty) nodeArgs.push("--difficulty", options.difficulty);
  if (options.lang) nodeArgs.push("--lang", options.lang);
  runNode(nodeArgs);
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, specRel), "utf8"));
  return {
    files: { html: htmlRel, spec: specRel },
    gameUrl: "/" + htmlRel,
    specUrl: "/" + specRel,
    spec
  };
}

function safeOutputDir(input) {
  const normalized = String(input || "examples/gui").replace(/\\/g, "/").replace(/^\/+/, "");
  const abs = path.resolve(ROOT, normalized);
  if (!abs.startsWith(ROOT)) throw new Error("outDir must stay inside the project");
  return { abs, rel: normalized };
}

function runNode(nodeArgs) {
  const result = spawnSync(process.execPath, nodeArgs, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0) {
    throw new Error(((result.stdout || "") + (result.stderr || "")).trim() || "Command failed: node " + nodeArgs.join(" "));
  }
  return result;
}

function loadCatalogs() {
  return {
    playKits: readJson("kits/play-kits.json"),
    styleKits: readJson("kits/style-kits.json"),
    enemyKits: readJson("kits/enemy-kits.json")
  };
}

function sendDirectory(res, dir, rel) {
  const rows = fs.readdirSync(dir).sort().map(name => {
    const href = path.posix.join(rel.replace(/\\/g, "/"), name);
    return "<li><a href=\"" + escapeHtml(href) + "\">" + escapeHtml(name) + "</a></li>";
  }).join("");
  send(res, 200, "<!doctype html><meta charset=\"utf-8\"><title>toy-game-generator</title><h1>toy-game-generator</h1><ul>" + rows + "</ul>", "text/html; charset=utf-8");
}

function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    let text = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      text += chunk;
      if (text.length > 1024 * 1024) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try {
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value, null, 2), "application/json; charset=utf-8");
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function safeJoin(root, rel) {
  const normalized = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const target = path.resolve(root, "." + normalized);
  return target.startsWith(root) ? target : null;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port") out.port = argv[++i];
    else if (arg === "--host") out.host = argv[++i];
    else if (arg === "--app") out.app = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/preview.js [--app] [--port 8787] [--host 127.0.0.1]");
      process.exit(0);
    } else {
      console.error("[FAIL] Unknown argument: " + arg);
      process.exit(1);
    }
  }
  return out;
}

function escapeHtml(input) {
  return String(input).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function slugify(input) {
  const ascii = String(input || "game").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (ascii) return ascii.slice(0, 48);
  let hash = 0;
  for (const ch of String(input)) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return "game-" + Math.abs(hash).toString(36);
}
