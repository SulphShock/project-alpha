# Veritas Backend (Rust)

Std-only Rust HTTP server for the Veritas misinformation detector. No external crates.

## Build & Run

```bash
cd backend
cargo build --release
ROOT_DIR=/path/to/project ./target/release/veritas-backend
```

Or from the project root:

```bash
./run.sh          # builds + runs on port 8000
PORT=9000 ./run.sh
```

## Endpoints

- `GET /api/health` — `{"status":"ok","service":"veritas"}`
- `POST /api/ocr` — `{image: base64, mime}` → `{text, confidence, language}`
- `POST /api/factcheck` — `{claim}` → Google Fact Check (via curl) or mock

## Environment variables

- `PORT` (default 8000), `HOST` (default 127.0.0.1)
- `ROOT_DIR` — project root for static files (set by run.sh)
- `GOOGLE_FACTCHECK_KEY` / `FACT_CHECK_API_KEY` / `FACTCHECK_API_KEY` — Google Fact Check API key

## Dependencies

- Rust toolchain (cargo/rustc)
- `tesseract` system binary for OCR
- `curl` for fact-check proxy (HTTPS)
