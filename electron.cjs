const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Setup Local Express and WebSocket Hub server on port 3001
const localApp = express();
const localServer = http.createServer(localApp);
const localWss = new WebSocket.Server({ server: localServer });

let localClients = [];

localWss.on('connection', (ws) => {
  localClients.push(ws);
  
  localClients.forEach(c => {
    if (c !== ws && c.readyState === WebSocket.OPEN) {
      c.send(JSON.stringify({ type: 'REQUEST_STATE' }));
    }
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      localClients.forEach(c => {
        if (c !== ws && c.readyState === WebSocket.OPEN) {
          c.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error("Local Server WS message err:", err);
    }
  });

  ws.on('close', () => {
    localClients = localClients.filter(c => c !== ws);
  });
  
  ws.on('error', () => {});
});

const builtDistPath = path.join(__dirname, 'dist');
localApp.use(express.static(builtDistPath));

localApp.get('/api/local-ip', (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const addresses = [];
  try {
    for (const k in interfaces) {
      for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === 'IPv4' && !address.internal) {
          addresses.push(address.address);
        }
      }
    }
  } catch (e) {
    console.error("Failed to get local IPs:", e);
  }
  res.json({ ips: addresses });
});

localApp.get('/tablet', (req, res) => {
  res.sendFile(path.join(builtDistPath, 'index.html'));
});

localApp.get('*', (req, res) => {
  res.sendFile(path.join(builtDistPath, 'index.html'));
});

localServer.listen(3001, '0.0.0.0', () => {
  console.log('[Remote Tablet Server] Local LAN access running on http://localhost:3001');
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    frame: false,
    title: "PT. Farika Riau Perkasa - Batching Plant",
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    backgroundColor: '#070b13', // Matches the main SCADA / HMI theme color
    show: false // Show window gracefully once content is ready
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Turn off default system menu to mimic industrial touch/HMI screen style
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// IPC Handlers for industrial administrator tools
ipcMain.on('exit-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(false);
  }
});

ipcMain.on('enter-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(true);
  }
});

ipcMain.on('open-devtools', () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
  }
});

ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.on('shutdown-app', () => {
  app.quit();
});

app.on('ready', () => {
  // --- ARCHITECTURE PREPARED FOR WINDOWS AUTO-START ---
  // To enable automatic startup of this HMI application when Windows powers on,
  // simply uncomment the code block below:
  /*
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
    args: ['--autostart']
  });
  */

  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
