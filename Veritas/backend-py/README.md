# Veritas Backend

Stdlib-only HTTP server for the Veritas misinformation detector.

## Run

```bash
python3 backend/server.py --port 8000
```

Or from the project root:

```bash
./run.sh
```

## Endpoints

- `GET /api/health` — returns `{"status":"ok"}`.
- `POST /api/ocr` — OCR an image.
  - JSON body: `{"image": "<base64>", "mime": "image/png", "language": "eng"}`.
    `image` may also be a data URL (`data:image/png;base64,...`).
  - Or `multipart/form-data` with a file field (`image`/`file`/`upload`).
  - Response: `{"text": "...", "confidence": 87.5, "language": "eng"}`.
  - Returns 503 if tesseract is not installed, 422 on OCR failure.
- `POST /api/factcheck` — fact-check a claim.
  - JSON body: `{"claim": "..."}`.
  - API key via `?key=` query param or `GOOGLE_FACTCHECK_KEY` env var.
  - If no key, returns mock results.
  - Response: `{"claims": [{"text", "claimant", "claimReview": [{"publisher", "url", "title", "reviewDate", "textualRating"}]}]}`.

## Static files

The server also serves the frontend (project root) at `/`, so a single process runs everything.

## Environment variables

- `GOOGLE_FACTCHECK_KEY` (or `FACT_CHECK_API_KEY` / `FACTCHECK_API_KEY`) — Google Fact Check Tools API key.
- `PORT` — used by `run.sh` (default 8000).

## Dependencies

- Python 3.8+ (stdlib only).
- `tesseract` system binary for OCR.
