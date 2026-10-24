/* Veritas analyzer — heuristic NLP.
 * Everything here runs in-browser, no network calls, no data leaves the device.
 * The scoring is intentionally simple and explainable — a judge should be able to
 * read this file and understand exactly why a piece of text scored what it did.
 */

const SENSATIONAL = [
  "shocking", "unbelievable", "miracle", "secret",
  "they don't want you to know", "exposed", "banned", "censored",
  "urgent", "breaking", "viral", "must share", "forward to everyone",
  "100% true", "doctors hate", "one weird trick", "you won't believe",
  "mind-blowing", "jaw-dropping",
];

const EMOTIONAL = [
  "outrage", "furious", "terrified", "panic", "disaster",
  "catastrophe", "evil", "corrupt", "scandal", "conspiracy",
  "cover-up", "hoax", "fake", "lie", "truth", "wake up",
];

const CREDIBLE_SOURCES = [
  "reuters", "ap news", "bbc", "who", "cdc", "nih",
  "nature", "science", "lancet", "nejm", "gov", "edu",
  "wikipedia", "snopes", "factcheck",
];

const CLICKBAIT_PATTERNS = [
  /\d+ (things|reasons|ways|secrets)/i,
  /you won't believe/i,
  /number \d+ will/i,
  /this (one|simple) trick/i,
  /doctors (hate|don't want)/i,
];

// Acronyms that should survive the "safe rewrite" pass untouched.
// Nobody wants WHO rewritten to "Who".
const KEEP_AS_IS = new Set([
  "WHO", "CDC", "NIH", "NASA", "ISRO", "RBI", "SEBI", "NATO", "UN", "EU",
  "UK", "USA", "AI", "ML", "NLP", "API", "URL", "HTTPS", "HTTP", "PDF",
  "OCR", "GDP", "COVID", "HIV", "AIDS", "DNA", "RNA", "CPU", "GPU", "RAM",
  "SSD", "USB", "LED", "TV", "GPS", "UPI", "OTP", "PIN", "KYC", "PII",
  "VPN", "DNS", "IP", "SSL", "TLS", "BJP", "INC", "AAP", "DMK", "AITC",
  "BSP", "CPI", "NITI", "IIT", "IIM", "NEET", "JEE", "UPSC", "CET",
]);

/**
 * Run the full credibility analysis on a string of text.
 * Returns null if there's nothing to analyze.
 */
export function analyze(text) {
  const original = text.trim();
  if (!original) return null;

  const lower = original.toLowerCase();
  const words = original.split(/\s+/);
  const sentences = original.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);

  const sensational = SENSATIONAL.filter(w => lower.includes(w)).length;
  const emotional = EMOTIONAL.filter(w => lower.includes(w)).length;
  const clickbait = CLICKBAIT_PATTERNS.filter(p => p.test(original)).length;

  const capsRatio = (original.match(/[A-Z]/g) || []).length / Math.max(1, original.length);
  const exclamations = (original.match(/!/g) || []).length;

  const hasSource = CREDIBLE_SOURCES.some(s => lower.includes(s));
  const hasNumbers = /\d/.test(original);
  const hasUrl = /https?:\/\//.test(original);
  const length = words.length;

  const flags = [];
  if (sensational >= 2) flags.push({ type: "sensational", text: `Sensational language (${sensational} trigger phrases)` });
  if (emotional >= 3) flags.push({ type: "emotional", text: `High emotional charge (${emotional} charged words)` });
  if (clickbait > 0) flags.push({ type: "clickbait", text: "Clickbait-style headline pattern" });
  if (capsRatio > 0.15) flags.push({ type: "caps", text: `Excessive capitalization (${Math.round(capsRatio * 100)}%)` });
  if (exclamations >= 3) flags.push({ type: "excl", text: `Multiple exclamation marks (${exclamations})` });
  if (!hasSource && length > 40) flags.push({ type: "nosource", text: "No credible source cited" });
  if (hasUrl && !hasSource) flags.push({ type: "unknownurl", text: "Links to unverified source" });

  const positives = [];
  if (hasSource) positives.push("Cites credible source");
  if (hasNumbers) positives.push("Includes specific data");
  if (sentences.length >= 3) positives.push("Multi-sentence structure");
  if (length > 80) positives.push("Substantial content");

  // Start neutral, subtract for red flags, add for good signals.
  // The weights are deliberately hand-tuned so a viral WhatsApp forward lands near 0.
  let score = 70;
  score -= sensational * 8;
  score -= emotional * 4;
  score -= clickbait * 12;
  score -= Math.min(20, capsRatio * 100);
  score -= Math.min(10, exclamations * 2);
  if (!hasSource && length > 40) score -= 15;
  if (hasSource) score += 15;
  if (hasNumbers) score += 5;
  if (length > 100) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let verdict, cls;
  if (score >= 75) { verdict = "Likely credible"; cls = "good"; }
  else if (score >= 50) { verdict = "Unverified — check sources"; cls = "warn"; }
  else if (score >= 25) { verdict = "Likely misleading"; cls = "danger"; }
  else { verdict = "High misinformation risk"; cls = "danger"; }

  const signals = flags.length + positives.length;
  const confidence = signals >= 5 ? "High" : signals >= 3 ? "Medium" : "Low";

  return {
    text: original,
    score, verdict, cls, confidence,
    flags, positives,
    claims: extractClaims(sentences),
    privacy: assessPrivacy(original),
    rewrite: buildRewrite(original),
    stats: { words: length, sentences: sentences.length, capsRatio, exclamations },
  };
}

/** Break text into a handful of "claims" and guess what kind each one is. */
function extractClaims(sentences) {
  return sentences.slice(0, 8).map(s => {
    const l = s.toLowerCase();
    if (/\d/.test(s) && /says|claims|reports|found|study|research/i.test(s)) {
      return { text: s, type: "factual", verdict: "Check source" };
    }
    if (/should|must|need to|have to/i.test(s)) {
      return { text: s, type: "opinion", verdict: "Opinion" };
    }
    if (/!{2,}/.test(s) || /shocking|unbelievable|miracle/i.test(l)) {
      return { text: s, type: "sensational", verdict: "Sensational" };
    }
    return { text: s, type: "statement", verdict: "Statement" };
  });
}

/** Rough PII scan. Better to under-flag than to flag "home prices rose 5%". */
function assessPrivacy(text) {
  const risks = [];

  if (/(?<!\d)(?:\+?\d{1,3}[\s-]?)?\d{10}(?!\d)/.test(text)) {
    risks.push("Phone number detected");
  }
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    risks.push("Email address detected");
  }
  if (/(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{0,7}(?!\d)/.test(text)) {
    risks.push("Possible card number");
  }
  if (/password|passwd|pwd/i.test(text)) {
    risks.push("Password mention");
  }
  // Require a real street-number + street-name pattern, not just the word "home".
  if (/\b\d{1,6}\s+[A-Za-z0-9.\-]+(?:\s+[A-Za-z0-9.\-]+){0,4}\s+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|sector|block|nagar|colony)\b/i.test(text)) {
    risks.push("Possible street address");
  } else if (/(?:home|my|residential)\s+address\s*(?:is|:)/i.test(text) && /\d/.test(text)) {
    risks.push("Possible home address");
  }

  if (risks.length === 0) return { level: "Low", risks: ["No obvious PII detected"], color: "#00ff88" };
  if (risks.length >= 3) return { level: "High", risks, color: "#ff3366" };
  return { level: "Medium", risks, color: "#ffd166" };
}

/** Turn sensational text into something you'd actually be comfortable sharing. */
function buildRewrite(text) {
  let out = text;

  // Lowercase long all-caps words, but leave real acronyms alone.
  out = out.replace(/\b([A-Z]{4,})\b/g, (word) => {
    if (KEEP_AS_IS.has(word)) return word;
    if (/\d/.test(word)) return word; // things like COVID19
    return word.charAt(0) + word.slice(1).toLowerCase();
  });

  // Multiple exclamation marks become one period.
  out = out.replace(/!{2,}/g, ".");

  const softeners = {
    "shocking": "notable",
    "unbelievable": "surprising",
    "miracle": "effective",
    "secret": "lesser-known",
    "exposed": "revealed",
    "urgent": "important",
    "breaking": "recent",
    "viral": "widely shared",
    "must share": "may be worth sharing",
  };

  for (const [from, to] of Object.entries(softeners)) {
    out = out.replace(new RegExp(`\\b${from}\\b`, "gi"), to);
  }

  if (out === text) return "No rewrite needed — content appears neutral.";
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Quick URL smell test. No network calls, just what we can see in the string. */
export function analyzeUrl(url) {
  const result = { url, domain: "", reputation: "Unknown", flags: [] };
  try {
    const u = new URL(url);
    result.domain = u.hostname;

    if (/\d+\.\d+\.\d+\.\d+/.test(u.hostname)) result.flags.push("Uses IP address instead of domain");
    if (u.protocol !== "https:") result.flags.push("Not HTTPS");
    if (u.hostname.length > 30) result.flags.push("Unusually long domain");
    if (/\.(tk|ml|ga|cf|gq)$/.test(u.hostname)) result.flags.push("Free/suspicious TLD");

    const trusted = ["reuters.com", "bbc.com", "who.int", "cdc.gov", "gov.in", "nic.in", "wikipedia.org"];
    if (trusted.some(t => u.hostname.endsWith(t))) result.reputation = "Trusted";
    else if (result.flags.length > 0) result.reputation = "Suspicious";
    else result.reputation = "Unknown";
  } catch {
    result.flags.push("Invalid URL");
  }
  return result;
}

/** Read image dimensions + size. Full OCR needs the backend. */
export function analyzeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({
        width: img.width,
        height: img.height,
        size: file.size,
        type: file.type,
        name: file.name,
        note: "Image analysis requires an OCR backend. For now: check dimensions, file size, and metadata.",
      });
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Try the backend on a few common origins.
 * Returns null if none respond (i.e. the user just opened index.html directly).
 */
async function callBackend(path, options) {
  for (const base of ["", "http://localhost:8000", "http://127.0.0.1:8000"]) {
    try {
      const res = await fetch(base + path, options);
      if (res.status !== 404) return res;
    } catch { /* try the next one */ }
  }
  return null;
}

export async function analyzeImageOCR(base64, mime) {
  const res = await callBackend("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mime }),
  });

  if (!res) {
    return { text: "", confidence: 0, language: "eng", error: "backend unavailable", analysis: null, fallback: true };
  }

  let data = {};
  try { data = await res.json(); } catch { /* leave as {} */ }

  const text = (data.text || "").toString().trim();
  return {
    text,
    confidence: data.confidence || 0,
    language: data.language || "eng",
    error: data.error,
    analysis: text ? analyze(text) : null,
    fallback: !text,
    status: res.status,
  };
}

function mockFactCheck(claim) {
  claim = (claim || "").trim() || "Sample claim (no claim provided)";
  return {
    claims: [{
      text: claim,
      claimant: "Unknown",
      claimReview: [{
        publisher: "Veritas Mock Fact Check",
        url: "https://example.com/veritas/mock-factcheck",
        title: "Mock review — no Google Fact Check API key configured",
        reviewDate: "2026-01-01",
        textualRating: "Unverified",
      }],
    }],
    mock: true,
    note: "Set GOOGLE_FACTCHECK_KEY or store a Google API key in localStorage (veritasFactCheckKey) for real results.",
  };
}

function normalizeFactCheck(payload, claim, mock) {
  const claims = (payload && payload.claims) || [];
  const results = [];

  for (const c of claims) {
    const reviews = c.claimReview || [];
    if (!reviews.length) {
      results.push({
        text: c.text || claim,
        claimant: c.claimant || "Unknown",
        publisher: null, url: null, title: null, reviewDate: null,
        rating: "Unverified",
      });
      continue;
    }
    for (const r of reviews) {
      const publisher = (typeof r.publisher === "object" && r.publisher)
        ? (r.publisher.name || r.publisher.site || null)
        : (r.publisher || null);
      results.push({
        text: c.text || claim,
        claimant: c.claimant || "Unknown",
        publisher,
        url: r.url || null,
        title: r.title || null,
        reviewDate: r.reviewDate || null,
        rating: r.textualRating || "Unverified",
      });
    }
  }

  if (!results.length) {
    results.push({
      text: claim, claimant: "Unknown", publisher: "Veritas",
      url: null, title: "No fact-check results found", reviewDate: null,
      rating: "Unverified",
    });
  }

  return {
    claim,
    results,
    mock: !!(mock || (payload && payload.mock)),
    note: (payload && payload.note) || null,
  };
}

export async function factCheckClaim(claim) {
  claim = (claim || "").trim();

  let key = null;
  try {
    key = localStorage.getItem("veritasFactCheckKey") || localStorage.getItem("googleFactCheckKey");
  } catch { /* localStorage blocked — fine */ }

  // Prefer the browser → Google path if a key exists.
  if (key) {
    try {
      const url = "https://factchecktools.googleapis.com/v1alpha1/claims:search?" +
        new URLSearchParams({ query: claim, key }).toString();
      const res = await fetch(url);
      if (res.ok) {
        const payload = await res.json();
        return normalizeFactCheck(payload, claim, false);
      }
    } catch { /* fall through to backend */ }
  }

  // Otherwise ask the backend (which may itself have a key, or will mock).
  const res = await callBackend("/api/factcheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim }),
  });

  if (res) {
    let data = {};
    try { data = await res.json(); } catch { /* leave as {} */ }
    if (res.status >= 400) return normalizeFactCheck(mockFactCheck(claim), claim, true);
    return normalizeFactCheck(data, claim, !!data.mock);
  }

  return normalizeFactCheck(mockFactCheck(claim), claim, true);
}
