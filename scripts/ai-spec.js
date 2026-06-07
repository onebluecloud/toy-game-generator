#!/usr/bin/env node
"use strict";

const https = require("https");

const DEFAULT_BASE_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

async function resolveAiOverrides(theme, catalogs, options = {}) {
  const apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("AI mode requires DEEPSEEK_API_KEY. Run without AI mode or set DEEPSEEK_API_KEY first.");
  }
  const baseUrl = options.baseUrl || process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;
  const model = options.model || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
  const response = await postJson(baseUrl, apiKey, {
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "Return strict JSON only.",
          "Map the user's game theme into one existing toy-game-generator candidate.",
          "Never invent ids. Use only ids from the provided catalogs.",
          "Fields: playKit, styleKit, enemySet, difficulty, maturityLevel, coreExperience."
        ].join(" ")
      },
      {
        role: "user",
        content: JSON.stringify({
          theme,
          allowed: {
            playKits: catalogs.playKits.map(item => item.id),
            styleKits: catalogs.styleKits.map(item => item.id),
            enemySets: catalogs.enemyKits.map(item => item.id),
            difficulties: ["mellow", "standard", "espresso"],
            maturityLevels: ["toy", "casual", "arcade", "premium", "satirical"]
          }
        })
      }
    ]
  });
  const content = response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content;
  if (!content) throw new Error("DeepSeek response did not include a message.");
  return sanitizeOverrides(parseJsonContent(content), catalogs);
}

function sanitizeOverrides(raw, catalogs) {
  const out = {};
  const playIds = new Set(catalogs.playKits.map(item => item.id));
  const styleIds = new Set(catalogs.styleKits.map(item => item.id));
  const enemyIds = new Set(catalogs.enemyKits.map(item => item.id));
  if (raw.playKit && playIds.has(raw.playKit)) out.playKit = raw.playKit;
  if (raw.styleKit && styleIds.has(raw.styleKit)) out.styleKit = raw.styleKit;
  if (raw.enemySet && enemyIds.has(raw.enemySet)) out.enemySet = raw.enemySet;
  if (raw.difficulty && ["mellow", "standard", "espresso"].includes(raw.difficulty)) out.difficulty = raw.difficulty;
  if (raw.maturityLevel && ["toy", "casual", "arcade", "premium", "satirical"].includes(raw.maturityLevel)) out.maturityLevel = raw.maturityLevel;
  if (typeof raw.coreExperience === "string" && raw.coreExperience.trim()) out.coreExperience = raw.coreExperience.trim();
  return out;
}

function parseJsonContent(content) {
  const trimmed = String(content || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function postJson(endpoint, apiKey, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(endpoint);
    const payload = JSON.stringify(body);
    const req = https.request({
      method: "POST",
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error("DeepSeek request failed with " + res.statusCode + ": " + text.slice(0, 300)));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error("DeepSeek returned invalid JSON: " + error.message));
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { resolveAiOverrides, sanitizeOverrides, parseJsonContent };

if (require.main === module) {
  const themeIndex = process.argv.indexOf("--theme");
  const theme = themeIndex >= 0 ? process.argv[themeIndex + 1] : "";
  if (!theme) {
    console.error("[FAIL] Missing --theme");
    process.exit(1);
  }
  console.error("[FAIL] ai-spec.js is a helper module for the local app server; use npm run app.");
  process.exit(1);
}
