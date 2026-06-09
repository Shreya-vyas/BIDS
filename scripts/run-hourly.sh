#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# AI Talent Intelligence — Hourly Update Script
# Run manually:   bash scripts/run-hourly.sh
# Cron (hourly):  0 * * * * cd /path/to/BIDS && bash scripts/run-hourly.sh
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/scraper-$(date +%Y-%m-%d).log"
LOCK_FILE="/tmp/ai-talent-scraper.lock"

mkdir -p "$LOG_DIR"

# ── Lock guard (prevent overlapping runs) ────────────────────
if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Scraper already running (PID $PID), skipping." | tee -a "$LOG_FILE"
    exit 0
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ── Run scraper ───────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ▶  AI Talent Scraper starting" | tee -a "$LOG_FILE"
echo "════════════════════════════════════════════════════" | tee -a "$LOG_FILE"

cd "$ROOT"
node scripts/scraper.mjs 2>&1 | tee -a "$LOG_FILE"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ✅ Scrape complete. live-feed.js updated." | tee -a "$LOG_FILE"

# ── Rotate logs older than 7 days ────────────────────────────
find "$LOG_DIR" -name "scraper-*.log" -mtime +7 -delete 2>/dev/null || true

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] 🔁 Next run in ~1 hour." | tee -a "$LOG_FILE"
