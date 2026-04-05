# Catto Desktop (Electron wrapper)

Wraps the Catto web app running on `http://localhost:3002` in a native Windows desktop window.

## Prerequisites

- Node.js 18+ installed
- Catto Docker stack running (`docker compose up -d` from project root)
- Optionally: place `assets/icon.ico` (256×256) and `assets/tray.png` (32×32) before building

## Setup

```bash
cd electron
npm install
```

## Launch (development)

Start the Docker stack first, then:

```bash
cd electron
npm run electron:start
```

## Package as Windows installer

```bash
cd electron
npm run electron:build
```

Output: `electron/dist/Catto Setup x.x.x.exe`

## Window controls

The app uses a frameless window with a custom dark titlebar. Window control buttons
(minimise / maximise / close) are rendered by Electron's native titlebar overlay.

Closing the window minimises to the system tray. Right-click the tray icon for:
- Show / Hide
- Start Minimised to Tray (toggle, persisted)
- Restart
- Quit

## Chromium flags applied

| Flag | Purpose |
|------|---------|
| `--max-old-space-size=4096` | 4 GB V8 heap for large map datasets |
| `--enable-gpu-rasterization` | GPU-accelerated canvas/map rendering |
| `--enable-zero-copy` | Reduced texture upload latency |
