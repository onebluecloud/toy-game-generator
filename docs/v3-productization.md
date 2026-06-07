# Toy Game Generator v3 Productization

## Goal

Make the generator usable by three audiences:

- Codex users through `toy-game-maker`.
- Developers through the CLI.
- Non-Codex users through a bilingual local GUI.

The non-Codex path is the local web GUI. A user runs `npm run app`, opens the local URL, enters a theme, optionally enables DeepSeek GameSpec mode, previews the generated game, and downloads the HTML/GameSpec files.

## Current Product Entry Points

### Codex Skill

Codex users can invoke `toy-game-maker`; the skill routes productized work to this generator project.

### CLI

```powershell
npm run generate -- --theme "算命游戏"
npm run generate -- --theme "守护咖啡店塔防游戏" --list
npm run validate
npm run audit
```

### Chinese/English GUI

```powershell
npm run app
```

Open:

```text
http://127.0.0.1:8787/app/
```

The GUI ranks candidates, generates HTML games, previews them in an iframe, and exposes download links for the HTML and GameSpec files.

The language selector is also passed into game generation. Generated games carry `GameSpec.lang` and `GameSpec.strings`, so UI chrome follows Chinese or English instead of being hard-coded in templates.

### Optional DeepSeek Mode

DeepSeek is optional and only maps a natural-language prompt to allowed catalog IDs. It does not write game code.

```powershell
$env:DEEPSEEK_API_KEY="your_key"
npm run app
```

## Current Renderable Play Kits

- `horde-survival`
- `runner-lane`
- `case-deduction`
- `tower-defense`
- `deck-builder`
- `match-puzzle`
- `physics-arc`
- `rhythm-tap`
- `platform-climb`
- `idle-automation`
- `grid-tactics`

Current catalog scale: 17 play kits, 6 style kits, 12 enemy kits, 25 mechanic kits, and 13824 ranked candidate combinations before theme scoring.

## Text System

The v3 renderer separates:

- UI chrome: common and play-kit strings in `kits/strings/en.json` and `kits/strings/zh.json`.
- Theme content: titles and roles derived from the user theme and play kit.

Templates use `<html lang="{{LANG}}">` and `SPEC.strings`. Audit guards prevent CJK text from returning to templates and verify generated HTML language matches `spec.lang`.

Known boundary: `case-deduction` still has fixed sample clue/case fiction. Its chrome is localized, but fully theme-generated case content is a later feature.

## Future Expansion Candidates

- `fishing-timing`
- `stealth-light`
- `word-trivia`
- `pinball-bounce`

Each future play kit must add a template, catalog metadata, theme mapping, audit coverage, generated example, and browser verification.

## Packaging Path

The current GUI is a local Node web app. For users who should not touch a terminal at all, wrap the same `/app/` and `/api/*` server in Electron, Tauri, or a small signed desktop launcher. Do not let the GUI call an LLM to write arbitrary game code; DeepSeek should remain a GameSpec interpreter that selects allowed catalog IDs.

## Verification Gates

```powershell
npm run validate
npm run audit
```

Browser verification should cover the GUI and at least one generated game per new play kit.
