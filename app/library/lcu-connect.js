const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');
const { promisify } = require('node:util');
const WebSocket = require('ws');
const { EventEmitter } = require('node:events');

const execAsync = promisify(exec);

/**
 * League Client Update (LCU) connector.
 *
 * Responsibilities:
 * - Discover and read lockfile credentials
 * - Perform authenticated HTTPS requests to LCU endpoints
 * - Subscribe to LCU websocket event stream and re-emit app-level events
 * - Detect lockfile deletion and notify the app that client is closed
 *
 * Emitted events:
 * - `champ-select:update`
 * - `champ-select:pick`
 * - `websocket:disconnected`
 * - `websocket:error`
 * - `client-close`
 */
module.exports = class LCUConnect extends EventEmitter {
  exePath = "";
  isConnected = false;
  isWebSocketConnected = false;
  address = '127.0.0.1';
  username = 'riot';
  processName;
  processId;
  port;
  password;
  protocol;
  ws;
  watcher;
  
  /**
   * @param {string} exePath Absolute path to the League lockfile.
   */
  constructor(exePath) {
    super();
    this.exePath = exePath;
  }

  /**
   * Attempts to locate the League lockfile path.
   * Strategy:
   * 1) Read running League process executable path via PowerShell
   * 2) Fallback to common installation directories
   *
   * @returns {Promise<string>} Absolute lockfile path.
   * @throws {Error} When no lockfile can be found.
   */
  static async findLockfilePath() {
    // 1. Find running LeagueClientUx.exe via PowerShell
    try {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "(Get-Process LeagueClientUx -ErrorAction SilentlyContinue | Select-Object -First 1).MainModule.FileName"',
        { timeout: 5000 }
      );
      const exePath = stdout.trim();
      if (exePath && exePath.toLowerCase().endsWith('.exe')) {
        const lockfile = path.join(path.dirname(exePath), 'lockfile');
        await fs.promises.access(lockfile, fs.constants.F_OK);
        return lockfile;
      }
    } catch {
      // Process not running or PowerShell failed, try common paths
    }

    // 2. Fallback: common install paths
    const candidates = [
      path.join('C:\\', 'Riot Games', 'League of Legends', 'lockfile'),
      path.join('D:\\', 'Riot Games', 'League of Legends', 'lockfile'),
      path.join('E:\\', 'Riot Games', 'League of Legends', 'lockfile'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Riot Games', 'League of Legends', 'lockfile'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Riot Games', 'League of Legends', 'lockfile'),
    ];

    for (const candidate of candidates) {
      try {
        await fs.promises.access(candidate, fs.constants.F_OK);
        return candidate;
      } catch {
        // Not found at this path
      }
    }

    throw new Error('League of Legends lockfile not found. Please open the client first.');
  }

  /**
   * Reads lockfile credentials and marks connector as connected.
   * Starts lockfile watcher used to detect client close.
   *
   * @returns {Promise<void>}
   * @throws {Error} When lockfile is unavailable or malformed.
   */
  async connect() {
    try {
      await fs.promises.access(this.exePath, fs.constants.F_OK);
    } catch {
      throw new Error("Cannot connect to client, please open client");
    }

    try {
      const fileContent = await fs.promises.readFile(this.exePath);
      const rawConfig = fileContent.toString().split(':');
      this.processName = rawConfig[0];
      this.processId = rawConfig[1];
      this.port = rawConfig[2];
      this.password = rawConfig[3];
      this.protocol = rawConfig[4];
      this.isConnected = true;
      this.watchLockfile();
      return;
    } catch (error) {
      throw new Error("Cannot connect to client, please open client");
    }
  }

  /**
   * Watches lockfile deletion/rename and emits `client-close` when detected.
   * Guarded to avoid creating multiple watchers.
   */
  watchLockfile() {
    if (this.watcher) return;
    this.watcher = fs.watch(this.exePath, (eventType) => {
      if (eventType === 'rename') {
        fs.access(this.exePath, fs.constants.F_OK, (err) => {
          if (err) {
            this.watcher?.close();
            this.watcher = null;
            this.isConnected = false;
            this.isWebSocketConnected = false;
            this.emit('client-close');
          }
        });
      }
    });
    this.watcher.on('error', () => {
      this.watcher = null;
    });
  }

  /**
   * Performs an authenticated HTTPS request against LCU REST API.
   *
   * @param {string} path Endpoint path beginning with `/`.
   * @returns {Promise<any>} Parsed JSON payload.
   * @throws {Error} If connector is not initialized.
   */
  async lcuRequest(path) {    
    if (!this.isConnected) {
      throw new Error('Client not connected');
    }
    const headers = new Headers({
      accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString(
        "base64"
      )}`,
    });
    const res = await fetch(`${this.protocol}://${this.address}:${this.port}${path}`, { headers })
    return await res.json()
  }

  /**
   * Opens websocket connection and subscribes to `OnJsonApiEvent` stream.
   *
   * @returns {Promise<void>}
   * @throws {Error} If HTTP credentials are not initialized.
   */
  async connectWebSocket() {
    if (this.isWebSocketConnected) {
      return;
    }

    if (!this.isConnected) {
      throw new Error('HTTP connection must be established first');
    }

    const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    const wsUrl = `wss://${this.address}:${this.port}/`;      
    
    this.ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Basic ${auth}`
      },
      rejectUnauthorized: false
    });

    this.ws.on('open', () => {
      // 5 Means Subscribe
      this.isWebSocketConnected = true;
      this.ws.send(`[5, "OnJsonApiEvent"]`) //_lol-champ-select_v1_session
      // resolve();
    });

    this.ws.on('message', (data) => {
      try {
        // Ignore if buffer length is 0        
        if (Buffer.from(data).length > 0) {
          const message = JSON.parse(data);
          this.handleWebSocketMessage(message);
        }  
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    this.ws.on('close', () => {
      this.isWebSocketConnected = false;
      this.emit('websocket:disconnected');
    });

    this.ws.on('error', (error) => {
      this.emit('websocket:error', error);
      // reject(error);
    });
    return;
  }

  /**
   * Parses a serialized websocket event message.
   *
   * @param {string} message Raw JSON websocket message.
   * @returns {{type: string, data: any}}
   */
  parseEventMessage(message) {
    const [_, type, payload] = JSON.parse(message);
    return { type, data: payload.data }
  }

  /**
   * Routes websocket payload to app-level events.
   *
   * @param {any[]} message LCU websocket tuple [msgId, eventType, eventData].
   */
  handleWebSocketMessage(message) {
    // LCU WebSocket messages follow format: [msgId, eventType, data]
    if (!Array.isArray(message) || message.length < 2) {
      return;
    }
    
    
    const [msgId, eventType, eventData] = message;

    // Emit all events for debugging    
    // this.emit('websocket:message', { eventType, eventData });

    // Specific event handlers
    if (eventType === 'OnJsonApiEvent' && eventData?.uri?.includes('/lol-champ-select/v1/session')) {
      this.emit('champ-select:update', eventData.data);
    }

    if (eventType === 'OnJsonApiEvent' && eventData?.uri?.includes('/lol-champ-select/v1/current-champion')) {      
      this.emit('champ-select:pick', eventData);
    }

    if (eventType === 'OnJsonApiEvent' && eventData?.uri?.includes('/lol-lobby-team-builder/champ-select/v1/crowd-favorite-champion-list')) {
      this.emit('champ-select:crowd-favorite', eventData);
    }

    if (eventType === 'OnJsonApiEvent' && eventData?.uri?.includes('/lol-gameflow/v1/session')) {
      // Lobby, Matchmaking, ReadyCheck, ChampSelect, GameStart, InProgress, WaitingForStats
      if (eventData.data.phase == "GameStart") {
        this.emit('game:start', eventData.data);
      }
    }
  }

  /**
   * Closes websocket and file watcher, and resets connection state.
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.isWebSocketConnected = false;
    this.isConnected = false;
  }
}