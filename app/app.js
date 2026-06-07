"use strict";

const form = document.querySelector("[data-role='generate-form']");
const themeInput = document.querySelector("[data-role='theme-input']");
const difficultySelect = document.querySelector("[data-role='difficulty-select']");
const countSelect = document.querySelector("[data-role='count-select']");
const aiToggle = document.querySelector("[data-role='ai-toggle']");
const languageSelect = document.querySelector("[data-role='language-select']");
const listButton = document.querySelector("[data-role='list-button']");
const generateButton = document.querySelector("[data-role='generate-button']");
const candidateList = document.querySelector("[data-role='candidate-list']");
const preview = document.querySelector("[data-role='game-preview']");
const statusTitle = document.querySelector("[data-role='status-title']");
const statusDetail = document.querySelector("[data-role='status-detail']");
const downloadHtml = document.querySelector("[data-role='download-html']");
const downloadSpec = document.querySelector("[data-role='download-spec']");

let selectedCandidate = null;
let currentLang = localStorage.getItem("tgg-language") || "zh";

const I18N = {
  zh: {
    tagline: "一句话生成可玩的 HTML 小游戏",
    language: "语言",
    theme: "主题",
    difficulty: "难度",
    output: "输出",
    auto: "自动",
    mellow: "轻松",
    standard: "标准",
    espresso: "高压",
    oneGame: "一个游戏",
    threeCandidates: "三个候选",
    deepseek: "DeepSeek GameSpec",
    rank: "排序",
    generate: "生成",
    candidates: "候选",
    ready: "就绪",
    noGame: "还没有生成游戏",
    ranking: "排序中",
    rankingDetail: "正在读取可用玩法",
    chooseCandidate: "选择一个候选，或直接生成最高匹配",
    rankFailed: "排序失败",
    themeMissing: "缺少主题",
    enterTheme: "先输入一个主题",
    generating: "生成中",
    buildingOne: "正在生成可玩的 HTML",
    buildingMany: count => "正在生成 " + count + " 个候选",
    candidateSelected: "已选择候选",
    generateFailed: "生成失败"
  },
  en: {
    tagline: "Prompt to playable HTML",
    language: "Language",
    theme: "Theme",
    difficulty: "Difficulty",
    output: "Output",
    auto: "Auto",
    mellow: "Mellow",
    standard: "Standard",
    espresso: "Espresso",
    oneGame: "One game",
    threeCandidates: "Three candidates",
    deepseek: "DeepSeek GameSpec",
    rank: "Rank",
    generate: "Generate",
    candidates: "Candidates",
    ready: "Ready",
    noGame: "No game generated yet",
    ranking: "Ranking",
    rankingDetail: "Reading available play kits",
    chooseCandidate: "Choose a candidate or generate the top match",
    rankFailed: "Rank failed",
    themeMissing: "Theme missing",
    enterTheme: "Enter a theme first",
    generating: "Generating",
    buildingOne: "Building playable HTML",
    buildingMany: count => "Building " + count + " candidates",
    candidateSelected: "Candidate selected",
    generateFailed: "Generate failed"
  }
};

languageSelect.value = currentLang;
languageSelect.addEventListener("change", () => {
  currentLang = languageSelect.value;
  localStorage.setItem("tgg-language", currentLang);
  applyLanguage();
  setStatus(t("ready"), t("chooseCandidate"), "ok");
});
listButton.addEventListener("click", () => refreshCandidates());
form.addEventListener("submit", event => {
  event.preventDefault();
  generate();
});
themeInput.addEventListener("input", () => {
  selectedCandidate = null;
});

applyLanguage();
refreshCandidates();

async function refreshCandidates() {
  const theme = themeInput.value.trim();
  if (!theme) return;
  setBusy(true, t("ranking"), t("rankingDetail"));
  try {
    const result = await api("/api/candidates?theme=" + encodeURIComponent(theme) + "&limit=8");
    renderCandidates(result.candidates || []);
    setStatus(t("ready"), t("chooseCandidate"), "ok");
  } catch (error) {
    setStatus(t("rankFailed"), error.message, "error");
  } finally {
    setBusy(false);
  }
}

async function generate() {
  const theme = themeInput.value.trim();
  if (!theme) {
    setStatus(t("themeMissing"), t("enterTheme"), "error");
    return;
  }
  const count = Number(countSelect.value || 1);
  const jobs = [];
  const baseCandidate = selectedCandidate || {};
  for (let i = 0; i < count; i += 1) {
    jobs.push({
      theme,
      ai: aiToggle.checked,
      lang: currentLang,
      difficulty: difficultySelect.value || baseCandidate.difficulty || undefined,
      playKit: baseCandidate.playKit,
      styleKit: baseCandidate.styleKit,
      enemySet: baseCandidate.enemySet,
      outDir: "examples/gui"
    });
  }
  setBusy(true, t("generating"), count > 1 ? t("buildingMany", count) : t("buildingOne"));
  try {
    const results = [];
    for (const job of jobs) {
      results.push(await api("/api/generate", job));
      selectedCandidate = null;
    }
    const latest = results[results.length - 1];
    preview.src = latest.gameUrl;
    downloadHtml.href = latest.gameUrl;
    downloadHtml.hidden = false;
    downloadSpec.href = latest.specUrl;
    downloadSpec.hidden = false;
    setStatus(latest.spec.title, latest.spec.playKit + " / " + latest.spec.styleKit + " / " + latest.spec.difficulty, "ok");
    await refreshCandidates();
  } catch (error) {
    setStatus(t("generateFailed"), error.message, "error");
  } finally {
    setBusy(false);
  }
}

function renderCandidates(candidates) {
  candidateList.textContent = "";
  candidates.forEach((candidate, index) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = String(index + 1) + ". " + candidate.playKit + " / " + candidate.styleKit;
    const meta = document.createElement("span");
    meta.textContent = candidate.enemySet + " / " + candidate.difficulty + " / score " + candidate.score;
    item.append(title, meta);
    item.addEventListener("click", () => {
      selectedCandidate = candidate;
      Array.from(candidateList.children).forEach(node => node.style.borderColor = "");
      item.style.borderColor = "var(--accent)";
      setStatus(t("candidateSelected"), candidate.playKit + " / " + candidate.styleKit, "ok");
    });
    candidateList.appendChild(item);
  });
}

async function api(path, body) {
  const response = await fetch(path, body ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  } : undefined);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

function setBusy(busy, title, detail) {
  listButton.disabled = busy;
  generateButton.disabled = busy;
  if (busy) setStatus(title, detail);
}

function setStatus(title, detail, tone) {
  statusTitle.textContent = title || "Ready";
  statusDetail.textContent = detail || "";
  statusDetail.className = tone === "error" ? "is-error" : tone === "ok" ? "is-ok" : "";
}

function applyLanguage() {
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.getAttribute("data-i18n"));
  }
}

function t(key, arg) {
  const value = (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
  return typeof value === "function" ? value(arg) : value;
}
