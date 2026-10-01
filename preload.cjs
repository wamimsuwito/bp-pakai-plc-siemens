// Preload script for secure Electron window integration in fully offline modes
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: () => true,
  exitFullscreen: () => ipcRenderer.send('exit-fullscreen'),
  enterFullscreen: () => ipcRenderer.send('enter-fullscreen'),
  openDevTools: () => ipcRenderer.send('open-devtools'),
  restartApp: () => ipcRenderer.send('restart-app'),
  shutdownApp: () => ipcRenderer.send('shutdown-app'),
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron environment initialized successfully. Running under secure contextIsolation.');
});
