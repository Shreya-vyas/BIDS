#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# AI Talent Intelligence — Start Everything
# Usage:  bash scripts/start.sh
#
# 1. Runs the scraper immediately (fetches latest news)
# 2. Starts the static file server on port 4173
# 3. Starts the hourly background watchdog
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
PORT=4173

cd "$ROOT"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  AI Talent Intelligence Platform             ║"
echo "  ║  Starting full stack…                        ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Scrape immediately ────────────────────────────────
echo "▶ Step 1/3 — Fetching live AI news…"
node scripts/scraper.mjs
echo ""

# ── Step 2: Start server ──────────────────────────────────────
echo "▶ Step 2/3 — Starting server on http://localhost:${PORT}"
node server.mjs &
SERVER_PID=$!
echo "  Server PID: $SERVER_PID"
sleep 1

# ── Step 3: Hourly watchdog ───────────────────────────────────
echo ""
echo "▶ Step 3/3 — Starting hourly background scraper…"

watchdog() {
  while true; do
    sleep 3600
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ⏰ Hourly trigger fired"
    node "$ROOT/scripts/scraper.mjs" >> "$ROOT/logs/scraper-$(date +%Y-%m-%d).log" 2>&1 || true
  done
}
watchdog &
WATCHDOG_PID=$!
echo "  Watchdog PID: $WATCHDOG_PID"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  ✅  Dashboard:  http://localhost:${PORT}       │"
echo "  │  🔄  Auto-refresh: every 60s                 │"
echo "  │  📰  Scraper: runs every hour                │"
echo "  │  📁  Logs: logs/scraper-YYYY-MM-DD.log       │"
echo "  └─────────────────────────────────────────────┘"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""

# ── Keep alive + cleanup on exit ─────────────────────────────
trap "echo ''; echo 'Stopping…'; kill $SERVER_PID $WATCHDOG_PID 2>/dev/null || true; exit 0" SIGINT SIGTERM

wait $SERVER_PID
