#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Error: python3 not found." >&2
    exit 1
fi

if ! command -v tesseract >/dev/null 2>&1; then
    echo "Warning: tesseract is not installed. The /api/ocr endpoint will be unavailable."
    echo "Install it with: sudo apt install tesseract-ocr   (Debian/Ubuntu)"
fi

echo "Starting Veritas backend (Python, stdlib-only) on $HOST:$PORT..."
echo "Open: http://$HOST:$PORT"
exec python3 "$ROOT/backend-py/server.py" --port "$PORT" --host "$HOST"
