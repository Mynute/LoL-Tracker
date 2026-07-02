const { contextBridge, ipcRenderer } = require('electron/renderer')

/**
 * Secure bridge exposed to the renderer process.
 * All methods are explicit wrappers around IPC channels used by the app.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Connects to the League Client through lockfile discovery.
   * @returns {Promise<{code:number,message:string}>}
   */
  connectToClient: () => ipcRenderer.invoke('dialog:connectToClient'),
  /**
   * Retrieves the current summoner profile from LCU.
   * @returns {Promise<{code:number,summoner?:object,message?:string}>}
   */
  getSummonerData: () => ipcRenderer.invoke('dialog:getSummonerData'),
  /**
   * Retrieves local-player challenges.
   * @param {{forceRefresh?: boolean}=} options
   * @returns {Promise<{code:number,challenges?:object|Array,fromCache?:boolean,message?:string}>}
   */
  getSummonerChallenges: (options) => ipcRenderer.invoke('dialog:getSummonerChallenges', options),
  /**
   * Retrieves crowd favorite champions for current champ select.
   * @returns {Promise<{code:number,favorite?:object|Array,message?:string}>}
   */
  getCrowdFavorite: () => ipcRenderer.invoke('dialog:getCrowdFavorite'),
  /**
   * Returns current application version from main process.
   * @returns {Promise<string>}
   */
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  /**
   * Triggers a manual update check.
   * @returns {Promise<{ok:boolean,message:string}>}
   */
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  
  /**
   * Subscribes to champ select session updates.
   * @param {(data: object) => void} callback
   */
  onChampSelectUpdate: (callback) => ipcRenderer.on('lcu:champ-select-update', (event, data) => callback(data)),
  /**
   * Subscribes to current champion pick updates.
   * @param {(data: {eventType?: string, data?: number|string, uri?: string}) => void} callback
   */
  onChampSelectPick: (callback) => ipcRenderer.on('lcu:champ-select-pick', (event, data) => callback(data)),
  /**
   * Subscribes to disabled champions updates.
   * @param {(data: object) => void} callback
   */
  onChampSelectDisabledChamps: (callback) => ipcRenderer.on('lcu:champ-select-disabled-champs', (event, data) => callback(data)),
  /**
   * Fired when websocket is connected.
   * @param {() => void} callback
   */
  onWebSocketConnected: (callback) => ipcRenderer.on('lcu:websocket-connected', callback),
  /**
   * Fired when websocket is disconnected.
   * @param {() => void} callback
   */
  onWebSocketDisconnected: (callback) => ipcRenderer.on('lcu:websocket-disconnected', callback),
  /**
   * Fired when websocket returns an error.
   * @param {(error: string) => void} callback
   */
  onWebSocketError: (callback) => ipcRenderer.on('lcu:websocket-error', (event, error) => callback(error)),
  /**
   * Fired when the League client closes (lockfile removed/disconnected).
   * @param {() => void} callback
   */
  onClientClose: (callback) => ipcRenderer.on('lcu:client-close', () => callback()),
  /**
   * Fired when auto-updater state changes.
   * @param {(payload: {state: string, info?: object, progress?: object, message?: string}) => void} callback
   */
  onUpdateStatus: (callback) => ipcRenderer.on('app:update-status', (event, data) => callback(data))
})