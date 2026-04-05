'use strict';

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

// ── Constants ────────────────────────────────────────────────────────────────
const CATTO_URL   = 'http://localhost:3002';
const APP_VERSION = '7.0.0';
const TITLE       = `CATTO v${APP_VERSION}`;

// Persist window bounds and preferences across restarts
const store = new Store({
  defaults: {
    windowBounds: { width: 1600, height: 960, x: undefined, y: undefined },
    startMinimised: false,
  },
});

// ── Chromium flags ───────────────────────────────────────────────────────────
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('memory-pressure-off');
// Silence unrelated Chromium noise in the console
app.commandLine.appendSwitch('disable-logging');

// ── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;

// ── Window factory ───────────────────────────────────────────────────────────
function createWindow() {
  const saved = store.get('windowBounds');
  const startMinimised = store.get('startMinimised');

  // Clamp saved position to an available display so the window isn't off-screen
  const displays = screen.getAllDisplays();
  let x = saved.x;
  let y = saved.y;
  if (x !== undefined && y !== undefined) {
    const onScreen = displays.some((d) => {
      const b = d.bounds;
      return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
    });
    if (!onScreen) { x = undefined; y = undefined; }
  }

  mainWindow = new BrowserWindow({
    width:  saved.width  || 1600,
    height: saved.height || 960,
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    minWidth:  900,
    minHeight: 600,
    show: false,
    backgroundColor: '#020509',
    title: TITLE,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,  // keep map + feeds alive when window is hidden
    },
  });

  mainWindow.loadURL(CATTO_URL);

  // Save bounds on every move / resize
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isMaximized() || mainWindow.isMinimized()) return;
    store.set('windowBounds', mainWindow.getBounds());
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move',   saveBounds);

  // Show window once content is ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    if (startMinimised) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Intercept close → minimise to tray instead of quitting
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip(TITLE);

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: TITLE,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show',
      click: showWindow,
    },
    {
      label: 'Hide',
      click: () => mainWindow?.hide(),
    },
    { type: 'separator' },
    {
      label: 'Start Minimised to Tray',
      type: 'checkbox',
      checked: store.get('startMinimised'),
      click: (item) => store.set('startMinimised', item.checked),
    },
    { type: 'separator' },
    {
      label: 'Restart',
      click: () => {
        isQuitting = true;
        app.relaunch();
        app.exit(0);
      },
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(buildMenu());
  tray.on('double-click', showWindow);
  // Left-click on tray icon toggles visibility
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ── IPC — custom titlebar window controls ────────────────────────────────────
ipcMain.on('window:minimise', () => mainWindow?.minimize());
ipcMain.on('window:maximise', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.hide());

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createTray();
  createWindow();
});

app.on('window-all-closed', (e) => {
  // Don't quit when all windows are closed — tray keeps the app alive
  e.preventDefault();
});

app.on('before-quit', () => { isQuitting = true; });

app.on('activate', () => {
  // macOS: re-create window if dock icon clicked and no windows open
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
