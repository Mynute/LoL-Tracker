const LCUConnect = require('../library/lcu-connect');
const { filterAndSortChallenges } = require('./challenge-utils');
const { readCachedChallenges, writeCachedChallenges } = require('./storage');

let connector = null;
let mainWindow = null;

/**
 * Stores the BrowserWindow instance used to dispatch renderer events.
 * @param {import('electron').BrowserWindow} windowInstance
 */
const setMainWindow = (windowInstance) => {
  mainWindow = windowInstance;
};

/**
 * Wires connector events to renderer IPC channels.
 */
const setupWebSocketListeners = () => {
  if (!connector) return;

  connector.on('champ-select:update', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('lcu:champ-select-update', data);
    }
  });

  connector.on('champ-select:pick', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('lcu:champ-select-pick', data);
    }
  });

  connector.on('champ-select:crowd-favorite', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('lcu:champ-select-crowd-favorite', data);
    }
  });

  connector.on('game:start', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('lcu:game-start', data);
    }
  });

  connector.on('champ-select:disabled-champs', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('lcu:champ-select-disabled-champs', data);
    }
  });

  connector.on('websocket:connected', () => {
    if (mainWindow) {
      mainWindow.webContents.send('lcu:websocket-connected');
    }
  });

  connector.on('websocket:error', (error) => {
    if (mainWindow) {
      mainWindow.webContents.send('lcu:websocket-error', error.message);
    }
  });

  connector.on('client-close', () => {
    if (mainWindow) {
      mainWindow.webContents.send('lcu:client-close');
    }
  });
};

/**
 * Creates and connects the LCU connector, then starts websocket events.
 * @returns {Promise<{code:number,message:string}>}
 */
const handleConnector = async () => {
  try {
    const lockfilePath = await LCUConnect.findLockfilePath();
    connector = new LCUConnect(lockfilePath);
  } catch (e) {
    return { code: 500, message: e.message };
  }

  try {
    await connector.connect();
    setupWebSocketListeners();

    try {
      await connector.connectWebSocket();
    } catch (wsError) {
      console.warn('WebSocket connection failed (non-critical):', wsError.message);
    }

    return { code: 200, message: 'OK' };
  } catch (e) {
    return { code: 500, message: e.message };
  }
};

/**
 * Returns current summoner data from LCU.
 * @returns {Promise<{code:number,summoner?:object,message?:string}>}
 */
const handleGetSummonerData = async () => {
  try {
    if (!connector || !connector.isConnected) {
      return { code: 400, message: 'Client not connected' };
    }
    const summoner = await connector.lcuRequest('/lol-summoner/v1/current-summoner');
    return { code: 200, summoner };
  } catch (e) {
    return { code: 500, message: e.message };
  }
};

/**
 * Returns crowd favorite champion ids for the current champ select.
 * @returns {Promise<{code:number,favorite?:object|Array,message?:string}>}
 */
const handleGetCrowdFavorite = async () => {
  try {
    if (!connector || !connector.isConnected) {
      return { code: 400, message: 'Client not connected' };
    }
    const favorite = await connector.lcuRequest('/lol-lobby-team-builder/champ-select/v1/crowd-favorte-champion-list');
    return { code: 200, favorite };
  } catch (e) {
    return { code: 500, message: e.message };
  }
};

/**
 * Returns summoner challenge payload.
 * Uses cache first unless forceRefresh=true.
 * @param {unknown} _
 * @param {{forceRefresh?: boolean}=} options
 * @returns {Promise<{code:number,challenges?:object|Array,fromCache?:boolean,message?:string}>}
 */
const handleGetSummonerChallenges = async (_, options = {}) => {
  const forceRefresh = Boolean(options?.forceRefresh);

  if (!forceRefresh) {
    const cachedChallenges = await readCachedChallenges();
    if (cachedChallenges) {
      return { code: 200, challenges: cachedChallenges, fromCache: true };
    }
  }

  try {
    if (!connector || !connector.isConnected) {
      return { code: 400, message: 'Client not connected' };
    }
    const challengesPayload = await connector.lcuRequest('/lol-challenges/v1/challenges/local-player');
    const challenges = filterAndSortChallenges(challengesPayload);
    await writeCachedChallenges(challenges);
    return { code: 200, challenges, fromCache: false };
  } catch (e) {
    return { code: 500, message: e.message };
  }
};

/**
 * Disconnects and clears connector resources.
 */
const disconnectConnector = () => {
  if (connector) {
    connector.disconnect();
    connector = null;
  }
};

module.exports = {
  setMainWindow,
  handleConnector,
  handleGetSummonerData,
  handleGetCrowdFavorite,
  handleGetSummonerChallenges,
  disconnectConnector
};
