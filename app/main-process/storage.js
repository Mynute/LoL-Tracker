const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  CHALLENGES_CACHE_FILE,
  WINDOW_STATE_FILE,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT
} = require('./constants');

/**
 * Returns absolute path to the challenges cache file in userData.
 * @returns {string}
 */
const getChallengesCachePath = () => {
  return path.join(app.getPath('userData'), CHALLENGES_CACHE_FILE);
};

/**
 * Returns absolute path to the window state file in userData.
 * @returns {string}
 */
const getWindowStatePath = () => {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
};

/**
 * Extracts current window bounds from BrowserWindow instance.
 * @param {import('electron').BrowserWindow} windowInstance
 * @returns {{x:number,y:number,width:number,height:number}}
 */
const getWindowBounds = (windowInstance) => {
  const { x, y, width, height } = windowInstance.getBounds();
  return { x, y, width, height };
};

/**
 * Reads persisted window state and validates dimensions.
 * Falls back to default width/height on missing/invalid file.
 * @returns {Promise<{width:number,height:number,x?:number,y?:number}>}
 */
const readWindowState = async () => {
  try {
    const filePath = getWindowStatePath();
    const rawContent = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(rawContent);
    const x = Number.parseInt(parsed?.x, 10);
    const y = Number.parseInt(parsed?.y, 10);
    const width = Number.parseInt(parsed?.width, 10);
    const height = Number.parseInt(parsed?.height, 10);

    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return {
        width,
        height,
        x: Number.isFinite(x) ? x : undefined,
        y: Number.isFinite(y) ? y : undefined
      };
    }
  } catch (error) {
    // Ignore missing or invalid window state.
  }

  return {
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT
  };
};

/**
 * Persists window state JSON in userData.
 * @param {{x?:number,y?:number,width:number,height:number}} windowState
 * @returns {Promise<void>}
 */
const writeWindowState = async (windowState) => {
  try {
    const filePath = getWindowStatePath();
    await fs.writeFile(filePath, JSON.stringify(windowState, null, 2), 'utf8');
  } catch (error) {
    // Ignore window state write errors.
  }
};

/**
 * Reads cached challenges payload from userData.
 * @returns {Promise<object|Array|null>}
 */
const readCachedChallenges = async () => {
  try {
    const filePath = getChallengesCachePath();
    const rawContent = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(rawContent);
    if (parsed && typeof parsed === 'object' && parsed.challenges) {
      return parsed.challenges;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Writes challenges payload to local cache file.
 * @param {object|Array} challenges
 * @returns {Promise<void>}
 */
const writeCachedChallenges = async (challenges) => {
  try {
    const filePath = getChallengesCachePath();
    const payload = JSON.stringify({ challenges }, null, 2);
    await fs.writeFile(filePath, payload, 'utf8');
  } catch (error) {
    // Ignore cache write errors.
  }
};

module.exports = {
  getWindowBounds,
  readWindowState,
  writeWindowState,
  readCachedChallenges,
  writeCachedChallenges
};
