#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  CATTO v7.0.0 — macOS / Linux Launcher
#  Usage: chmod +x start_catto.sh && ./start_catto.sh
# ─────────────────────────────────────────────────────────────

CATTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$CATTO_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[WARNING]${NC} $1"; }
err()  { echo -e "  ${RED}[ERROR]${NC} $1"; }

echo ""
echo "  ██████╗ █████╗ ████████╗████████╗ ██████╗"
echo " ██╔════╝██╔══██╗╚══██╔══╝╚══██╔══╝██╔═══██╗"
echo " ██║     ███████║   ██║      ██║   ██║   ██║"
echo " ██║     ██╔══██║   ██║      ██║   ██║   ██║"
echo " ╚██████╗██║  ██║   ██║      ██║   ╚██████╔╝"
echo "  ╚═════╝╚═╝  ╚═╝   ╚═╝      ╚═╝    ╚═════╝"
echo ""
echo "  v7.0.0  Singapore OSINT Intelligence Dashboard"
echo "  ════════════════════════════════════════════════"
echo ""

# ── [1/4] Check .env ──────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp ".env.example" ".env"
    echo "  [NOTICE] .env was missing — created from .env.example"
  fi
fi

# Warn about empty required keys
MISSING_KEYS=""
if grep -qE "^LTA_ACCOUNT_KEY=\s*$" .env 2>/dev/null;     then MISSING_KEYS="$MISSING_KEYS LTA_ACCOUNT_KEY"; fi
if grep -qE "^OPENSKY_CLIENT_ID=\s*$" .env 2>/dev/null;   then MISSING_KEYS="$MISSING_KEYS OPENSKY"; fi
if grep -qE "^AIS_API_KEY=\s*$" .env 2>/dev/null;         then MISSING_KEYS="$MISSING_KEYS AIS_API_KEY"; fi

if [[ -n "$MISSING_KEYS" ]]; then
  echo ""
  echo "  ┌──────────────────────────────────────────────────────┐"
  echo "  │  WARNING: Some API keys appear to be empty.          │"
  echo "  │  These intelligence layers will not load:            │"
  echo "  │                                                      │"
  echo "  │  LTA_ACCOUNT_KEY    → Singapore road/traffic/bus     │"
  echo "  │  OPENSKY_CLIENT_ID  → Commercial & military flights  │"
  echo "  │  AIS_API_KEY        → Live vessel tracking           │"
  echo "  │  OCEANS_X_API_KEY   → MPA Singapore port vessels     │"
  echo "  │                                                      │"
  echo "  │  Edit your keys: nano $CATTO_DIR/.env"
  echo "  └──────────────────────────────────────────────────────┘"
  echo ""
  read -rp "  Press Enter to start anyway, or Ctrl+C to edit .env first..." _
fi

# ── [2/4] Check Docker ────────────────────────────────────────
echo ""
echo "  [1/4] Checking Docker..."

if ! command -v docker &>/dev/null; then
  err "Docker not found. Install Docker and run this script again."
  exit 1
fi

if ! docker info &>/dev/null; then
  err "Docker is not running."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  Starting Docker Desktop..."
    open -a Docker 2>/dev/null || echo "  Please open Docker Desktop manually."
    echo "  Waiting for Docker to become ready (up to 60 seconds)..."
    WAIT=0
    until docker info &>/dev/null; do
      sleep 5; WAIT=$((WAIT+5))
      if [[ $WAIT -ge 60 ]]; then
        err "Docker did not start in time. Please start Docker Desktop manually."
        exit 1
      fi
      echo "  Still waiting... (${WAIT}s)"
    done
  else
    echo "  Try: sudo systemctl start docker"
    exit 1
  fi
fi
ok "Docker is running."

# Detect compose command
if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  err "Docker Compose not found. Run ./install.sh first."
  exit 1
fi

# ── [3/4] Start containers ────────────────────────────────────
echo ""
echo "  [2/4] Starting Catto services..."

if ! $COMPOSE_CMD up -d; then
  err "Failed to start containers."
  echo "  Check logs with: $COMPOSE_CMD logs"
  exit 1
fi
ok "Catto backend and frontend containers started."

echo ""
echo "  [3/4] Waiting 15 seconds for services to initialise..."
sleep 15
ok "Services should be ready."

# ── [4/4] Launch Electron or browser ──────────────────────────
echo ""
echo "  [4/4] Launching Catto..."

if [[ -f "$CATTO_DIR/electron/node_modules/.bin/electron" ]]; then
  cd "$CATTO_DIR/electron"
  npx electron . &
  cd "$CATTO_DIR"
  ok "Electron desktop app launched."
elif [[ -f "$CATTO_DIR/electron/package.json" ]] && command -v node &>/dev/null; then
  echo "  Installing Electron dependencies first..."
  cd "$CATTO_DIR/electron"
  npm install --silent
  npx electron . &
  cd "$CATTO_DIR"
  ok "Electron desktop app launched."
else
  warn "Electron not found — opening browser instead."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3002"
  else
    xdg-open "http://localhost:3002" 2>/dev/null || \
    sensible-browser "http://localhost:3002" 2>/dev/null || \
    echo "  Open your browser: http://localhost:3002"
  fi
fi

echo ""
echo "  ════════════════════════════════════════════════════════"
echo "   CATTO v7.0.0 is running at http://localhost:3002"
echo "  ════════════════════════════════════════════════════════"
echo ""
echo "  To stop Catto: $COMPOSE_CMD down"
echo ""
