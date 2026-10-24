# Veritas — Misinformation & Digital Safety Platform

A working prototype for **Kreativity Show Sr.** (Media & Digital Safety theme).
Paste any message, article, or social post → get a credibility score, claim-by-claim
verdicts, red flags, a safe rewrite, and privacy-risk assessment. Plus a
"Spot the Fake" game mode and a teacher dashboard tracking class digital literacy.

## Run
Just open `index.html` in a browser. No build step, no backend, no API keys.
Optional: serve locally with `python -m http.server 8000`.

## Features
- **Analyzer** — heuristic NLP scoring (sensationalism, emotional charge, clickbait, caps, sources, data).
- **Claim-by-claim** verdicts + red-flag list + de-sensationalized rewrite.
- **Privacy risk** detection (phone, email, card, password, location).
- **URL analysis** — domain reputation, HTTPS, suspicious TLDs.
- **Image metadata** analysis (OCR hook for backend).
- **Anchor primitive** — create stable deep-references to any fragment (the "mouse").
- **Challenge mode** — 10-round "Spot the Fake" game with leaderboard.
- **Teacher dashboard** — class overview, weak topics, activity, suggested lessons.
- **Learn tab** — digital safety toolkit + red-flag checklist.

## 3-Day Build Plan (3 people)

### Day 1 — Foundation
- Person A: analyzer engine (scoring, claims, privacy, rewrite) — `analyzer.js`
- Person B: UI shell + Analyze tab + results rendering — `index.html`, `style.css`, `main.js`
- Person C: data + samples + challenge content — `data.js`

### Day 2 — Features
- Person A: URL/image analysis + Anchor primitive — `anchors.js`
- Person B: Challenge mode + leaderboard
- Person C: Dashboard + Learn tab + polish

### Day 3 — Demo
- All: bug fixes, edge cases, offline fallback with cached examples
- Person C: 7-min demo script + pitch deck + video recording

## Team split
- **Person A (Data/NLP):** `analyzer.js`, `anchors.js`, scoring logic.
- **Person B (Frontend):** `index.html`, `style.css`, `main.js`, rendering.
- **Person C (Content/Game/Demo):** `data.js`, challenge mode, dashboard, demo script, video.

## 7-Minute Demo Script
1. (0:00) Problem: misinformation spreads 6x faster than truth on social media.
2. (0:45) Demo: paste a viral WhatsApp forward → score 2/100 in 3 seconds, red flags listed.
3. (2:00) Claim-by-claim walkthrough + safe rewrite.
4. (3:00) Privacy risk detection on a message containing a phone number.
5. (3:30) URL analysis of a suspicious link.
6. (4:00) Anchor primitive: create a stable reference to a sentence, share it.
7. (4:30) Challenge mode: audience member tries to beat the AI; leaderboard.
8. (5:30) Teacher dashboard: class weak topics + suggested lessons.
9. (6:15) Impact: scalable to schools, local-first, no data leaves the device.
10. (6:45) Q&A.

## Rubric mapping
- Problem Solving (20): specific, well-analyzed problem.
- STEAM (20): NLP pipeline, scoring model, system design, functional prototype.
- Innovation (20): multi-modal + game layer + teacher insights + local-first.
- Communication (20): 3-second demo + 7-min structured script.
- Teamwork (20): clean 3-way split with clear interfaces.

## Files
| File | Purpose |
|---|---|
| `index.html` | App shell + tabs |
| `style.css` | Dark theme |
| `main.js` | Router, state, analyze/challenge/dashboard flows |
| `analyzer.js` | Heuristic NLP engine |
| `anchors.js` | Anchor primitive |
| `data.js` | Samples, challenge items, toolkit, weak topics |
| `README.md` | This file |

## Backend (OCR + Fact-Check)
Run `./run.sh` (port 8000). The backend serves the frontend too, so a single
process runs everything. Endpoints:
- `GET /api/health`
- `POST /api/ocr` — `{image: base64, mime}` → `{text, confidence, language}`
- `POST /api/factcheck` — `{claim}` → Google Fact Check or mock

Set `GOOGLE_FACTCHECK_KEY` for real fact-checks. Tesseract must be installed
for OCR (`sudo apt install tesseract-ocr`).

## Pitch deck
`pitch/Veritas.pptx` — 10 slides, dark theme, includes weak-topics chart.
See `pitch/README.md`.

## Teacher mode
Click "Teacher login" in the header, password `teacher`. Unlocks the Dashboard
tab with real activity data (stored in localStorage).

## Backend (Rust)
Run `./run.sh` (port 8000). Rust std-only backend; OCR via tesseract, fact-check via curl (or mock). See `backend/README.md`.
