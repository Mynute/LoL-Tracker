import {
  collectionTitleNode,
  crowdFavoriteTitleNode,
  crowdFavoriteList,
  summonerCardNode,
  summonerIconNode,
  summonerStateNode,
  summonerNameNode,
  summonerLevelNode,
  selectedChampionCardNode,
  selectedChampionIconFrameNode,
  selectedChampionIconNode,
  selectedChampionStatusNode,
  selectedChampionNameNode,
  selectedChampionTitleNode,
  selectedChampionAramStatsNode,
  selectedChampionUrfStatsNode,
  selectedChampionArenaPanelNode,
  selectedChampionArenaToggleNode,
  selectedChampionArenaStatsNode,
  positionButtonsNode
} from "./dom.js";
import { state } from "./state.js";
import {
  normalizeEntityId,
  normalizePosition,
  extractModeModifiers,
  capitalizeFirstLetter,
  getProfileIconUrl
} from "./helpers.js";
import { t } from "./i18n.js";

/**
 * Updates collection header text.
 * @param {string} text
 */
export const setCollection = (text) => {
  collectionTitleNode.textContent = text;
};

/**
 * Renders connected summoner info card.
 * @param {object} summoner
 */
export const renderSummonerCard = (summoner) => {
  const displayName = summoner?.displayName || summoner?.gameName || t("summoner.unknown");
  const level = Number.isFinite(summoner?.summonerLevel) ? summoner.summonerLevel : "--";
  const tag = summoner?.tagLine || summoner?.puuid || t("summoner.noTag");

  summonerCardNode.classList.remove("is-disconnected");
  summonerStateNode.textContent = t("summoner.connected");
  summonerNameNode.textContent = `${displayName}#${tag}`;
  summonerLevelNode.textContent = t("summoner.level", { level });
  summonerIconNode.src = getProfileIconUrl(summoner?.profileIconId);
  summonerIconNode.alt = t("summoner.iconAlt", { name: displayName });
};

/**
 * Renders disconnected/waiting state for summoner card.
 * @param {string=} message
 */
export const renderDisconnectedSummonerCard = (message) => {
  summonerCardNode.classList.add("is-disconnected");
  summonerStateNode.textContent = message || t("summoner.notConnected");
  summonerNameNode.textContent = t("summoner.unknown");
  summonerLevelNode.textContent = t("summoner.level", { level: "--" });
};

/**
 * Renders ARAM/URF modifier list into target node.
 * @param {HTMLElement} targetNode
 * @param {{label:string,value:string}[]} modifiers
 * @param {string} emptyLabel
 */
export const renderModeStats = (targetNode, modifiers, emptyLabel) => {
  targetNode.innerHTML = "";

  if (!modifiers.length) {
    const item = document.createElement("li");
    item.className = "mode-stat-empty";
    item.textContent = emptyLabel;
    targetNode.append(item);
    return;
  }

  const fragment = document.createDocumentFragment();

  modifiers.forEach((modifier) => {
    const item = document.createElement("li");
    item.className = "mode-stat-item";

    const label = document.createElement("span");
    label.className = "mode-stat-label";
    label.textContent = modifier.label;

    const value = document.createElement("span");
    value.className = "mode-stat-value";
    value.textContent = modifier.value;

    item.append(label, value);
    fragment.append(item);
  });

  targetNode.append(fragment);
};

/**
 * Applies Arena panel collapsed state to UI.
 * @param {boolean} isCollapsed
 */
export const setArenaPanelCollapsed = (isCollapsed) => {
  if (!selectedChampionArenaPanelNode || !selectedChampionArenaToggleNode) {
    return;
  }

  selectedChampionArenaPanelNode.classList.toggle("is-collapsed", Boolean(isCollapsed));
  selectedChampionArenaToggleNode.setAttribute("aria-expanded", String(!isCollapsed));
};

/**
 * Renders Arena ability changes for selected champion.
 * @param {HTMLElement} targetNode
 * @param {Record<string, string[] | string | {name?:string,icon?:string,changes?:string[]|string}>} arenaChanges
 * @param {string} emptyLabel
 * @param {Record<string, Array<{name?:string,icon?:string}>>=} abilities
 */
const renderArenaChanges = (targetNode, arenaChanges, emptyLabel, abilities = {}) => {
  targetNode.innerHTML = "";

  const resolveAbilityMeta = (abilityKey) => {
    const defaultMeta = { abilityName: abilityKey, abilityIcon: "" };
    const bucket = abilities?.[abilityKey];
    if (!Array.isArray(bucket) || !bucket.length) {
      return defaultMeta;
    }

    const first = bucket[0] || {};
    return {
      abilityName: typeof first.name === "string" && first.name.trim() ? first.name : abilityKey,
      abilityIcon: typeof first.icon === "string" ? first.icon : ""
    };
  };

  const entries = Object.entries(arenaChanges || {})
    .map(([abilityKey, payload]) => {
      if (Array.isArray(payload)) {
        const meta = resolveAbilityMeta(abilityKey);
        return {
          abilityKey,
          abilityName: meta.abilityName,
          abilityIcon: meta.abilityIcon,
          changes: payload
        };
      }

      if (typeof payload === "string") {
        const meta = resolveAbilityMeta(abilityKey);
        return {
          abilityKey,
          abilityName: meta.abilityName,
          abilityIcon: meta.abilityIcon,
          changes: [payload]
        };
      }

      if (payload && typeof payload === "object") {
        const meta = resolveAbilityMeta(abilityKey);
        const rawChanges = payload.changes;
        const changes = Array.isArray(rawChanges)
          ? rawChanges
          : typeof rawChanges === "string"
            ? [rawChanges]
            : [];

        return {
          abilityKey,
          abilityName: meta.abilityName,
          abilityIcon: meta.abilityIcon,
          changes
        };
      }

      return {
        abilityKey,
        ...resolveAbilityMeta(abilityKey),
        changes: []
      };
    })
    .filter((entry) => entry.changes.some((change) => typeof change === "string" && change.trim().length > 0));

  if (!entries.length) {
    const item = document.createElement("li");
    item.className = "mode-stat-empty";
    item.textContent = emptyLabel;
    targetNode.append(item);
    return;
  }

  const abilityOrder = ["General", "P", "Q", "W", "E", "R"];
  const abilityOrderMap = new Map(abilityOrder.map((value, index) => [value, index]));

  entries.sort((left, right) => {
    const leftRank = abilityOrderMap.has(left.abilityKey)
      ? abilityOrderMap.get(left.abilityKey)
      : Number.MAX_SAFE_INTEGER;
    const rightRank = abilityOrderMap.has(right.abilityKey)
      ? abilityOrderMap.get(right.abilityKey)
      : Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.abilityName.localeCompare(right.abilityName);
  });

  const fragment = document.createDocumentFragment();

  entries.forEach(({ abilityKey, abilityName, abilityIcon, changes }) => {
    const item = document.createElement("li");
    item.className = "arena-change-item";

    const abilityNode = document.createElement("p");
    abilityNode.className = "arena-change-ability";

    if (abilityIcon) {
      const iconNode = document.createElement("img");
      iconNode.className = "arena-change-ability-icon";
      iconNode.src = abilityIcon;
      iconNode.alt = "";
      iconNode.loading = "lazy";
      iconNode.decoding = "async";
      abilityNode.append(iconNode);
    }

    const labelNode = document.createElement("span");
    labelNode.className = "arena-change-ability-label";
    if (abilityKey === "General") {
      labelNode.textContent = t("selected.arena.general");
    } else {
      labelNode.textContent = abilityName
        ? `${abilityKey} - ${abilityName}`
        : abilityKey;
    }
    abilityNode.append(labelNode);

    const linesNode = document.createElement("ul");
    linesNode.className = "arena-change-lines";

    changes.forEach((change) => {
      if (typeof change !== "string" || !change.trim()) {
        return;
      }

      const line = document.createElement("li");
      line.className = "arena-change-line";
      const trimmedChange = change.trim();
      const newEffectMatch = trimmedChange.match(/^(New Effect:)\s*(.*)$/i);

      if (newEffectMatch) {
        const strongPrefix = document.createElement("strong");
        strongPrefix.textContent = newEffectMatch[1];
        line.append(strongPrefix);

        if (newEffectMatch[2]) {
          line.append(document.createTextNode(` ${newEffectMatch[2]}`));
        }
      } else {
        line.textContent = change;
      }
      linesNode.append(line);
    });

    if (!linesNode.childElementCount) {
      return;
    }

    item.append(abilityNode, linesNode);
    fragment.append(item);
  });

  if (!fragment.childElementCount) {
    const item = document.createElement("li");
    item.className = "mode-stat-empty";
    item.textContent = emptyLabel;
    targetNode.append(item);
    return;
  }

  targetNode.append(fragment);
};

/**
 * Synchronizes selected champion class on all champion cards.
 */
export const syncSelectedChampionCardsUI = () => {
  document.querySelectorAll(".card[data-champion-id]").forEach((cardNode) => {
    const isSelected = normalizeEntityId(cardNode.dataset.championId) === state.selectedChampionId;
    cardNode.classList.toggle("is-selected", isSelected);
    cardNode.setAttribute("aria-pressed", String(isSelected));
  });
};

/**
 * Renders selected champion card and mode stats.
 * @param {unknown} championId
 */
export const renderSelectedChampionCard = (championId) => {
  const normalizedId = normalizeEntityId(championId);
  const isBraverySelection = normalizedId == "-3";
  const champion = state.champions.find((entry) => entry.id === normalizedId) || null;

  state.selectedChampionId = champion?.id || (isBraverySelection ? normalizedId : "");

  if (isBraverySelection) {
    selectedChampionCardNode.classList.remove("is-empty");
    selectedChampionIconFrameNode.classList.remove("is-validated");
    selectedChampionIconFrameNode.classList.add("is-pending");
    selectedChampionStatusNode.textContent = "?";
    selectedChampionStatusNode.setAttribute("aria-label", t("selected.unknownStatus"));
    selectedChampionNameNode.textContent = t("selected.bravery");
    selectedChampionTitleNode.textContent = t("selected.braveryWaiting");
    selectedChampionIconNode.src = "assets/bravery.png";
    selectedChampionIconNode.alt = t("selected.bravery");
    renderModeStats(selectedChampionAramStatsNode, [], t("selected.aram.noneActive"));
    renderModeStats(selectedChampionUrfStatsNode, [], t("selected.urf.noneActive"));
    renderArenaChanges(selectedChampionArenaStatsNode, null, t("selected.arena.noneActive"));
    syncSelectedChampionCardsUI();
    return;
  }

  if (!champion) {
    selectedChampionCardNode.classList.add("is-empty");
    selectedChampionIconFrameNode.classList.remove("is-validated");
    selectedChampionIconFrameNode.classList.add("is-pending");
    selectedChampionStatusNode.textContent = "?";
    selectedChampionStatusNode.setAttribute("aria-label", t("selected.unknownStatus"));
    selectedChampionNameNode.textContent = t("selected.none");
    selectedChampionTitleNode.textContent = "";
    selectedChampionIconNode.src = "assets/default.png";
    selectedChampionIconNode.alt = "";
    renderModeStats(selectedChampionAramStatsNode, [], t("selected.aram.noneActive"));
    renderModeStats(selectedChampionUrfStatsNode, [], t("selected.urf.noneActive"));
    renderArenaChanges(selectedChampionArenaStatsNode, null, t("selected.arena.noneActive"));
    syncSelectedChampionCardsUI();
    return;
  }

  selectedChampionCardNode.classList.remove("is-empty");
  const isValidated = state.completedChampionIds.has(champion.id);

  selectedChampionIconFrameNode.classList.toggle("is-validated", isValidated);
  selectedChampionIconFrameNode.classList.toggle("is-pending", !isValidated);
  selectedChampionStatusNode.textContent = isValidated ? "✓" : "!";
  selectedChampionStatusNode.setAttribute(
    "aria-label",
    isValidated ? t("selected.valid") : t("selected.invalid")
  );
  selectedChampionNameNode.textContent = champion.name;
  selectedChampionTitleNode.textContent = capitalizeFirstLetter(champion.raw?.title);
  selectedChampionIconNode.src = champion.iconUrl;
  selectedChampionIconNode.alt = `${champion.name} icon`;
  renderModeStats(
    selectedChampionAramStatsNode,
    extractModeModifiers(champion.raw, "aram"),
    t("selected.aram.none")
  );
  renderModeStats(
    selectedChampionUrfStatsNode,
    extractModeModifiers(champion.raw, "urf"),
    t("selected.urf.none")
  );
  renderArenaChanges(
    selectedChampionArenaStatsNode,
    champion.raw?.arenaChanges || champion.raw?.arena_changes,
    t("selected.arena.none"),
    champion.raw?.abilities
  );
  syncSelectedChampionCardsUI();
};

/**
 * Creates an interactive champion card element.
 * @param {{id:string,name:string,iconUrl:string}} champion
 * @param {boolean} isCompleted
 * @returns {HTMLLIElement}
 */
export const createCard = (champion, isCompleted) => {
  const item = document.createElement("li");
  item.className = "card";
  item.dataset.championId = champion.id;
  item.tabIndex = 0;
  item.setAttribute("role", "button");
  item.setAttribute("aria-label", t("cards.viewStats", { name: champion.name }));
  item.setAttribute("aria-pressed", String(state.selectedChampionId === champion.id));

  if (state.selectedChampionId === champion.id) {
    item.classList.add("is-selected");
  }

  if (isCompleted) {
    item.classList.add("is-completed");
  }

  const image = document.createElement("img");
  image.className = "thumb";
  image.src = champion.iconUrl;
  image.alt = `${champion.name} icon`;
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    image.alt = t("cards.iconUnavailable", { name: champion.name });
    image.style.opacity = "0.35";
  });

  if (isCompleted) {
    const badge = document.createElement("span");
    badge.className = "card-check";
    badge.textContent = "✓";
    item.append(badge);
  }

  const caption = document.createElement("p");
  caption.className = "caption";
  caption.textContent = champion.name;

  item.append(image, caption);
  return item;
};

/**
 * Renders champion card list (or empty state).
 * @param {HTMLElement} targetList
 * @param {Array<{id:string,name:string,iconUrl:string}>} champions
 * @param {Set<string>=} completedSet
 */
export const renderGrid = (targetList, champions, completedSet = new Set()) => {
  targetList.innerHTML = "";

  if (!champions.length) {
    const emptyMessage = document.createElement("li");
    emptyMessage.className = "empty";
    emptyMessage.textContent = t("cards.empty");
    targetList.append(emptyMessage);
    return;
  }

  const fragment = document.createDocumentFragment();
  champions.forEach((champion) => {
    const isCompleted = completedSet.has(champion.id);
    fragment.append(createCard(champion, isCompleted));
  });
  targetList.append(fragment);
};

/**
 * Handles champion card click selection.
 * @param {EventTarget} target
 */
export const handleChampionCardSelection = (target) => {
  const cardNode = target.closest(".card[data-champion-id]");
  if (!cardNode) {
    return;
  }

  renderSelectedChampionCard(cardNode.dataset.championId);
};

/**
 * Handles keyboard selection for champion cards.
 * @param {KeyboardEvent} event
 */
export const handleChampionCardKeydown = (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const cardNode = event.target.closest(".card[data-champion-id]");
  if (!cardNode) {
    return;
  }

  event.preventDefault();
  renderSelectedChampionCard(cardNode.dataset.championId);
};

/**
 * Shows or hides crowd favorite section.
 * @param {boolean} isVisible
 */
export const setCrowdFavoriteVisibility = (isVisible) => {
  crowdFavoriteTitleNode.hidden = !isVisible;
  crowdFavoriteList.hidden = !isVisible;
};

/**
 * Applies active state styles to position filter buttons.
 */
export const syncPositionButtonsUI = () => {
  positionButtonsNode.querySelectorAll(".position-btn").forEach((button) => {
    const position = normalizePosition(button.dataset.position);
    const isActive = state.filters.positions.has(position);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};
