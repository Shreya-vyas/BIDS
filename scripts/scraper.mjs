/**
 * AI Talent Intelligence Platform — Hourly News Scraper
 * ──────────────────────────────────────────────────────
 * Fetches 5 live RSS feeds, extracts company mentions,
 * classifies signals (HIRING / FUNDING / PRODUCT / RISK),
 * scores sentiment, then writes data/live-feed.js.
 *
 * Run:  node scripts/scraper.mjs
 * Deps: zero — pure Node.js built-ins only
 */

import https from "https";
import http  from "http";
import { writeFile, readFile } from "fs/promises";
import { fileURLToPath }       from "url";
import path                    from "path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT  = path.join(ROOT, "data", "live-feed.js");

/* ── RSS feeds ─────────────────────────────────────────────── */
const FEEDS = [
  { src: "TechCrunch AI",   url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { src: "VentureBeat AI",  url: "https://venturebeat.com/category/ai/feed/"                     },
  { src: "The Verge AI",    url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml" },
  { src: "MIT Tech Review", url: "https://www.technologyreview.com/feed/"                         },
  { src: "AI News",         url: "https://www.artificialintelligence-news.com/feed/"              },
];

/* ── Company aliases ───────────────────────────────────────── */
const COMPANY_ALIASES = {
  "OpenAI":         ["OpenAI","GPT-4","GPT-5","o1","o3","ChatGPT","DALL-E","Sora"],
  "Anthropic":      ["Anthropic","Claude","Sonnet","Haiku","Opus"],
  "Google DeepMind":["DeepMind","Google DeepMind","Gemini","Gemma","Google AI"],
  "Mistral":        ["Mistral","Mistral AI","Le Chat"],
  "Cohere":         ["Cohere","Command","Coral"],
  "Scale AI":       ["Scale AI","Scale"],
  "Databricks":     ["Databricks","DBRX","Mosaic","MosaicML"],
  "Hugging Face":   ["Hugging Face","HuggingFace","Transformers"],
  "Stability AI":   ["Stability AI","Stable Diffusion","SDXL"],
  "xAI":            ["xAI","Grok","Elon Musk AI"],
  "ElevenLabs":     ["ElevenLabs","Eleven Labs"],
  "Harvey":         ["Harvey AI","Harvey"],
  "Character.ai":   ["Character.ai","Character AI","c.ai"],
  "Together AI":    ["Together AI","Together"],
  "Writer":         ["Writer.com","Writer AI"],
  "Midjourney":     ["Midjourney","MJ"],
  "Replicate":      ["Replicate"],
  "Inflection AI":  ["Inflection","Pi AI","Inflection AI"],
  "Runway":         ["Runway","Runway ML","Gen-2","Gen-3"],
  "Perplexity":     ["Perplexity","Perplexity AI"],
  "Imbue":          ["Imbue"],
};

/* ── Signal keywords ───────────────────────────────────────── */
const SIGNAL_RULES = [
  { type: "FUNDING",  weight:  8, words: ["raises","funding","investment","valuation","series a","series b","series c","seed round","ipo","unicorn","billion","$","capital","round"] },
  { type: "HIRING",   weight:  6, words: ["hiring","headcount","employees","workforce","jobs","recruiting","talent","positions","openings","onboarding"] },
  { type: "PRODUCT",  weight:  4, words: ["launch","release","announce","partnership","expan","model","api","feature","product","integrat","deploy","version"] },
  { type: "RISK",     weight: -8, words: ["layoff","laid off","cut","fired","restructure","downsize","loss","losses","deficit","bankrupt","shutdown","close","concern","probe","lawsuit","regulation"] },
];

const POSITIVE_WORDS = ["breakthrough","record","fastest","leading","best","top","major","strong","growth","expan","billion","winner"];
const NEGATIVE_WORDS = ["concern","risk","fail","loss","weak","slow","probe","lawsuit","fine","ban","controversy","misuse"];

/* ─────────────────────────────────────────────────────────── */

function fetch(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("Too many redirects"));
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, {
      headers: {
        "User-Agent": "AI-Talent-Dashboard/1.0 (research scraper; +https://localhost)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetch(res.headers.location, redirectCount + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end",  ()    => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function parseRSS(xml, src) {
  const items = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRx.exec(xml)) !== null) {
    const block = m[1];
    const get   = tag => {
      const rx = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, "si");
      const r  = rx.exec(block);
      return r ? r[1].replace(/<[^>]+>/g, "").trim() : "";
    };
    const pub = get("pubDate") || get("dc:date") || "";
    items.push({
      title: get("title"),
      desc:  get("description") || get("summary") || "",
      link:  get("link"),
      pub,
      pubTs: pub ? (new Date(pub).getTime() || Date.now()) : Date.now(),
      src,
    });
  }
  return items;
}

function detectCompanies(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [company, aliases] of Object.entries(COMPANY_ALIASES)) {
    if (aliases.some(a => lower.includes(a.toLowerCase()))) found.push(company);
  }
  return found;
}

function classifySignal(text) {
  const lower = text.toLowerCase();
  let best = { type: "GENERAL", weight: 0 };
  for (const rule of SIGNAL_RULES) {
    const hits = rule.words.filter(w => lower.includes(w)).length;
    if (hits > 0) {
      const score = hits * Math.abs(rule.weight);
      if (score > Math.abs(best.weight) || best.type === "GENERAL") {
        best = { type: rule.type, weight: rule.weight < 0 ? -score : score };
      }
    }
  }
  return best.type;
}

function sentimentScore(text) {
  const lower = text.toLowerCase();
  const pos = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  const raw = (pos - neg * 1.4) / Math.max(1, pos + neg);
  return Math.round(Math.max(-1, Math.min(1, raw)) * 100) / 100;
}

function age(tsMs) {
  const mins = Math.round((Date.now() - tsMs) / 60000);
  if (mins < 60)  return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/* ── Main ──────────────────────────────────────────────────── */
async function scrape() {
  console.log(`[${new Date().toISOString()}] Starting scrape of ${FEEDS.length} feeds…`);

  const allItems = [];
  const errors   = [];

  await Promise.allSettled(
    FEEDS.map(async feed => {
      try {
        console.log(`  Fetching: ${feed.src}`);
        const xml   = await fetch(feed.url);
        const items = parseRSS(xml, feed.src);
        console.log(`  ✓ ${feed.src}: ${items.length} items`);
        allItems.push(...items);
      } catch (e) {
        console.warn(`  ✗ ${feed.src}: ${e.message}`);
        errors.push({ src: feed.src, error: e.message });
      }
    })
  );

  // Deduplicate by title similarity, sort newest first
  const seen = new Set();
  const deduped = allItems
    .filter(item => {
      const key = item.title.slice(0, 60).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return item.title.length > 5;
    })
    .sort((a, b) => b.pubTs - a.pubTs)
    .slice(0, 80); // keep top 80 newest

  // Enrich each item
  const articles = deduped.map((item, idx) => {
    const fullText  = `${item.title} ${item.desc}`;
    const companies = detectCompanies(fullText);
    const signal    = classifySignal(fullText);
    const sentiment = sentimentScore(fullText);
    return {
      id:        idx + 1,
      title:     item.title,
      desc:      item.desc.slice(0, 220).replace(/\s+/g, " ").trim(),
      link:      item.link,
      src:       item.src,
      pubTs:     item.pubTs,
      age:       age(item.pubTs),
      companies,
      signal,
      sentiment,
    };
  });

  // Company mention counts
  const mentionMap = {};
  for (const a of articles) {
    for (const c of a.companies) {
      mentionMap[c] = (mentionMap[c] || 0) + 1;
    }
  }

  // Hourly sentiment series (last 24h buckets)
  const now = Date.now();
  const hourlyBuckets = Array.from({ length: 24 }, (_, i) => {
    const bucketStart = now - (23 - i) * 3600000;
    const bucketEnd   = bucketStart + 3600000;
    const bucket      = articles.filter(a => a.pubTs >= bucketStart && a.pubTs < bucketEnd);
    const avg = bucket.length
      ? Math.round(bucket.reduce((s, a) => s + a.sentiment, 0) / bucket.length * 100) / 100
      : null;
    const hour = new Date(bucketStart).getHours();
    return { hour: `${String(hour).padStart(2,"0")}:00`, avg, count: bucket.length };
  });

  // Signal distribution
  const signalCounts = { FUNDING: 0, HIRING: 0, PRODUCT: 0, RISK: 0, GENERAL: 0 };
  for (const a of articles) signalCounts[a.signal]++;

  const meta = {
    scrapedAt:    new Date().toISOString(),
    scrapedAtTs:  Date.now(),
    totalArticles: articles.length,
    errors,
    signalCounts,
    mentionCounts: Object.entries(mentionMap).sort((a, b) => b[1] - a[1]),
  };

  // ── Load existing feed to merge (keep up to 200 total) ────
  let existing = [];
  try {
    const raw = await readFile(OUT, "utf8");
    const m   = raw.match(/export const liveFeed\s*=\s*(\{[\s\S]*\});/);
    if (m) {
      // safe eval-free parse: pull articles array
      const am = m[1].match(/"articles"\s*:\s*(\[[\s\S]*?\])\s*,\s*"meta"/);
      if (am) existing = JSON.parse(am[1]).filter(a => !articles.find(n => n.title === a.title));
    }
  } catch { /* first run */ }

  const merged = [...articles, ...existing].slice(0, 200);
  const output = `// AUTO-GENERATED by scripts/scraper.mjs — do not edit manually
// Last updated: ${meta.scrapedAt}
export const liveFeed = ${JSON.stringify({ articles: merged, meta, hourlyBuckets }, null, 2)};
`;

  await writeFile(OUT, output, "utf8");
  console.log(`\n✅ Written ${merged.length} articles → data/live-feed.js`);
  console.log(`   Signals: FUNDING=${signalCounts.FUNDING} HIRING=${signalCounts.HIRING} PRODUCT=${signalCounts.PRODUCT} RISK=${signalCounts.RISK}`);
  console.log(`   Top mentions: ${meta.mentionCounts.slice(0,5).map(([k,v])=>`${k}(${v})`).join(", ")}`);
  console.log(`   Errors: ${errors.length}`);
  return meta;
}

scrape().catch(e => { console.error("Fatal:", e); process.exit(1); });
