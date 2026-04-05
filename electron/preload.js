'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, typed API to the renderer (Catto web app).
// Only window control calls — no filesystem access, no shell exec.
contextBridge.exposeInMainWorld('cattoShell', {
  minimise: () => ipcRenderer.send('window:minimise'),
  maximise: () => ipcRenderer.send('window:maximise'),
  close:    () => ipcRenderer.send('window:close'),
});
