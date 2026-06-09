# AI Talent & Company Growth Intelligence Platform

> Executive-grade workforce analytics dashboard tracking AI hiring signals, funding intelligence, geo expansion scoring, and ML-powered startup success prediction across 22 leading AI companies.

**Portfolio project by Shreya Vyas** · [Live Demo →]([https://shreya-vyas.github.io/BIDS/])

---

## What this is

A fully client-side analytics platform built with Vanilla JS, Chart.js, and SVG — no framework, no build step. Scrapes 5 live AI news RSS feeds every hour via GitHub Actions and updates the dashboard automatically.

**12 dashboard tabs:** Live Intel · AI Hiring Landscape · Geo Intelligence · Funding vs Hiring · Growth Intelligence · Skill Premiums · Startup Predictor · Layoff Risk · Market Intel · Compensation · Scraping + Models · Advanced Analytics

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES Modules), Chart.js 4.4, SVG |
| Styling | CSS custom properties, glassmorphism, dark mode |
| Data | Synthetic base layer + live RSS news feed |
| Scraper | Node.js built-ins only — zero npm dependencies |
| Hosting | GitHub Pages |
| Automation | GitHub Actions hourly cron |

---

## Local development

```bash
# Clone
git clone https://github.com/Shreya-vyas/FundingAI.git && cd BIDS

# Start everything (scrape + server + hourly watchdog)
bash scripts/start.sh
# → http://localhost:4173

# Or just run the scraper
node scripts/scraper.mjs
```

---

## Deploy to GitHub Pages

### Step 1 — Push to GitHub

```bash
cd /Users/sheenu/Documents/BIDS
git init
git add .
git commit -m "feat: AI talent intelligence platform"
git remote add origin https://github.com/Shreya-vyas/FundingAI.git
git branch -M main
git push -u origin main
```

### Step 2 — Enable GitHub Pages

1. Repo → **Settings** → **Pages**
2. Source → **GitHub Actions**
3. Save

The `deploy.yml` workflow deploys on every push. Your site goes live at:
```
https://shreya-vyas.github.io/FundingAI/
```

### Step 3 — Hourly scraper

The `scrape.yml` workflow runs automatically every hour using `GITHUB_TOKEN` (no extra secrets needed). It fetches 5 RSS feeds, updates `data/live-feed.js`, commits the change, which triggers a fresh Pages deploy.

To trigger manually: **Actions → Hourly News Scraper → Run workflow**

---

## How the live pipeline works

```
Every hour (GitHub Actions)
  └── scripts/scraper.mjs
        ├── Fetch: TechCrunch AI, VentureBeat AI, The Verge AI, MIT Tech Review, AI News
        ├── Extract: company mentions (22 companies × aliases)
        ├── Classify: FUNDING / HIRING / PRODUCT / RISK
        ├── Score: sentiment -1.0 → +1.0
        └── Write: data/live-feed.js
              └── git commit + push
                    └── GitHub Pages redeploy → live in ~60s
```

---

## Project structure

```
BIDS/
├── index.html              # App shell + news ticker
├── server.mjs              # Local dev server (port 4173)
├── src/
│   ├── app.js              # Dashboard — 12 tabs, all charts (~1,400 lines)
│   ├── analytics.js        # Scoring engine, forecast, geo analysis
│   └── styles.css          # Glassmorphism design + dark mode
├── data/
│   ├── companies.js        # 22 companies × 42 months synthetic data
│   └── live-feed.js        # Auto-updated by scraper
├── scripts/
│   ├── scraper.mjs         # RSS fetcher + signal classifier
│   ├── start.sh            # Launch everything locally
│   └── run-hourly.sh       # Shell wrapper + lock guard + logging
├── .github/workflows/
│   ├── scrape.yml          # Hourly scraper (GitHub Actions)
│   └── deploy.yml          # GitHub Pages deploy on push
└── sql/analytics_queries.sql
```

---

## ML models

| Model | Purpose | Output |
|-------|---------|--------|
| Logistic regression | Startup success probability | 0–100% |
| Linear OLS | 6-month hiring forecast | Openings + R² |
| Weighted composite | Layoff risk | 0–100% |
| Geo scoring | City expansion recommendation | Build hub / Selective / Remote-first |
| Keyword + sentiment | News signal classification | FUNDING / HIRING / PRODUCT / RISK |

---

*Portfolio project — end-to-end data pipeline, ML scoring, and production dashboard.*
