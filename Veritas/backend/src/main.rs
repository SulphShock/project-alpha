// Veritas backend — Rust, std only. Serves frontend + /api/health, /api/ocr, /api/factcheck.
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::Command;
use std::thread;

const ROOT: &str = "../../.."; // default; overridden by ROOT_DIR env

fn main() {
    let port: u16 = std::env::var("PORT")
        .ok().and_then(|s| s.parse().ok()).unwrap_or(8000);
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = TcpListener::bind(&addr).expect("bind failed");
    println!("Veritas backend (Rust) running at http://{}", addr);
    println!("Serving static files from project root.");
    for stream in listener.incoming() {
        match stream {
            Ok(s) => { thread::spawn(move || handle(s)); }
            Err(_) => {}
        }
    }
}

fn project_root() -> String {
    std::env::var("ROOT_DIR").unwrap_or_else(|_| ROOT.to_string())
}

fn handle(mut stream: TcpStream) {
    let mut reader = BufReader::new(stream.try_clone().unwrap());
    let mut request_line = String::new();
    if reader.read_line(&mut request_line).is_err() { return; }
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 { return; }
    let method = parts[0];
    let path = parts[1].to_string();

    // read headers
    let mut headers = Vec::new();
    let mut content_length: usize = 0;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).is_err() { break; }
        let t = line.trim_end_matches(['\r','\n']).to_string();
        if t.is_empty() { break; }
        if let Some((k,v)) = t.split_once(':') {
            let kl = k.trim().to_lowercase();
            if kl == "content-length" { content_length = v.trim().parse().unwrap_or(0); }
            headers.push((kl, v.trim().to_string()));
        }
    }
    // read body
    let mut body = vec![0u8; content_length];
    if content_length > 0 { let _ = reader.read_exact(&mut body); }

    let origin = header_val(&headers, "origin").unwrap_or_else(|| "*".to_string());

    // routing
    let (status, ctype, payload) = if method == "OPTIONS" {
        (204, "text/plain", Vec::new())
    } else if path == "/api/health" {
        (200, "application/json", b"{\"status\":\"ok\",\"service\":\"veritas\"}".to_vec())
    } else if path == "/api/ocr" && method == "POST" {
        handle_ocr(&body)
    } else if path.starts_with("/api/factcheck") && method == "POST" {
        handle_factcheck(&body, &path)
    } else {
        serve_static(&path)
    };

    // write response
    let mut resp = Vec::new();
    let reason = match status { 200=>"OK",204=>"No Content",404=>"Not Found",400=>"Bad Request",500=>"Internal Server Error",_=>"OK" };
    resp.extend_from_slice(format!("HTTP/1.1 {} {}\r\n", status, reason).as_bytes());
    resp.extend_from_slice(format!("Content-Type: {}\r\n", ctype).as_bytes());
    resp.extend_from_slice(format!("Content-Length: {}\r\n", payload.len()).as_bytes());
    resp.extend_from_slice(format!("Access-Control-Allow-Origin: {}\r\n", origin).as_bytes());
    resp.extend_from_slice(b"Access-Control-Allow-Methods: GET,POST,OPTIONS\r\n");
    resp.extend_from_slice(b"Access-Control-Allow-Headers: Content-Type\r\n");
    resp.extend_from_slice(b"Connection: close\r\n\r\n");
    resp.extend_from_slice(&payload);
    let _ = stream.write_all(&resp);
}

fn header_val(headers: &[(String,String)], key: &str) -> Option<String> {
    headers.iter().find(|(k,_)| k==key).map(|(_,v)| v.clone())
}

fn json_field(body: &[u8], key: &str) -> Option<String> {
    let s = String::from_utf8_lossy(body);
    // find "key": "value" or "key": value
    let needle = format!("\"{}\"", key);
    let idx = s.find(&needle)?;
    let rest = &s[idx+needle.len()..];
    let rest = rest.trim_start();
    if !rest.starts_with(':') { return None; }
    let rest = rest[1..].trim_start();
    if rest.starts_with('"') {
        // string value
        let bytes = rest.as_bytes();
        let mut i = 1;
        let mut out = String::new();
        while i < bytes.len() {
            let c = bytes[i] as char;
            if c == '\\' {
                if i+1 < bytes.len() {
                    let n = bytes[i+1] as char;
                    match n {
                        'n' => out.push('\n'),
                        't' => out.push('\t'),
                        'r' => out.push('\r'),
                        '"' => out.push('"'),
                        '\\' => out.push('\\'),
                        _ => { out.push('\\'); out.push(n); }
                    }
                    i += 2;
                    continue;
                }
            }
            if c == '"' { break; }
            out.push(c);
            i += 1;
        }
        Some(out)
    } else {
        // number/bool/null or raw
        let end = rest.find(|ch: char| ch == ',' || ch == '}' || ch == ']').unwrap_or(rest.len());
        Some(rest[..end].trim().to_string())
    }
}

fn handle_ocr(body: &[u8]) -> (u16, &'static str, Vec<u8>) {
    let image_b64 = match json_field(body, "image") {
        Some(v) if !v.is_empty() => v,
        _ => return (400, "application/json", b"{\"error\":\"missing image\",\"text\":\"\",\"confidence\":0}".to_vec()),
    };
    let mime = json_field(body, "mime").unwrap_or_else(|| "image/png".to_string());
    let language = json_field(body, "language").unwrap_or_else(|| "eng".to_string());

    // strip data: prefix
    let mut s = image_b64.trim().to_string();
    if s.starts_with("data:") {
        if let Some(comma) = s.find(',') { s = s[comma+1..].to_string(); }
    }
    // remove whitespace
    s.retain(|c| !c.is_whitespace());

    let bytes = match base64_decode(&s) {
        Some(b) => b,
        None => return (400, "application/json", b"{\"error\":\"bad base64\",\"text\":\"\",\"confidence\":0}".to_vec()),
    };

    // write temp file
    let ext = if mime.contains("jpeg") || mime.contains("jpg") { "jpg" } else if mime.contains("webp") { "webp" } else { "png" };
    let tmp = std::env::temp_dir().join(format!("veritas_{}.{}", std::process::id(), ext));
    if fs::write(&tmp, &bytes).is_err() {
        return (500, "application/json", b"{\"error\":\"write failed\",\"text\":\"\",\"confidence\":0}".to_vec());
    }

    // run tesseract
    let tesseract = find_tesseract();
    let tesseract = match tesseract {
        Some(t) => t,
        None => {
            let _ = fs::remove_file(&tmp);
            return (503, "application/json", b"{\"error\":\"tesseract not installed\",\"text\":\"\",\"confidence\":0}".to_vec());
        }
    };
    let out = Command::new(&tesseract)
        .arg(&tmp).arg("stdout").arg("tsv").arg("-l").arg(&language)
        .output();
    let _ = fs::remove_file(&tmp);

    match out {
        Ok(o) if o.status.success() => {
            let (text, conf) = parse_tsv(&String::from_utf8_lossy(&o.stdout));
            let payload = format!("{{\"text\":{},\"confidence\":{},\"language\":{}}}",
                json_str(&text), conf, json_str(&language));
            (200, "application/json", payload.into_bytes())
        }
        Ok(o) => {
            let err = String::from_utf8_lossy(&o.stderr).trim().to_string();
            let err = if err.is_empty() { "tesseract failed".to_string() } else { err };
            // retry with eng if non-english
            if language.to_lowercase() != "eng" && language.to_lowercase() != "en" {
                // simple retry
                let tmp2 = std::env::temp_dir().join(format!("veritas2_{}.{}", std::process::id(), ext));
                let _ = fs::write(&tmp2, &bytes);
                let out2 = Command::new(&tesseract).arg(&tmp2).arg("stdout").arg("tsv").arg("-l").arg("eng").output();
                let _ = fs::remove_file(&tmp2);
                if let Ok(o2) = out2 {
                    if o2.status.success() {
                        let (text, conf) = parse_tsv(&String::from_utf8_lossy(&o2.stdout));
                        let payload = format!("{{\"text\":{},\"confidence\":{},\"language\":{}}}",
                            json_str(&text), conf, json_str("eng"));
                        return (200, "application/json", payload.into_bytes());
                    }
                }
            }
            let payload = format!("{{\"error\":{},\"text\":\"\",\"confidence\":0}}", json_str(&err));
            (422, "application/json", payload.into_bytes())
        }
        Err(e) => {
            let payload = format!("{{\"error\":{},\"text\":\"\",\"confidence\":0}}", json_str(&e.to_string()));
            (500, "application/json", payload.into_bytes())
        }
    }
}

fn find_tesseract() -> Option<String> {
    for c in ["tesseract"] {
        // check via which-like
        if Command::new("sh").arg("-c").arg(format!("command -v {}", c)).output().map(|o| o.status.success()).unwrap_or(false) {
            return Some(c.to_string());
        }
    }
    None
}

fn parse_tsv(stdout: &str) -> (String, f64) {
    let mut words: Vec<&str> = Vec::new();
    let mut confs: Vec<f64> = Vec::new();
    for line in stdout.lines().skip(1) {
        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 12 { continue; }
        let level = cols[0];
        if level != "5" { continue; }
        let conf: f64 = cols[10].parse().unwrap_or(-1.0);
        let text = cols[11].trim();
        if text.is_empty() { continue; }
        if conf >= 0.0 { confs.push(conf); }
        words.push(text);
    }
    let text = words.join(" ");
    let conf = if confs.is_empty() { 0.0 } else { confs.iter().sum::<f64>() / confs.len() as f64 };
    (text, (conf*10.0).round()/10.0)
}

fn handle_factcheck(body: &[u8], path: &str) -> (u16, &'static str, Vec<u8>) {
    let claim = json_field(body, "claim").unwrap_or_default();
    let mut claim = claim.trim().to_string();
    if claim.is_empty() {
        claim = json_field(body, "text").unwrap_or_default().trim().to_string();
    }
    if claim.is_empty() {
        claim = json_field(body, "query").unwrap_or_default().trim().to_string();
    }

    // key from query or env
    let mut key = std::env::var("GOOGLE_FACTCHECK_KEY")
        .or_else(|_| std::env::var("FACT_CHECK_API_KEY"))
        .or_else(|_| std::env::var("FACTCHECK_API_KEY")).ok();
    // parse ?key= from path
    if let Some(q) = path.split('?').nth(1) {
        for pair in q.split('&') {
            if let Some((k,v)) = pair.split_once('=') {
                if k == "key" { key = Some(url_decode(v)); }
            }
        }
    }

    if let Some(k) = key {
        if !k.is_empty() {
            // use curl
            let url = format!("https://factchecktools.googleapis.com/v1alpha1/claims:search?query={}&key={}",
                url_encode(&claim), url_encode(&k));
            let out = Command::new("curl").arg("-sS").arg("--max-time").arg("15").arg(&url).output();
            if let Ok(o) = out {
                if o.status.success() {
                    let payload = String::from_utf8_lossy(&o.stdout).to_string();
                    // normalize? just pass through wrapped
                    // Build normalized-ish: pass raw as a field
                    let normalized = format!("{{\"claims\":{},\"mock\":false}}",
                        extract_claims_array(&payload));
                    return (200, "application/json", normalized.into_bytes());
                }
            }
        }
    }

    // mock
    let mock = format!(
        "{{\"claims\":[{{\"text\":{},\"claimant\":\"Unknown\",\"claimReview\":[{{\"publisher\":\"Veritas Mock Fact Check\",\"url\":\"https://example.com/veritas/mock-factcheck\",\"title\":\"Mock review — no Google Fact Check API key configured\",\"reviewDate\":\"2026-01-01\",\"textualRating\":\"Unverified\"}}]}}],\"mock\":true,\"note\":\"Set GOOGLE_FACTCHECK_KEY or pass ?key= to use the real Google Fact Check Tools API.\"}}",
        json_str(&claim)
    );
    (200, "application/json", mock.into_bytes())
}

fn extract_claims_array(payload: &str) -> String {
    // extract the "claims" array from Google response; fallback to []
    if let Some(idx) = payload.find("\"claims\"") {
        let rest = &payload[idx..];
        if let Some(colon) = rest.find(':') {
            let arr_start = rest[colon+1..].trim_start();
            // find matching bracket
            let bytes = arr_start.as_bytes();
            let mut depth = 0;
            let mut started = false;
            let mut end = 0;
            for (i, &b) in bytes.iter().enumerate() {
                if b == b'[' { depth += 1; started = true; }
                else if b == b']' { depth -= 1; if started && depth == 0 { end = i+1; break; } }
                else if b == b'{' && !started { /* skip */ }
            }
            if end > 0 { return arr_start[..end].to_string(); }
        }
    }
    "[]".to_string()
}

fn serve_static(path: &str) -> (u16, &'static str, Vec<u8>) {
    let p = path.split('?').next().unwrap_or(path);
    let p = if p == "/" { "/index.html" } else { p };
    // prevent traversal
    if p.contains("..") { return (404, "text/plain", b"Not Found".to_vec()); }
    let mut full = PathBuf::from(project_root());
    full.push(p.trim_start_matches('/'));
    if !full.exists() || full.is_dir() {
        // try index.html
        full = PathBuf::from(project_root());
        full.push("index.html");
    }
    match fs::read(&full) {
        Ok(data) => {
            let ct = content_type(full.to_str().unwrap_or(""));
            (200, ct, data)
        }
        Err(_) => (404, "text/plain", b"Not Found".to_vec()),
    }
}

fn content_type(path: &str) -> &'static str {
    if path.ends_with(".html") { "text/html; charset=utf-8" }
    else if path.ends_with(".css") { "text/css" }
    else if path.ends_with(".js") { "application/javascript" }
    else if path.ends_with(".json") { "application/json" }
    else if path.ends_with(".png") { "image/png" }
    else if path.ends_with(".jpg") || path.ends_with(".jpeg") { "image/jpeg" }
    else if path.ends_with(".svg") { "image/svg+xml" }
    else if path.ends_with(".ico") { "image/x-icon" }
    else if path.ends_with(".woff2") { "font/woff2" }
    else if path.ends_with(".woff") { "font/woff" }
    else { "application/octet-stream" }
}

fn json_str(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

fn url_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn url_decode(s: &str) -> String {
    let mut out = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i+2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(std::str::from_utf8(&bytes[i+1..i+3]).unwrap_or(""), 16) {
                out.push(v); i += 3; continue;
            }
        }
        if bytes[i] == b'+' { out.push(b' '); }
        else { out.push(bytes[i]); }
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

// base64 decode (standard)
fn base64_decode(s: &str) -> Option<Vec<u8>> {
    let table = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::new();
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    for &b in s.as_bytes() {
        if b == b'=' { break; }
        let val = table.iter().position(|&x| x == b)? as u32;
        buf = (buf << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xFF) as u8);
        }
    }
    Some(out)
}
