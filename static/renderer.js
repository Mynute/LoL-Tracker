import {
  CHAMPIONS_URL,
  AUTO_CONNECT_RETRY_SECONDS,
  DEFAULT_CHALLENGE_ID,
  SUMMONER_BG_STORAGE_KEY
} from "./renderer/config.js";
import {
  crowdFavoriteList,
  collectionList,
  summonerCardNode,
  challengeSelectNode,
  challengeDescriptionNode,
  searchInputNode,
  positionButtonsNode,
  hideCompletedToggleNode,
  loadChallengeButtonNode,
  settingsButtonNode,
  settingsPanelNode,
  windowDragTitleNode,
  settingsVersionLabelNode,
  settingsUpdateLabelNode,
  appVersionNode,
  updateStatusNode,
  languageGroupNode,
  languageRadiosNode,
  summonerBackgroundToggleNode,
  summonerBackgroundLabelNode,
  checkUpdateButtonNode,
  challengeLabelNode,
  filtersTitleNode,
  hideCompletedLabelNode,
  crowdFavoriteTitleNode
} from "./renderer/dom.js";
import { state } from "./renderer/state.js";
import { normalizeEntityId, normalizePosition, toChampionList } from "./renderer/helpers.js";
import { getLanguage, setLanguage, t } from "./renderer/i18n.js";
import {
  setCollection,
  renderSummonerCard,
  renderDisconnectedSummonerCard,
  renderSelectedChampionCard,
  handleChampionCardSelection,
  handleChampionCardKeydown,
  renderGrid,
  setCrowdFavoriteVisibility,
  syncPositionButtonsUI
} from "./renderer/ui.js";

/**
 * Extracts the local player's selected champion id from champ select session payload.
 * @param {object} sessionData
 * @returns {string}
 */
const extractSelectedChampionId = (sessionData) => {
  if (!sessionData || typeof sessionData !== "object") {
    return "";
  }

  const localPlayerCellId = Number(sessionData.localPlayerCellId);
  const actions = Array.isArray(sessionData.actions) ? sessionData.actions.flat() : [];

  const selectedAction = actions
    .filter((action) => Number(action?.actorCellId) === localPlayerCellId)
    .reverse()
    .find((action) => Number(action?.championId) > 0);

  if (selectedAction) {
    return normalizeEntityId(selectedAction.championId);
  }

  const localPlayer = Array.isArray(sessionData.myTeam)
    ? sessionData.myTeam.find((player) => Number(player?.cellId) === localPlayerCellId)
    : null;

  return normalizeEntityId(localPlayer?.championId);
};

/**
 * Extracts local player's champion id from gameflow GameStart payload.
 * @param {object} gameStartData
 * @returns {string}
 */
const extractGameStartChampionId = (gameStartData) => {
  if (!gameStartData || typeof gameStartData !== "object") {
    return "";
  }

  const playerSelections = Array.isArray(gameStartData?.gameData?.playerChampionSelections)
    ? gameStartData.gameData.playerChampionSelections
    : Array.isArray(gameStartData?.playerChampionSelections)
      ? gameStartData.playerChampionSelections
      : [];

  const localSummonerId = normalizeEntityId(state.summonerId);
  const localSummonerPuuid = normalizeEntityId(state.summonerPuuid);
  const localSelection = playerSelections.find((selection) => {
    const selectionSummonerId = normalizeEntityId(selection?.summonerId ?? selection?.subject);
    const selectionPuuid = normalizeEntityId(selection?.puuid ?? selection?.summonerInternalName);

    return (
      (localSummonerId && selectionSummonerId === localSummonerId) ||
      (localSummonerPuuid && selectionPuuid === localSummonerPuuid)
    );
  });

  if (localSelection) {
    return normalizeEntityId(localSelection.championId ?? localSelection.selectedChampionId);
  }

  return normalizeEntityId(gameStartData?.championId ?? gameStartData?.gameData?.championId);
};

/**
 * Normalizes challenge list payload shape.
 * @param {unknown} payload
 * @returns {Array}
 */
const extractChallengeList = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.challenges)) {
    return payload.challenges;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

/**
 * Finds completed champion ids in a nested challenge payload.
 * @param {unknown} challengeNode
 * @returns {Array}
 */
const extractCompletedIds = (challengeNode) => {
  if (!challengeNode || typeof challengeNode !== "object") {
    return [];
  }

  const queue = [challengeNode];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if (seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (Array.isArray(current.completedIds)) {
      return current.completedIds;
    }

    Object.values(current).forEach((value) => {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    });
  }

  return [];
};

/**
 * Gets localized challenge display name.
 * @param {object} challengeNode
 * @param {string} challengeId
 * @returns {string}
 */
const getChallengeName = (challengeNode, challengeId) => {
  const nameCandidate =
    challengeNode?.name ||
    challengeNode?.title ||
    challengeNode?.challengeName ||
    challengeNode?.localizedName ||
    challengeNode?.localizedNames?.fr_FR ||
    challengeNode?.localizedNames?.en_US;

  if (typeof nameCandidate === "string" && nameCandidate.trim()) {
    return nameCandidate.trim();
  }

  return `Challenge ${challengeId}`;
};

/**
 * Converts challenges payload to select options.
 * @param {unknown} payload
 * @returns {{id:string,label:string}[]}
 */
const toChallengeOptions = (payload) => {
  if (Array.isArray(payload)) {
    return payload
      .map((challenge) => {
        const id = normalizeEntityId(challenge?.challengeId ?? challenge?.id);
        if (!id) {
          return null;
        }
        return {
          id,
          label: getChallengeName(challenge, id)
        };
      })
      .filter(Boolean);
  }

  if (payload && typeof payload === "object") {
    return Object.entries(payload)
      .map(([entryId, challenge]) => {
        const id = normalizeEntityId(challenge?.challengeId ?? challenge?.id ?? entryId);
        if (!id) {
          return null;
        }
        return {
          id,
          label: getChallengeName(challenge, id)
        };
      })
      .filter(Boolean);
  }

  return [];
};

/**
 * Updates challenge select list while preserving current selection when possible.
 * @param {unknown} payload
 */
const updateChallengeSelectOptions = (payload) => {
  const options = toChallengeOptions(payload);
  if (!options.length) {
    return;
  }

  const currentSelectedId = normalizeEntityId(state.selectedChallengeId || DEFAULT_CHALLENGE_ID);
  challengeSelectNode.innerHTML = "";

  options.forEach(({ id, label }) => {
    const optionNode = document.createElement("option");
    optionNode.value = id;
    optionNode.textContent = label;
    challengeSelectNode.append(optionNode);
  });

  const hasCurrentSelection = options.some(({ id }) => id === currentSelectedId);
  const nextSelectedId = hasCurrentSelection ? currentSelectedId : options[0].id;

  challengeSelectNode.value = nextSelectedId;
  state.selectedChallengeId = nextSelectedId;
};

/**
 * Stores challenge payload and refreshes derived UI state.
 * @param {unknown} payload
 */
const applyChallengesPayload = (payload) => {
  state.challengePayload = payload;
  updateChallengeSelectOptions(payload);
  applySelectedChallengeToCollection(payload);
};

/**
 * Returns champions matching current query/position/completed filters.
 * @returns {Array}
 */
const getFilteredChampions = () => {
  return state.champions.filter((champion) => {
    const matchesQuery =
      !state.filters.query ||
      champion.name.toLowerCase().includes(state.filters.query.toLowerCase());

    const matchesPosition =
      state.filters.positions.size === 0 ||
      champion.positions.some((position) => state.filters.positions.has(position));

    const matchesCompleted =
      !state.filters.hideCompleted ||
      !state.completedChampionIds.has(champion.id);

    return matchesQuery && matchesPosition && matchesCompleted;
  });
};

/**
 * Renders collection grid and header counter for current filters.
 */
const updateCollectionView = () => {
  const filteredChampions = getFilteredChampions();
  renderGrid(collectionList, filteredChampions, state.completedChampionIds);

  const completedCount = filteredChampions.reduce((count, champion) => {
    return count + (state.completedChampionIds.has(champion.id) ? 1 : 0);
  }, 0);

  setCollection(
    t("collection.titleWithCount", {
      completed: completedCount,
      total: filteredChampions.length
    })
  );
};

/**
 * Extracts crowd favorite champion ids from possible API response shapes.
 * @param {unknown} payload
 * @returns {string[]}
 */
const extractCrowdFavoriteIds = (payload) => {
  if (Array.isArray(payload)) {
    return payload.map(normalizeEntityId).filter(Boolean);
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [
    payload.favorite,
    payload.favorites,
    payload.championIds,
    payload.crowdFavoriteChampionIds,
    payload.data
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(normalizeEntityId).filter(Boolean);
    }
  }

  return [];
};

/**
 * Renders crowd favorite champion cards.
 * @param {unknown[]} favoriteIds
 */
const renderCrowdFavorites = (favoriteIds) => {
  state.crowdFavoriteIds = Array.isArray(favoriteIds)
    ? favoriteIds.map(normalizeEntityId).filter(Boolean)
    : [];

  if (!Array.isArray(favoriteIds) || favoriteIds.length === 0) {
    crowdFavoriteList.innerHTML = "";
    setCrowdFavoriteVisibility(false);
    return;
  }

  const championById = new Map(state.champions.map((champion) => [champion.id, champion]));
  const favoriteChampions = [];

  favoriteIds.forEach((id) => {
    const champion = championById.get(normalizeEntityId(id));
    if (champion) {
      favoriteChampions.push(champion);
    }
  });

  if (favoriteChampions.length === 0) {
    crowdFavoriteList.innerHTML = "";
    setCrowdFavoriteVisibility(false);
    return;
  }

  setCrowdFavoriteVisibility(true);
  renderGrid(crowdFavoriteList, favoriteChampions, state.completedChampionIds);
};

/**
 * Applies selected challenge and updates completed champions + description.
 * @param {unknown} payload
 */
const applySelectedChallengeToCollection = (payload) => {
  const selectedId = normalizeEntityId(challengeSelectNode.value || state.selectedChallengeId);
  const challengeList = extractChallengeList(payload);
  const challengeNode =
    challengeList.find((challenge) => normalizeEntityId(challenge?.challengeId || challenge?.id) === selectedId) ||
    payload?.[selectedId] ||
    null;

  const description = challengeNode?.description || "";
  challengeDescriptionNode.textContent = description;
  challengeDescriptionNode.hidden = !description;

  const completedIds = extractCompletedIds(challengeNode);
  state.completedChampionIds = new Set(completedIds.map(normalizeEntityId).filter(Boolean));
  state.selectedChallengeId = selectedId;

  updateCollectionView();
  renderCrowdFavorites(state.crowdFavoriteIds);
  renderSelectedChampionCard(state.selectedChampionId);
};

/**
 * Loads champion dataset from local assets and initializes collection view.
 */
const loadChampionsAndRender = async () => {
  const applyChampionDataset = async (championsData) => {
    const champions = toChampionList(championsData);

    if (champions.length === 0) {
      throw new Error("No champion icon found");
    }

    state.champions = champions;
    crowdFavoriteList.innerHTML = "";
    setCrowdFavoriteVisibility(false);
    updateCollectionView();
    await getSummonerChallenges({ forceRefresh: false, silentIfUnavailable: true });
  };

  try {
    const response = await fetch(CHAMPIONS_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const championsData = await response.json();
    await applyChampionDataset(championsData);
  } catch (error) {
    crowdFavoriteList.innerHTML = "";
    collectionList.innerHTML = "";
  }
};

/**
 * Stops launcher reconnection timer.
 */
const stopLauncherRetry = () => {
  if (state.autoConnectTimer) {
    clearInterval(state.autoConnectTimer);
    state.autoConnectTimer = null;
  }
  state.launcherRetrySecondsRemaining = 0;
};

/**
 * Stops summoner polling timer.
 */
const stopSummonerRetry = () => {
  if (state.summonerRetryTimer) {
    clearInterval(state.summonerRetryTimer);
    state.summonerRetryTimer = null;
  }
  state.summonerRetrySecondsRemaining = 0;
};

/**
 * Displays launcher waiting state.
 */
const renderWaitingForLauncher = () => {
  const message = t("summoner.waitingLauncher", {
    seconds: state.launcherRetrySecondsRemaining
  });
  renderDisconnectedSummonerCard(message);
};

/**
 * Displays summoner loading state.
 */
const renderWaitingForSummoner = () => {
  const message = t("summoner.waitingProfile", {
    seconds: state.summonerRetrySecondsRemaining
  });
  renderDisconnectedSummonerCard(message);
};

/**
 * Attempts to connect to LCU client.
 * @returns {Promise<boolean>}
 */
const attemptConnectToClient = async () => {
  if (state.isClientConnected || state.isConnecting) {
    return false;
  }

  state.isConnecting = true;

  try {
    const data = await window.electronAPI.connectToClient();
    if (data.code === 200) {
      state.isClientConnected = true;
      stopLauncherRetry();
      startRetryingSummoner();
      return true;
    }
  } catch (error) {
    // Keep retry loop alive while launcher is not available.
  } finally {
    state.isConnecting = false;
  }

  return false;
};

/**
 * Starts launcher reconnect loop.
 */
const startLauncherRetry = () => {
  if (state.autoConnectTimer || state.isClientConnected) {
    return;
  }

  state.launcherRetrySecondsRemaining = AUTO_CONNECT_RETRY_SECONDS;
  renderWaitingForLauncher();

  state.autoConnectTimer = setInterval(async () => {
    if (state.isClientConnected) {
      stopLauncherRetry();
      return;
    }

    state.launcherRetrySecondsRemaining -= 1;

    if (state.launcherRetrySecondsRemaining <= 0) {
      const isConnected = await attemptConnectToClient();
      if (isConnected) {
        return;
      }

      state.launcherRetrySecondsRemaining = AUTO_CONNECT_RETRY_SECONDS;
    }

    renderWaitingForLauncher();
  }, 1000);

  attemptConnectToClient().then((isConnected) => {
    if (!isConnected && !state.isClientConnected) {
      state.launcherRetrySecondsRemaining = AUTO_CONNECT_RETRY_SECONDS;
      renderWaitingForLauncher();
    }
  });
};

/**
 * Starts summoner fetch retry loop.
 */
const startRetryingSummoner = () => {
  if (state.summonerRetryTimer || state.isSummonerConnected) {
    return;
  }

  state.isSummonerRetrying = true;
  state.summonerRetrySecondsRemaining = AUTO_CONNECT_RETRY_SECONDS;
  renderWaitingForSummoner();

  state.summonerRetryTimer = setInterval(async () => {
    if (state.isSummonerConnected) {
      stopSummonerRetry();
      return;
    }

    state.summonerRetrySecondsRemaining -= 1;

    if (state.summonerRetrySecondsRemaining <= 0) {
      const isSuccessful = await attemptGetCurrentSummoner();
      if (isSuccessful) {
        return;
      }

      state.summonerRetrySecondsRemaining = AUTO_CONNECT_RETRY_SECONDS;
    }

    renderWaitingForSummoner();
  }, 1000);

  attemptGetCurrentSummoner().then((isSuccessful) => {
    if (!isSuccessful && !state.isSummonerConnected) {
      state.summonerRetrySecondsRemaining = AUTO_CONNECT_RETRY_SECONDS;
      renderWaitingForSummoner();
    }
  });
};

/**
 * Attempts to fetch and render current summoner.
 * @returns {Promise<boolean>}
 */
const attemptGetCurrentSummoner = async () => {
  try {
    const summonerData = await window.electronAPI.getSummonerData();
    if (
      summonerData.code === 200 &&
      summonerData.summoner &&
      typeof summonerData.summoner === "object" &&
      (summonerData.summoner.displayName || summonerData.summoner.gameName)
    ) {
      state.isSummonerConnected = true;
      state.summonerId = normalizeEntityId(
        summonerData.summoner.summonerId ?? summonerData.summoner.id
      );
      state.summonerPuuid = normalizeEntityId(summonerData.summoner.puuid);
      stopSummonerRetry();
      renderSummonerCard(summonerData.summoner);
      return true;
    }
  } catch (error) {
    // Keep retry loop alive.
  }
  return false;
};

/**
 * Retrieves and applies summoner challenges.
 * @param {{forceRefresh?: boolean, silentIfUnavailable?: boolean}=} options
 */
const getSummonerChallenges = async ({ forceRefresh = false, silentIfUnavailable = false } = {}) => {
  try {
    const challengesData = await window.electronAPI.getSummonerChallenges({ forceRefresh });
    if (challengesData.code === 200) {
      applyChallengesPayload(challengesData.challenges);
      return;
    }
  } catch (error) {
    // Continue to fallback message handling.
  }
};

/**
 * Handles search filter updates.
 */
const onFiltersChanged = () => {
  state.filters.query = searchInputNode.value.trim();
  updateCollectionView();
};

const applySummonerCardBackgroundPreference = (enabled) => {
  if (!summonerCardNode) {
    return;
  }

  summonerCardNode.classList.toggle("is-lux-banner", Boolean(enabled));
};

const mapUpdateStatusLabel = (payload) => {
  const updateState = String(payload?.state || "").toLowerCase();

  if (updateState === "checking") {
    return t("update.checking");
  }
  if (updateState === "update-available") {
    const versionText = payload?.info?.version ? ` (${payload.info.version})` : "";
    return t("update.available", { version: versionText });
  }
  if (updateState === "download-progress") {
    const percent = Number(payload?.progress?.percent);
    if (Number.isFinite(percent)) {
      return t("update.downloadingPercent", { percent: Math.round(percent) });
    }
    return t("update.downloading");
  }
  if (updateState === "update-downloaded") {
    return t("update.ready");
  }
  if (updateState === "update-not-available") {
    return t("update.uptodate");
  }
  if (updateState === "error") {
    return t("update.error", { message: payload?.message || "unknown" });
  }

  return t("update.idle");
};

const applyStaticTranslations = () => {
  if (windowDragTitleNode) {
    windowDragTitleNode.textContent = t("app.title");
  }

  if (settingsButtonNode) {
    settingsButtonNode.setAttribute("aria-label", t("settings.openOptions"));
  }

  const settingsTitleNode = settingsPanelNode?.querySelector(".settings-title");
  if (settingsTitleNode) {
    settingsTitleNode.textContent = t("settings.application");
  }

  if (settingsVersionLabelNode) {
    settingsVersionLabelNode.textContent = t("settings.version");
  }

  if (settingsUpdateLabelNode) {
    settingsUpdateLabelNode.textContent = t("settings.update");
  }

  if (summonerBackgroundLabelNode) {
    summonerBackgroundLabelNode.textContent = t("settings.luxMode");
  }

  if (checkUpdateButtonNode) {
    checkUpdateButtonNode.textContent = t("settings.checkUpdates");
  }

  if (challengeLabelNode) {
    challengeLabelNode.textContent = t("challenge.label");
  }

  if (loadChallengeButtonNode) {
    loadChallengeButtonNode.setAttribute("aria-label", t("challenge.refresh"));
  }

  if (filtersTitleNode) {
    filtersTitleNode.textContent = t("filters.title");
  }

  if (searchInputNode) {
    searchInputNode.placeholder = t("filters.searchPlaceholder");
  }

  if (hideCompletedLabelNode) {
    hideCompletedLabelNode.textContent = t("filters.hideCompleted");
  }

  if (crowdFavoriteTitleNode) {
    crowdFavoriteTitleNode.textContent = t("crowdFavorite.title");
  }
};

const applyLanguageToUi = () => {
  applyStaticTranslations();
  updateStatusNode.textContent = mapUpdateStatusLabel({ state: "idle" });

  if (state.isSummonerConnected) {
    attemptGetCurrentSummoner();
  } else if (state.isClientConnected) {
    renderWaitingForSummoner();
  } else {
    renderDisconnectedSummonerCard();
  }

  updateCollectionView();
  renderCrowdFavorites(state.crowdFavoriteIds);
  renderSelectedChampionCard(state.selectedChampionId);
};

const closeSettingsPanel = () => {
  if (!settingsPanelNode || !settingsButtonNode) {
    return;
  }

  settingsPanelNode.hidden = true;
  settingsButtonNode.setAttribute("aria-expanded", "false");
};

const toggleSettingsPanel = () => {
  if (!settingsPanelNode || !settingsButtonNode) {
    return;
  }

  const willOpen = settingsPanelNode.hidden;
  settingsPanelNode.hidden = !willOpen;
  settingsButtonNode.setAttribute("aria-expanded", String(willOpen));
};

const setupSettingsPanel = async () => {
  if (!settingsPanelNode || !settingsButtonNode || !appVersionNode || !updateStatusNode) {
    return;
  }

  if (languageGroupNode && languageRadiosNode) {
    const currentLanguage = getLanguage();
    languageRadiosNode.forEach((radio) => {
      radio.checked = radio.value === currentLanguage;
      radio.addEventListener("change", () => {
        if (radio.checked) {
          setLanguage(radio.value);
          applyLanguageToUi();
        }
      });
    });
  }

  settingsButtonNode.addEventListener("click", () => {
    toggleSettingsPanel();
  });

  document.addEventListener("click", (event) => {
    if (settingsPanelNode.hidden) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (settingsPanelNode.contains(target) || settingsButtonNode.contains(target)) {
      return;
    }

    closeSettingsPanel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSettingsPanel();
    }
  });

  if (window.electronAPI?.getAppVersion) {
    try {
      const version = await window.electronAPI.getAppVersion();
      appVersionNode.textContent = version || "-";
    } catch (error) {
      appVersionNode.textContent = "-";
    }
  }

  if (checkUpdateButtonNode && window.electronAPI?.checkForUpdates) {
    checkUpdateButtonNode.addEventListener("click", async () => {
      updateStatusNode.textContent = t("settings.update.checking");
      checkUpdateButtonNode.disabled = true;

      try {
        const result = await window.electronAPI.checkForUpdates();
        if (!result?.ok) {
          updateStatusNode.textContent = result?.message || t("settings.update.unable");
        }
      } catch (error) {
        updateStatusNode.textContent = t("settings.update.unable");
      } finally {
        checkUpdateButtonNode.disabled = false;
      }
    });
  }

  if (window.electronAPI?.onUpdateStatus) {
    window.electronAPI.onUpdateStatus((payload) => {
      updateStatusNode.textContent = mapUpdateStatusLabel(payload);
    });
  }

  if (summonerBackgroundToggleNode) {
    let isEnabled = false;

    try {
      isEnabled = localStorage.getItem(SUMMONER_BG_STORAGE_KEY) === "1";
    } catch (error) {
      isEnabled = false;
    }

    summonerBackgroundToggleNode.checked = isEnabled;
    applySummonerCardBackgroundPreference(isEnabled);

    summonerBackgroundToggleNode.addEventListener("change", () => {
      const nextValue = summonerBackgroundToggleNode.checked;
      applySummonerCardBackgroundPreference(nextValue);

      try {
        localStorage.setItem(SUMMONER_BG_STORAGE_KEY, nextValue ? "1" : "0");
      } catch (error) {
        // Ignore storage write failures.
      }
    });
  }
};

loadChallengeButtonNode.addEventListener("click", () => {
  getSummonerChallenges({ forceRefresh: true, silentIfUnavailable: false });
});

challengeSelectNode.addEventListener("change", () => {
  if (state.challengePayload) {
    applySelectedChallengeToCollection(state.challengePayload);
  }
});

searchInputNode.addEventListener("input", onFiltersChanged);
hideCompletedToggleNode.addEventListener("change", () => {
  state.filters.hideCompleted = hideCompletedToggleNode.checked;
  updateCollectionView();
});
collectionList.addEventListener("click", (event) => {
  handleChampionCardSelection(event.target);
});
crowdFavoriteList.addEventListener("click", (event) => {
  handleChampionCardSelection(event.target);
});
collectionList.addEventListener("keydown", handleChampionCardKeydown);
crowdFavoriteList.addEventListener("keydown", handleChampionCardKeydown);
positionButtonsNode.addEventListener("click", (event) => {
  const button = event.target.closest(".position-btn");
  if (!button) {
    return;
  }

  const position = normalizePosition(button.dataset.position);
  if (!position) {
    return;
  }

  if (state.filters.positions.has(position)) {
    state.filters.positions.delete(position);
  } else {
    state.filters.positions.add(position);
  }

  syncPositionButtonsUI();
  updateCollectionView();
});

syncPositionButtonsUI();
setupSettingsPanel();
applyLanguageToUi();
loadChampionsAndRender();
renderSelectedChampionCard("");
startLauncherRetry();

if (window.electronAPI?.onChampSelectUpdate) {
  window.electronAPI.onChampSelectUpdate((eventData) => {
    const nextSelectedChampionId = extractSelectedChampionId(eventData);
    if (nextSelectedChampionId == "-3") {
        renderSelectedChampionCard(nextSelectedChampionId);
        return;
      }
    if (nextSelectedChampionId) {
      renderSelectedChampionCard(nextSelectedChampionId);
    }
  });
}

if (window.electronAPI?.onChampSelectCrowdFavorite) {
  window.electronAPI.onChampSelectCrowdFavorite((eventData) => {
    const eventType = String(eventData?.eventType || "").toLowerCase();

    if (eventType === "delete") {
      renderCrowdFavorites([]);
      return;
    }

    const favoriteIds = extractCrowdFavoriteIds(eventData?.data ?? eventData);
    renderCrowdFavorites(favoriteIds);
  });
}

if (window.electronAPI?.onChampSelectPick) {
  window.electronAPI.onChampSelectPick((eventData) => {
    const eventType = String(eventData?.eventType || "").toLowerCase();    
    if (eventType === "delete") {
      return;
    }

    if (eventType === "create" || eventType === "update") {
      const nextSelectedChampionId = normalizeEntityId(eventData?.data);
      if (nextSelectedChampionId == "-3") {
        renderSelectedChampionCard(nextSelectedChampionId);
        return;
      }

      if (nextSelectedChampionId) {
        renderSelectedChampionCard(nextSelectedChampionId);
      } 
      
    }
  });
}

if (window.electronAPI?.onClientClose) {
  window.electronAPI.onClientClose(() => {
    state.isClientConnected = false;
    state.isSummonerConnected = false;
    state.isSummonerRetrying = false;
    state.summonerId = "";
    state.summonerPuuid = "";
    state.crowdFavoriteIds = [];
    stopSummonerRetry();
    renderSelectedChampionCard("");
    renderCrowdFavorites([]);
    renderDisconnectedSummonerCard(t("summoner.notConnected"));
    startLauncherRetry();
  });
}

if (window.electronAPI?.onGameStart) {
  window.electronAPI.onGameStart((eventData) => {
    const nextSelectedChampionId = extractGameStartChampionId(eventData);
    if (nextSelectedChampionId) {
      renderSelectedChampionCard(nextSelectedChampionId);
    }
  });
}
