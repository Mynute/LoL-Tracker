const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
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
let canUseAutoUpdater = false;

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
 * Initializes electron-updater.
 *
 * Requirements:
 * - app must be packaged (not dev mode)
 * - app must not be running from portable target
 * - build.publish must be configured for GitHub in package.json
 */
const setupAutoUpdater = () => {
  const isPortableBuild = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);

  if (!app.isPackaged || isPortableBuild) {
    canUseAutoUpdater = false;
    return;
  }

  canUseAutoUpdater = true;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-status', {
        state: 'update-available',
        info
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-status', {
        state: 'download-progress',
        progress
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-status', {
        state: 'update-not-available'
      });
    }
  });

  autoUpdater.on('error', (error) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-status', {
        state: 'error',
        message: error?.message || 'Unknown updater error'
      });
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-status', {
        state: 'update-downloaded'
      });
    }

    const messageBoxResponse = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Redemarrer maintenant', 'Plus tard'],
      defaultId: 0,
      cancelId: 1,
      title: 'Mise a jour prete',
      message: 'Une nouvelle version a ete telechargee.',
      detail: 'Redemarrer l application pour installer la mise a jour.'
    });

    if (messageBoxResponse.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdatesAndNotify();
};

/**
 * Requests an explicit update check from renderer settings panel.
 * @returns {Promise<{ok:boolean,message:string}>}
 */
const handleManualUpdateCheck = async () => {
  if (!canUseAutoUpdater) {
    return {
      ok: false,
      message: 'Updater unavailable in dev mode or portable build'
    };
  }

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:update-status', {
        state: 'checking'
      });
    }

    await autoUpdater.checkForUpdates();
    return {
      ok: true,
      message: 'Update check started'
    };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || 'Unable to check updates'
    };
  }
};

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
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:checkForUpdates', handleManualUpdateCheck);

  mainWindow = await createMainWindow();
  setMainWindow(mainWindow);
  setupAutoUpdater();

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
