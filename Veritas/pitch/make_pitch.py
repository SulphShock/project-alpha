from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE

BG = RGBColor(0xEE,0xF1,0xF6)
INK = RGBColor(0x2D,0x1B,0x2E)
MUTED = RGBColor(0x6B,0x5A,0x7A)
PURPLE = RGBColor(0xE8,0xA3,0x17)
AMBER = RGBColor(0x4A,0x20,0x40)
LIGHTP = RGBColor(0x7A,0x4A,0x7A)
GRID = RGBColor(0xC9,0xD0,0xDC)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

def set_bg(slide):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = BG

def title_slide(text, sub=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    tb = slide.shapes.add_textbox(Inches(0.8), Inches(2.6), Inches(11.7), Inches(1.6))
    p = tb.text_frame.paragraphs[0]
    r = p.add_run(); r.text = text; r.font.size = Pt(64); r.font.bold = True; r.font.color.rgb = INK
    r.font.name = "Calibri"
    if sub:
        tb2 = slide.shapes.add_textbox(Inches(0.8), Inches(4.4), Inches(11.7), Inches(1.0))
        p2 = tb2.text_frame.paragraphs[0]
        r2 = p2.add_run(); r2.text = sub; r2.font.size = Pt(22); r2.font.color.rgb = MUTED
    return slide

def content_slide(title, bullets=None, body=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide)
    tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.6), Inches(11.7), Inches(1.0))
    p = tb.text_frame.paragraphs[0]
    r = p.add_run(); r.text = title; r.font.size = Pt(36); r.font.bold = True; r.font.color.rgb = PURPLE
    if bullets:
        txb = slide.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(11.7), Inches(5.2))
        tf = txb.text_frame
        for i,b in enumerate(bullets):
            para = tf.paragraphs[0] if i==0 else tf.add_paragraph()
            run = para.add_run(); run.text = "• " + b; run.font.size = Pt(20); run.font.color.rgb = INK
            para.space_after = Pt(8)
    if body:
        txb = slide.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(11.7), Inches(5.2))
        tf = txb.text_frame
        run = tf.paragraphs[0].add_run(); run.text = body; run.font.size = Pt(18); run.font.color.rgb = INK
    return slide

title_slide("Veritas", "Misinformation & Digital Safety Platform — Truth, verified.")

content_slide("The Problem", [
    "Misinformation spreads 6x faster than truth on social media.",
    "Teens are the most affected demographic.",
    "No accessible tool helps ordinary users verify claims in seconds.",
    "Digital safety education is fragmented and reactive.",
])

content_slide("Our Solution", [
    "Veritas: paste any message, article, or post.",
    "Get a credibility score (0–100) in 3 seconds.",
    "Claim-by-claim verdicts, red flags, safe rewrite, privacy risk.",
    "Challenge mode trains users to spot fakes; teacher dashboard tracks progress.",
])

content_slide("How It Works", [
    "Heuristic NLP: sensationalism, emotional charge, clickbait, caps, sources.",
    "URL reputation check: HTTPS, domain, suspicious TLDs.",
    "Privacy scan: phone, email, card, password, location.",
    "Optional OCR backend (Tesseract) + Google Fact Check API.",
    "Local-first: no data leaves the device unless you choose.",
])

content_slide("Demo", body="Live demo: paste a viral WhatsApp forward → score 2/100 in 3 seconds. Red flags listed. Safe rewrite generated. Privacy risk assessed. Anchor created for sharing.")

content_slide("Challenge Mode", [
    "10-round 'Spot the Fake' game.",
    "Real vs. fake headlines; instant feedback + streaks.",
    "Leaderboard motivates repeated practice.",
    "Turns verification into a habit, not a lecture.",
])

# Dashboard slide with chart
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(slide)
tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.6), Inches(11.7), Inches(1.0))
p = tb.text_frame.paragraphs[0]; r = p.add_run(); r.text = "Teacher Dashboard"; r.font.size = Pt(36); r.font.bold = True; r.font.color.rgb = PURPLE
chart_data = CategoryChartData()
chart_data.categories = ["Source verification","Emotional manipulation","Clickbait detection","Privacy awareness","Image verification"]
chart_data.add_series("Proficiency %", (35,52,61,44,28))
chart = slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.8), Inches(1.8), Inches(11.7), Inches(5.0), chart_data).chart
chart.has_legend = False

content_slide("Impact & Scalability", [
    "Runs offline — works in low-connectivity schools.",
    "No PII leaves the device; privacy by default.",
    "Scalable to classrooms, parents, and community centers.",
    "Open, extensible: add languages, sources, and models.",
])

content_slide("Tech Stack", [
    "Frontend: Vanilla HTML/CSS/JS (no build step).",
    "Backend: Rust (std only) — OCR via Tesseract, fact-check via curl.",
    "Storage: localStorage (no database).",
    "Pitch deck: python-pptx.",
    "Zero npm dependencies; ships as static files.",
])

content_slide("Team & Roadmap", [
    "3-person team: Data/NLP · Frontend · Content/Game/Demo.",
    "Day 1: engine + UI shell. Day 2: features. Day 3: demo + video.",
    "Roadmap: multilingual support, browser extension, school LMS integration.",
    "Ask: feedback, pilot schools, and mentorship.",
])

prs.save("/home/gordon/Projects/Apps/Veritas/pitch/Veritas.pptx")
print("saved")
