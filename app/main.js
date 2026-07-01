const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { createMainWindow } = require('./main-process/window');
const {
  setMainWindow,
  handleConnector,
  handleGetSummonerData,
  handleGetCrowdFavorite,
  handleGetSummonerChallenges,
  disconnectConnector
} = require('./main-process/lcu-handlers');

let mainWindow = null;

// LCU local API uses self-signed cert in desktop environment.
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

/**
 * Prevents multiple app instances from running simultaneously.
 * On failure, current process exits immediately.
 * @type {boolean}
 */
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

/**
 * Focuses/restores the existing window when a second instance is started.
 */
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

/**
 * App bootstrap:
 * - remove default menu
 * - register IPC handlers
 * - create main window
 * - recreate window on macOS activate when none exists
 */
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  ipcMain.handle('dialog:connectToClient', handleConnector);
  ipcMain.handle('dialog:getSummonerData', handleGetSummonerData);
  ipcMain.handle('dialog:getSummonerChallenges', handleGetSummonerChallenges);
  ipcMain.handle('dialog:getCrowdFavorite', handleGetCrowdFavorite);

  mainWindow = await createMainWindow();
  setMainWindow(mainWindow);

  /**
   * Recreates the window on macOS dock activation when all windows are closed.
   */
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
      setMainWindow(mainWindow);
    }
  });
});

/**
 * Cleans connector resources before quitting on non-macOS platforms.
 */
app.on('window-all-closed', () => {
  disconnectConnector();
  if (process.platform !== 'darwin') app.quit();
});
