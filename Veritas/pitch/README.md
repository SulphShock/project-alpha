# Veritas — Pitch Deck

File: `Veritas.pptx` (10 slides). Built with python-pptx in a warm paper theme
(paper background #e6e2d8, terracotta accent #a77a65, DM Serif Display titles).

## How to present (7 minutes)

Follow the demo script in the project `README.md`. Slide order:

1. **Title** — introduce Veritas, team, Kreativity Show Sr.
2. **The Problem** — misinformation spreads 6× faster; teens most affected.
3. **Our Solution** — paste any content → credibility score in 3 seconds.
4. **How It Works** — input → heuristic NLP + source check + privacy scan → verdict + rewrite.
5. **Live Demo** — paste the "Viral WhatsApp forward" sample → score 2/100; walk through red flags, claim verdicts, safe rewrite, privacy scan.
6. **Challenge Mode** — invite an audience member to play "Spot the Fake"; show leaderboard.
7. **Teacher Dashboard** — class overview, weak-topics chart, suggested lessons.
8. **Impact & Scalability** — local-first, no data leaves device; schools, parents.
9. **Tech Stack** — vanilla JS, heuristic NLP, optional OCR backend, Anchor primitive.
10. **Team & Ask** — 3-person team, roadmap, ask (pilot with 5 schools).

## Tips

- Run the app beforehand (`python -m http.server 8000` or open `index.html`) so the live demo is instant.
- Pre-load the "Viral WhatsApp forward" sample so analysis completes in ~3 seconds.
- Use Presenter view; notes are not embedded, so keep this README open.
- Keep the chart on slide 7 visible while discussing weak topics.
- If offline, the app still works with cached samples.

## Regenerating

```bash
python3 /tmp/opencode/build_pitch.py
```

(Re-run after editing the script; output overwrites `Veritas.pptx`.)
