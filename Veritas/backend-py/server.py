#!/usr/bin/env python3
"""Veritas backend — stdlib-only HTTP server."""

import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

WEB_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    try:
        handler.wfile.write(body)
    except (BrokenPipeError, ConnectionResetError):
        pass


def _read_body(handler):
    length = int(handler.headers.get("Content-Length", "0") or 0)
    if length <= 0:
        return b""
    return handler.rfile.read(length)


def _ext_from_mime(mime):
    mapping = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/gif": ".gif",
        "image/bmp": ".bmp",
        "image/tiff": ".tif",
        "image/webp": ".webp",
    }
    return mapping.get((mime or "").lower(), ".png")


def parse_multipart(body, content_type):
    result = {}
    boundary = None
    for seg in (content_type or "").split(";"):
        seg = seg.strip()
        if seg.lower().startswith("boundary="):
            boundary = seg[len("boundary="):].strip()
            if boundary.startswith('"') and boundary.endswith('"'):
                boundary = boundary[1:-1]
    if not boundary:
        return result

    delim = ("--" + boundary).encode("latin-1")
    for part in body.split(delim):
        if part.startswith(b"\r\n"):
            part = part[2:]
        elif part.startswith(b"\n"):
            part = part[1:]
        if part in (b"", b"--", b"--\r\n", b"--\n"):
            continue
        if part.endswith(b"--"):
            part = part[:-2]
        if part.endswith(b"\r\n"):
            part = part[:-2]
        elif part.endswith(b"\n"):
            part = part[:-1]
        if b"\r\n\r\n" in part:
            headers, content = part.split(b"\r\n\r\n", 1)
            sep = b"\r\n"
        elif b"\n\n" in part:
            headers, content = part.split(b"\n\n", 1)
            sep = b"\n"
        else:
            continue

        name = None
        filename = None
        mime = "application/octet-stream"
        for line in headers.split(sep):
            try:
                hl = line.decode("utf-8", "replace")
            except Exception:
                hl = line.decode("latin-1")
            low = hl.lower().strip()
            if low.startswith("content-disposition:"):
                for seg2 in hl.split(";"):
                    seg2 = seg2.strip()
                    low2 = seg2.lower()
                    if low2.startswith("name="):
                        name = seg2[5:].strip().strip('"')
                    elif low2.startswith("filename="):
                        filename = seg2[9:].strip().strip('"')
            elif low.startswith("content-type:"):
                mime = hl.split(":", 1)[1].strip()

        if name is not None:
            result[name] = (filename, mime, content)
    return result


def _parse_tsv(tsv_text):
    lines = tsv_text.splitlines()
    if not lines:
        return "", 0

    header = lines[0].split("\t")
    try:
        i_level = header.index("level")
        i_page = header.index("page_num")
        i_block = header.index("block_num")
        i_par = header.index("par_num")
        i_line = header.index("line_num")
        i_conf = header.index("conf")
        i_text = header.index("text")
    except ValueError:
        return tsv_text.strip(), 0

    line_words = {}
    line_order = []
    confs = []

    for row in lines[1:]:
        cols = row.split("\t")
        if len(cols) < len(header):
            cols = cols + [""] * (len(header) - len(cols))
        if cols[i_level].strip() != "5":
            continue
        word = cols[i_text]
        try:
            conf = float(cols[i_conf])
        except (ValueError, TypeError):
            conf = 0.0
        if conf < 0:
            conf = 0.0

        key = (cols[i_page], cols[i_block], cols[i_par], cols[i_line])
        if key not in line_words:
            line_words[key] = []
            line_order.append(key)
        line_words[key].append((word, conf))
        if word.strip():
            confs.append(conf)

    text_lines = []
    for key in line_order:
        words = [w for w, _ in line_words[key] if w != ""]
        if words:
            text_lines.append(" ".join(words))

    text = "\n".join(text_lines).strip()
    avg = round(sum(confs) / len(confs), 1) if confs else 0
    return text, avg


def run_tesseract(image_path, language="eng"):
    tesseract_bin = shutil.which("tesseract")
    if not tesseract_bin:
        return {
            "text": "",
            "confidence": 0,
            "language": language,
            "error": "tesseract is not installed on the server",
        }

    cmd = [tesseract_bin, image_path, "stdout", "tsv", "-l", language]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return {"text": "", "confidence": 0, "language": language, "error": "OCR timed out"}
    except Exception as exc:
        return {"text": "", "confidence": 0, "language": language, "error": str(exc)}

    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        if language and language.lower() not in ("eng", "en", "english"):
            return run_tesseract(image_path, "eng")
        return {"text": "", "confidence": 0, "language": language, "error": stderr or "tesseract failed"}

    text, conf = _parse_tsv(proc.stdout or "")
    return {"text": text, "confidence": conf, "language": language}


def mock_factcheck(claim):
    claim = (claim or "").strip() or "Sample claim (no claim provided)"
    return {
        "claims": [
            {
                "text": claim,
                "claimant": "Unknown",
                "claimReview": [
                    {
                        "publisher": "Veritas Mock Fact Check",
                        "url": "https://example.com/veritas/mock-factcheck",
                        "title": "Mock review — no Google Fact Check API key configured",
                        "reviewDate": "2026-01-01",
                        "textualRating": "Unverified",
                    }
                ],
            }
        ],
        "mock": True,
        "note": "Set GOOGLE_FACTCHECK_KEY or pass ?key= to use the real Google Fact Check Tools API.",
    }


class VeritasHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/health":
            _json_response(self, 200, {"status": "ok", "service": "veritas"})
            return
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        if route == "/api/ocr":
            self._handle_ocr(parsed)
        elif route == "/api/factcheck":
            self._handle_factcheck(parsed)
        else:
            _json_response(self, 404, {"error": "not found"})

    def _handle_ocr(self, parsed):
        try:
            raw = _read_body(self)
            ct = self.headers.get("Content-Type", "")
            image_bytes = None
            mime = "image/png"
            language = "eng"
            filename = None

            is_json = "application/json" in ct or raw.lstrip().startswith(b"{")
            if is_json:
                try:
                    data = json.loads(raw.decode("utf-8"))
                except Exception:
                    data = {}
                b64 = (data.get("image") or data.get("data")
                       or data.get("base64") or data.get("file"))
                if isinstance(b64, str):
                    s = b64.strip()
                    if s.startswith("data:"):
                        if "," in s:
                            header, s = s.split(",", 1)
                            if ":" in header and ";" in header:
                                mime = header.split(":", 1)[1].split(";", 1)[0].strip() or mime
                    s = "".join(s.split())
                    try:
                        image_bytes = base64.b64decode(s, validate=False)
                    except Exception:
                        image_bytes = None
                mime = data.get("mime") or data.get("mimeType") or mime
                language = data.get("language") or data.get("lang") or language
                filename = data.get("filename")

            elif "multipart/form-data" in ct:
                files = parse_multipart(raw, ct)
                preferred = ("image", "file", "upload", "photo")
                chosen = None
                for name in preferred:
                    if name in files:
                        chosen = files[name]
                        break
                if chosen is None and files:
                    chosen = next(iter(files.values()))
                if chosen is not None:
                    filename, fct, content = chosen
                    image_bytes = content
                    if fct and fct != "application/octet-stream":
                        mime = fct

            if not image_bytes:
                _json_response(self, 400, {
                    "error": "no image provided",
                    "text": "", "confidence": 0, "language": language,
                })
                return

            ext = None
            if filename and "." in filename:
                ext = os.path.splitext(filename)[1]
            if not ext:
                ext = _ext_from_mime(mime)

            fd, tmp_path = tempfile.mkstemp(suffix=ext, prefix="veritas_ocr_")
            try:
                with os.fdopen(fd, "wb") as f:
                    f.write(image_bytes)
                result = run_tesseract(tmp_path, language)
                result.setdefault("text", "")
                result.setdefault("confidence", 0)
                result.setdefault("language", language)
                status = 200
                if result.get("error") and not result.get("text"):
                    if "not installed" in result["error"]:
                        status = 503
                    else:
                        status = 422
                _json_response(self, status, result)
            finally:
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

        except Exception as exc:
            _json_response(self, 500, {
                "error": str(exc),
                "text": "", "confidence": 0, "language": "eng",
            })

    def _handle_factcheck(self, parsed):
        try:
            raw = _read_body(self)
            try:
                data = json.loads(raw.decode("utf-8")) if raw else {}
            except Exception:
                data = {}
            claim = (data.get("claim") or data.get("text")
                     or data.get("query") or "").strip()

            qs = urllib.parse.parse_qs(parsed.query)
            key = None
            for k in ("key", "api_key", "apiKey"):
                if qs.get(k):
                    key = qs[k][0]
                    break
            if not key:
                key = os.environ.get("GOOGLE_FACTCHECK_KEY") or os.environ.get(
                    "FACT_CHECK_API_KEY") or os.environ.get("FACTCHECK_API_KEY")

            if not key:
                _json_response(self, 200, mock_factcheck(claim))
                return

            params = {"query": claim, "key": key}
            lang = data.get("languageCode") or data.get("language")
            if lang:
                params["languageCode"] = lang
            url = "https://factchecktools.googleapis.com/v1alpha1/claims:search?" + urllib.parse.urlencode(params)

            try:
                req = urllib.request.Request(url, headers={"Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=20) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                body = e.read().decode("utf-8", "replace")
                _json_response(self, e.code, {"error": body})
                return
            except Exception as exc:
                _json_response(self, 502, {"error": str(exc)})
                return

            claims = []
            for c in payload.get("claims", []) or []:
                reviews = []
                for cr in c.get("claimReview", []) or []:
                    publisher = cr.get("publisher")
                    if isinstance(publisher, dict):
                        publisher = publisher.get("name") or publisher.get("site")
                    reviews.append({
                        "publisher": publisher,
                        "url": cr.get("url"),
                        "title": cr.get("title"),
                        "reviewDate": cr.get("reviewDate"),
                        "textualRating": cr.get("textualRating"),
                    })
                claims.append({
                    "text": c.get("text"),
                    "claimant": c.get("claimant"),
                    "claimReview": reviews,
                })

            _json_response(self, 200, {"claims": claims})

        except Exception as exc:
            _json_response(self, 500, {"error": str(exc), "claims": []})

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


def main():
    parser = argparse.ArgumentParser(description="Veritas backend server")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    parser.add_argument("--host", default="0.0.0.0", help="Host/interface to bind")
    args = parser.parse_args()

    httpd = ThreadingHTTPServer((args.host, args.port), VeritasHandler)
    httpd.allow_reuse_address = True
    print(f"Veritas backend running at http://{args.host}:{args.port}", flush=True)
    print(f"Serving static files from: {WEB_ROOT}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
