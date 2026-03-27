#!/bin/bash
# deploy.sh — pull latest cards from git and copy to HA www directory
# Run from anywhere on the HA server:
#   bash /config/ha-custom-cards/deploy.sh
# Or with a specific card:
#   bash /config/ha-custom-cards/deploy.sh septa-paoli-card

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
WWW_DIR="/config/www/cards"

# ── Pull latest ───────────────────────────────────────────────────────────────
echo "Pulling latest from git..."
cd "$REPO_DIR"
git pull origin main

# ── Card list ─────────────────────────────────────────────────────────────────
CARDS=(
  bambu-printer-card
  calendar-card
  camera-layout-card
  charging-card
  clock-card
  door-sensor-card
  ecoflow-card
  garage-door-card
  leave-by-card
  now-playing-card
  peco-card
  printer-status-card
  protect-events-card
  room-buttons-card
  room-controls-card
  septa-paoli-card
  technology-card
  temp-strip-card
  tesla-card
  tesla-commute-card
  thermostat-card
  traffic-card
  wallbox-card
  weather-card-nws
)

# ── Deploy ────────────────────────────────────────────────────────────────────
deploy_card() {
  local name="$1"
  local src="$REPO_DIR/cards/$name/$name.js"
  local dst="$WWW_DIR/$name/$name.js"

  if [ ! -f "$src" ]; then
    echo "  SKIP $name — source not found"
    return
  fi

  mkdir -p "$WWW_DIR/$name"
  cp "$src" "$dst"
  echo "  OK   $name"
}

# If a card name is passed as argument, deploy only that card
if [ -n "$1" ]; then
  echo "Deploying $1 only..."
  deploy_card "$1"
else
  echo "Deploying all cards to $WWW_DIR..."
  for card in "${CARDS[@]}"; do
    deploy_card "$card"
  done
fi

echo ""
echo "Done. Hard refresh your browser to pick up changes."
echo "Remember to bump resource versions in Settings → Dashboards → Resources if needed."
