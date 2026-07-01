/**
 * Normalizes identifiers to a stable string value.
 * Numeric ids are returned without leading zeroes.
 * @param {unknown} value
 * @returns {string}
 */
export const normalizeEntityId = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }

  const numeric = Number.parseInt(text, 10);
  if (Number.isFinite(numeric)) {
    return String(numeric);
  }

  return text.toLowerCase();
};

/**
 * Converts champion icon paths to absolute HTTPS URLs.
 * @param {unknown} iconValue
 * @returns {string}
 */
export const normalizeIconUrl = (iconValue) => {
  if (typeof iconValue !== "string" || !iconValue.trim()) {
    return "";
  }

  const icon = iconValue.trim().replace("http://", "https://");
  if (/^https?:\/\//i.test(icon)) {
    return icon;
  }
  if (icon.startsWith("//")) {
    return `https:${icon}`;
  }
  if (icon.startsWith("/")) {
    return `https://cdn.merakianalytics.com${icon}`;
  }

  return `https://cdn.merakianalytics.com/${icon.replace(/^\.?\//, "")}`;
};

/**
 * Normalizes role aliases to League canonical positions.
 * @param {unknown} value
 * @returns {string}
 */
export const normalizePosition = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const upper = value.trim().toUpperCase();
  const map = {
    TOP: "TOP",
    JUNGLE: "JUNGLE",
    MID: "MIDDLE",
    MIDDLE: "MIDDLE",
    BOT: "BOTTOM",
    BOTTOM: "BOTTOM",
    ADC: "BOTTOM",
    SUPPORT: "UTILITY",
    UTILITY: "UTILITY"
  };

  return map[upper] || upper;
};

/**
 * Extracts and de-duplicates champion positions from multiple payload shapes.
 * @param {object} champion
 * @returns {string[]}
 */
export const extractPositions = (champion) => {
  const positions = [];

  if (Array.isArray(champion?.positions)) {
    positions.push(...champion.positions.map(normalizePosition));
  }

  if (typeof champion?.position === "string") {
    positions.push(normalizePosition(champion.position));
  }

  if (champion?.playstyleInfo && typeof champion.playstyleInfo === "object") {
    Object.entries(champion.playstyleInfo).forEach(([key, value]) => {
      if (value) {
        positions.push(normalizePosition(key));
      }
    });
  }

  return [...new Set(positions.filter(Boolean))];
};

/**
 * Formats numeric modifier values with a compact fixed precision.
 * @param {number} value
 * @returns {string|null}
 */
export const formatModifierNumber = (value) => {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(2)).toString();
};

/**
 * Converts multiplier values to percentage text (e.g. 1.1 -> 110%).
 * @param {number} value
 * @returns {string|null}
 */
export const formatModifierPercent = (value) => {
  if (!Number.isFinite(value)) {
    return null;
  }

  const scaled = Number((value * 100).toFixed(2));
  return `${scaled}%`;
};

/**
 * Converts camelCase stat keys to human-readable labels.
 * @param {string} value
 * @returns {string}
 */
export const humanizeModifierLabel = (value) => {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
};

/**
 * Uppercases the first letter when a non-empty string is provided.
 * @param {unknown} value
 * @returns {string}
 */
export const capitalizeFirstLetter = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const trimmedValue = value.trim();
  return trimmedValue.charAt(0).toUpperCase() + trimmedValue.slice(1);
};

/**
 * Extracts ARAM/URF modifiers from champion stats.
 * Flat value 1.0 is hidden and ability haste flat remains numeric.
 * @param {object} champion
 * @param {string} prefix
 * @returns {{label: string, value: string}[]}
 */
export const extractModeModifiers = (champion, prefix) => {
  if (!champion || typeof champion !== "object") {
    return [];
  }

  const modifierSource = champion.stats && typeof champion.stats === "object"
    ? champion.stats
    : champion;

  return Object.entries(modifierSource)
    .filter(([key, value]) => key.startsWith(prefix) && value && typeof value === "object")
    .map(([key, value]) => {
      const flat = Number(value.flat);
      const percent = Number(value.percent);
      const perLevel = Number(value.perLevel);
      const parts = [];
      const isAbilityHaste = key.toLowerCase().includes("abilityhaste");

      if (Number.isFinite(flat) && flat !== 1) {
        parts.push(isAbilityHaste ? formatModifierNumber(flat) : formatModifierPercent(flat));
      }

      if (Number.isFinite(percent) && percent !== 0) {
        parts.push(`percent ${formatModifierNumber(percent)}`);
      }

      if (Number.isFinite(perLevel) && perLevel !== 0) {
        parts.push(`per lvl ${formatModifierNumber(perLevel)}`);
      }

      return {
        label: humanizeModifierLabel(key.slice(prefix.length)),
        value: parts.join(" | ")
      };
    })
    .filter((modifier) => modifier.value)
    .sort((left, right) => left.label.localeCompare(right.label));
};

/**
 * Converts champion JSON object to sorted renderer entries.
 * @param {Record<string, object>} championsObject
 * @returns {{id: string, name: string, iconUrl: string, positions: string[], raw: object}[]}
 */
export const toChampionList = (championsObject) => {
  return Object.entries(championsObject || {})
    .map(([entryKey, champion], index) => {
      const championId =
        normalizeEntityId(champion?.id) ||
        normalizeEntityId(champion?.key) ||
        normalizeEntityId(entryKey) ||
        normalizeEntityId(index + 1);

      return {
        id: championId,
        name: champion?.name || champion?.key || `Champion ${index + 1}`,
        iconUrl: normalizeIconUrl(champion?.icon),
        positions: extractPositions(champion),
        raw: champion
      };
    })
    .filter((champion) => champion.iconUrl)
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Builds a CommunityDragon profile icon URL.
 * @param {unknown} profileIconId
 * @returns {string}
 */
export const getProfileIconUrl = (profileIconId) => {
  const numericId = Number.parseInt(profileIconId, 10);
  if (!Number.isFinite(numericId)) {
    return "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg";
  }

  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${numericId}.jpg`;
};
