/* Veritas data: samples + challenge questions + toolkit */

export const SAMPLES = [
  {
    label: "Viral WhatsApp forward",
    text: "SHOCKING!!! Doctors don't want you to know this ONE weird trick that cures diabetes in 7 days!!! A miracle herb BANNED by pharmaceutical companies. 100% TRUE!!! Share with everyone you love before they delete this!!!",
  },
  {
    label: "Credible news",
    text: "According to a study published in The Lancet, regular exercise of 150 minutes per week is associated with a 30% reduction in cardiovascular disease risk. The research, conducted by WHO, followed 10,000 participants over 5 years.",
  },
  {
    label: "Conspiracy post",
    text: "WAKE UP SHEEPLE!!! The government is hiding the TRUTH about 5G towers causing cancer. Mainstream media is COVERING IT UP. They don't want you to know. Share before they censor this!!!",
  },
  {
    label: "Clickbait",
    text: "You won't believe what this 8-year-old did! Number 7 will shock you! Doctors hate this simple trick. Click here now before it's deleted forever!",
  },
  {
    label: "Balanced article",
    text: "Climate change refers to long-term shifts in temperatures and weather patterns. While natural factors play a role, human activities have been the main driver since the 1800s, primarily through burning fossil fuels.",
  },
];

export const CHALLENGE_ITEMS = [
  { text: "BREAKING: Scientists discover that drinking lemon water every morning dissolves kidney stones overnight! Big pharma is furious. Share before it's deleted!", answer: "fake" },
  { text: "The WHO recommends washing hands with soap for at least 20 seconds to prevent the spread of infectious diseases.", answer: "real" },
  { text: "You won't believe this 1 simple trick that makes you lose 10kg in a week! Doctors hate it! Click now!", answer: "fake" },
  { text: "According to NASA, 2023 was the warmest year on record, with global temperatures 1.18°C above the 20th-century average.", answer: "real" },
  { text: "SHOCKING EXPOSED: The moon landing was filmed in a Hollywood studio. Here's the PROOF they don't want you to see!!!", answer: "fake" },
  { text: "Regular vaccination according to the national immunization schedule protects children from 12 preventable diseases.", answer: "real" },
  { text: "URGENT: A new virus is spreading through WhatsApp messages! Forward this to 10 people to stay safe! (This is actually a hoax.)", answer: "fake" },
  { text: "The Reserve Bank of India regulates monetary policy and manages the country's foreign exchange reserves.", answer: "real" },
  { text: "Scientists at MIT have developed a new battery that charges in 30 seconds and lasts 100 years. Big oil is suppressing it!", answer: "fake" },
  { text: "Wearing seatbelts reduces the risk of death in a car crash by about 45%, according to the CDC.", answer: "real" },
  { text: "MIRACLE CURE: This ancient herb cures cancer, diabetes, and baldness! Doctors are hiding it! 100% natural!", answer: "fake" },
  { text: "The Indian Constitution guarantees six fundamental rights to all citizens, including the right to equality and freedom.", answer: "real" },
];

export const TOOLKIT = [
  { title: "Check the source", desc: "Who published it? Is it a known, reputable outlet? Look for an About page and editorial standards." },
  { title: "Verify the claim", desc: "Search the key claim on Google + 'fact check'. Use Snopes, Alt News, or BOOM Live for Indian context." },
  { title: "Check the date", desc: "Old news is often reshared as new. Verify when it was originally published." },
  { title: "Look for evidence", desc: "Does it cite studies, data, or experts? Vague 'scientists say' is a red flag." },
  { title: "Check your emotions", desc: "Content designed to make you angry or scared spreads faster. Pause before sharing." },
  { title: "Reverse image search", desc: "Right-click an image → 'Search image with Google' to find its origin." },
  { title: "Check the URL", desc: "Look for misspellings, extra subdomains, or unusual TLDs (.tk, .ml, .xyz)." },
  { title: "Ask an expert", desc: "When in doubt, ask a teacher, librarian, or use a fact-checking service." },
];

export const CHECKLIST = [
  "All-caps headlines or excessive punctuation",
  "Emotional language (outrage, fear, anger)",
  "No credible source cited",
  "Urgency to share ('forward to everyone')",
  "Too good to be true (miracle cures)",
  "Anonymous or unknown author",
  "Suspicious URL or domain",
  "Image without context",
  "Asks for personal information",
  "Contradicts established science",
];

export const WEAK_TOPICS = [
  { topic: "Source verification", score: 35 },
  { topic: "Emotional manipulation", score: 52 },
  { topic: "Clickbait detection", score: 61 },
  { topic: "Privacy awareness", score: 44 },
  { topic: "Image verification", score: 28 },
];

export const LESSONS = [
  "How to spot fake WhatsApp forwards (15 min)",
  "Understanding bias in news headlines (20 min)",
  "Protecting your digital footprint (10 min)",
  "Fact-checking with Google & Snopes (15 min)",
  "Recognizing phishing attempts (12 min)",
];