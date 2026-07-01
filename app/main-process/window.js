const { BrowserWindow } = require('electron');
const path = require('node:path');
const { readWindowState, writeWindowState, getWindowBounds } = require('./storage');

const APP_ICON_PATH = path.join(__dirname, '..', '..', 'static', 'assets', 'tracker.png');

/**
 * Creates the main BrowserWindow using persisted bounds and app defaults.
 * Persists bounds on move/resize/close and supports F12 devtools toggle.
 * @returns {Promise<import('electron').BrowserWindow>}
 */
const createMainWindow = async () => {
  const savedWindowState = await readWindowState();

  const mainWindow = new BrowserWindow({
    x: savedWindowState.x,
    y: savedWindowState.y,
    width: savedWindowState.width,
    height: savedWindowState.height,
    icon: APP_ICON_PATH,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d1521',
      symbolColor: '#e8efff',
      height: 34
    },
    backgroundColor: '#0a101a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js')
    }
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('moved', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    writeWindowState(getWindowBounds(mainWindow));
  });

  mainWindow.on('resized', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    writeWindowState(getWindowBounds(mainWindow));
  });

  mainWindow.on('close', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    writeWindowState(getWindowBounds(mainWindow));
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.loadFile(path.join('static', 'index.html'));

  return mainWindow;
};

module.exports = {
  createMainWindow
};
