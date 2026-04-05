#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  CATTO v7.0.0 — macOS / Linux Installer
#  Usage: chmod +x install.sh && ./install.sh
# ─────────────────────────────────────────────────────────────

set -e
CATTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[WARNING]${NC} $1"; }
err()  { echo -e "  ${RED}[ERROR]${NC} $1"; }
info() { echo -e "  ${CYAN}$1${NC}"; }

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
echo "  Install location: $CATTO_DIR"
echo ""

ELECTRON_OK=0

# ── [STEP 1/6] Docker ─────────────────────────────────────────
echo "  [STEP 1/6] Checking Docker..."

if ! command -v docker &>/dev/null; then
  err "Docker is not installed."
  echo ""
  if [[ "$OSTYPE" == "darwin"* ]]; then
    info "  Install Docker Desktop for Mac:"
    info "  https://www.docker.com/products/docker-desktop/"
    open "https://www.docker.com/products/docker-desktop/" 2>/dev/null || true
  else
    info "  Install Docker Engine for Linux:"
    info "  https://docs.docker.com/engine/install/"
    info ""
    info "  Quick install (Ubuntu/Debian):"
    info "    curl -fsSL https://get.docker.com | sh"
    info "    sudo usermod -aG docker \$USER   # then log out and back in"
  fi
  echo ""
  echo "  After installing Docker, run this script again."
  exit 1
fi

if ! docker info &>/dev/null; then
  err "Docker is installed but not running."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    info "  Open Docker Desktop from your Applications folder."
  else
    info "  Start Docker with: sudo systemctl start docker"
  fi
  echo "  Then run this script again."
  exit 1
fi
ok "Docker is running."

# ── [STEP 2/6] Docker Compose ─────────────────────────────────
echo ""
echo "  [STEP 2/6] Checking Docker Compose..."

if docker compose version &>/dev/null; then
  ok "Docker Compose v2 found."
elif command -v docker-compose &>/dev/null; then
  warn "docker-compose v1 found. Recommend upgrading to Docker Compose v2."
  ok "Will use docker-compose."
  COMPOSE_CMD="docker-compose"
else
  err "Docker Compose not found. Install Docker Desktop (includes Compose) or run:"
  info "    sudo apt-get install docker-compose-plugin   # Ubuntu/Debian"
  info "    brew install docker-compose                  # macOS (Homebrew)"
  exit 1
fi
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

# ── [STEP 3/6] Node.js ────────────────────────────────────────
echo ""
echo "  [STEP 3/6] Checking Node.js (required for Electron)..."

if ! command -v node &>/dev/null; then
  warn "Node.js is not installed. Electron desktop app will not be available."
  echo ""
  info "  Install Node.js v20+ from: https://nodejs.org/en/download/"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    info "  Or via Homebrew: brew install node"
  else
    info "  Or via nvm:  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    info "               nvm install 20"
  fi
  echo ""
  info "  NOTE: Without Node.js, Catto still runs in your browser at http://localhost:3002"
  echo ""
  read -rp "  Press Enter to continue without Node.js, or Ctrl+C to cancel..." _
  SKIP_ELECTRON=1
else
  NODE_VER=$(node --version)
  NODE_MAJOR=$(echo "$NODE_VER" | tr -d 'v' | cut -d. -f1)
  if [[ "$NODE_MAJOR" -lt 18 ]]; then
    warn "Node.js $NODE_VER detected. v18+ recommended. Consider upgrading."
  else
    ok "Node.js $NODE_VER found."
  fi
  SKIP_ELECTRON=0
fi

# ── [STEP 4/6] Environment file ───────────────────────────────
echo ""
echo "  [STEP 4/6] Setting up environment file (.env)..."

cd "$CATTO_DIR"

if [[ -f ".env" ]]; then
  ok ".env already exists — skipping copy."
elif [[ -f ".env.example" ]]; then
  cp ".env.example" ".env"
  ok "Created .env from .env.example"
else
  warn ".env.example not found — you will need to create .env manually."
fi

echo ""
echo "  ════════════════════════════════════════════════"
echo "   API KEYS — REQUIRED FOR FULL FUNCTIONALITY"
echo "  ════════════════════════════════════════════════"
echo ""
echo "   Open the file: $CATTO_DIR/.env"
echo ""
echo "   ┌─────────────────────────────────────────────────────┐"
echo "   │  REQUIRED (core features will not work without)     │"
echo "   │                                                     │"
echo "   │  LTA_ACCOUNT_KEY      → datamall.mytransport.sg     │"
echo "   │  OPENSKY_CLIENT_ID    → opensky-network.org         │"
echo "   │  OPENSKY_CLIENT_SECRET                              │"
echo "   │  AIS_API_KEY          → aisstream.io (free tier)    │"
echo "   │  OCEANS_X_API_KEY     → mpa.gov.sg / Oceans-X       │"
echo "   └─────────────────────────────────────────────────────┘"
echo ""
echo "   ┌─────────────────────────────────────────────────────┐"
echo "   │  OPTIONAL (enhances specific layers)                │"
echo "   │                                                     │"
echo "   │  OTX_API_KEY         AlienVault OTX threat intel    │"
echo "   │  VIRUSTOTAL_API_KEY  IOC malware lookup             │"
echo "   │  ABUSEIPDB_API_KEY   IP abuse scoring               │"
echo "   │  SHODAN_API_KEY      Shodan host overlay            │"
echo "   │  TELEGRAM_API_ID     Conflict channel monitor       │"
echo "   │  TELEGRAM_API_HASH   (paired with TELEGRAM_API_ID)  │"
echo "   │  FINNHUB_API_KEY     Defence stocks & markets       │"
echo "   │  FIRMS_MAP_KEY       NASA fire data                 │"
echo "   │  ACLED_EMAIL         ACLED conflict events          │"
echo "   │  GFW_API_TOKEN       Global Fishing Watch           │"
echo "   └─────────────────────────────────────────────────────┘"
echo ""
read -rp "  Press Enter to continue with installation..." _

# ── [STEP 5/6] Docker build ───────────────────────────────────
echo ""
echo "  [STEP 5/6] Building and starting Docker containers..."
echo "  (First run downloads ~2 GB of images — takes 5-10 minutes)"
echo "  ════════════════════════════════════════════════"

if ! $COMPOSE_CMD up -d --build; then
  err "Docker build failed."
  echo ""
  echo "  Common fixes:"
  echo "    1. Make sure Docker is fully running"
  echo "    2. Check disk space — need at least 5 GB free"
  echo "    3. View error details: $COMPOSE_CMD logs"
  echo "    4. Try manually:"
  echo "         $COMPOSE_CMD down"
  echo "         $COMPOSE_CMD up -d --build"
  exit 1
fi
ok "Containers built and started."

# ── [STEP 6/6] Electron ───────────────────────────────────────
echo ""
echo "  [STEP 6/6] Installing Electron desktop app..."

if [[ "${SKIP_ELECTRON:-0}" == "1" ]]; then
  warn "Skipping Electron — Node.js not found."
elif [[ ! -f "$CATTO_DIR/electron/package.json" ]]; then
  warn "electron/package.json not found — skipping Electron install."
else
  cd "$CATTO_DIR/electron"
  echo "  Running npm install... (downloads Electron ~120 MB)"
  if npm install; then
    if [[ -f "node_modules/.bin/electron" ]] || [[ -d "node_modules/electron/dist" ]]; then
      ok "Electron installed and binary verified."
      ELECTRON_OK=1
    else
      warn "npm install succeeded but Electron binary not found."
      info "  Try: node node_modules/electron/install.js"
    fi
  else
    warn "Electron npm install failed."
    echo ""
    echo "  To fix manually:"
    echo "    cd $CATTO_DIR/electron"
    echo "    npm install"
    echo "  FALLBACK: Use the browser at http://localhost:3002"
  fi
  cd "$CATTO_DIR"
fi

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "  ════════════════════════════════════════════════"
echo "   CATTO v7.0.0 IS READY"
echo "  ════════════════════════════════════════════════"
echo ""
echo "   Dashboard (browser):  http://localhost:3002"
if [[ "$ELECTRON_OK" == "1" ]]; then
  echo "   Desktop app:          ./start_catto.sh"
else
  echo "   Desktop app:          Electron not installed — use browser"
fi
echo ""
echo "   ┌──────────────────────────────────────────────────────┐"
echo "   │  NEXT STEP: Fill in your API keys                    │"
echo "   │                                                      │"
echo "   │  nano $CATTO_DIR/.env"
echo "   │                                                      │"
echo "   │  After editing .env, restart with:                   │"
echo "   │    $COMPOSE_CMD down && $COMPOSE_CMD up -d           │"
echo "   │  Or just run: ./start_catto.sh                       │"
echo "   └──────────────────────────────────────────────────────┘"
echo ""
echo "   Key registration links:"
echo "     LTA DataMall   → datamall.mytransport.sg"
echo "     OpenSky        → opensky-network.org"
echo "     AIS Stream     → aisstream.io"
echo "     MPA Oceans-X   → mpa.gov.sg"
echo "     AlienVault OTX → otx.alienvault.com"
echo "     VirusTotal     → virustotal.com"
echo ""
echo "   View logs:  $COMPOSE_CMD logs -f"
echo "   Restart:    $COMPOSE_CMD down && $COMPOSE_CMD up -d"
echo ""

read -rp "  Press Enter to open the dashboard in your browser..." _
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "http://localhost:3002"
else
  xdg-open "http://localhost:3002" 2>/dev/null || \
  sensible-browser "http://localhost:3002" 2>/dev/null || \
  echo "  Open your browser and go to: http://localhost:3002"
fi
