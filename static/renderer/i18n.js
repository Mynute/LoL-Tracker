const LANGUAGE_STORAGE_KEY = "appLanguage";

const translations = {
  fr: {
    "app.title": "League of Legends Challenges Tracker",
    "settings.openOptions": "Ouvrir les options",
    "settings.application": "Application",
    "settings.version": "Version",
    "settings.update": "Mise a jour",
    "settings.language": "Langue",
    "settings.luxMode": "Mode Lux",
    "settings.checkUpdates": "Verifier les mises a jour",
    "settings.update.unable": "Impossible de verifier les mises a jour",
    "settings.update.checking": "Verification...",
    "update.checking": "Verification...",
    "update.available": "Mise a jour disponible{version}",
    "update.downloading": "Telechargement...",
    "update.downloadingPercent": "Telechargement {percent}%",
    "update.ready": "Pret a installer",
    "update.uptodate": "A jour",
    "update.error": "Erreur: {message}",
    "update.idle": "Inactif",
    "challenge.label": "Challenge",
    "challenge.refresh": "Rafraichir le challenge",
    "filters.title": "Filtres",
    "filters.searchPlaceholder": "Nom du champion",
    "filters.hideCompleted": "Cacher les champions reussis",
    "collection.title": "Collection",
    "collection.titleWithCount": "Collection {completed}/{total}",
    "crowdFavorite.title": "Favoris de l'equipe",
    "summoner.connected": "Connecté",
    "summoner.notConnected": "Non connecté",
    "summoner.unknown": "Non connecté",
    "summoner.noTag": "Sans tag",
    "summoner.level": "Niveau {level}",
    "summoner.waitingLauncher": "En attente du launcher ({seconds}s)",
    "summoner.waitingProfile": "Récupération du profil ({seconds}s)",
    "summoner.iconAlt": "Icone de profil de {name}",
    "selected.none": "Aucun champion",
    "selected.bravery": "Brave",
    "selected.unknownStatus": "Statut inconnu",
    "selected.braveryWaiting": "En attente du début de la partie",
    "selected.valid": "Champion valide pour le challenge",
    "selected.invalid": "Champion non valide pour le challenge",
    "selected.aram.noneActive": "Aucun modificateur ARAM actif.",
    "selected.urf.noneActive": "Aucun modificateur URF actif.",
    "selected.aram.none": "Aucun modificateur ARAM.",
    "selected.urf.none": "Aucun modificateur URF.",
    "cards.viewStats": "Voir les stats de {name}",
    "cards.iconUnavailable": "icone de {name} indisponible",
    "cards.empty": "Aucun champion pour ces filtres."
  },
  en: {
    "app.title": "League of Legends Challenges Tracker",
    "settings.openOptions": "Open settings",
    "settings.application": "Application",
    "settings.version": "Version",
    "settings.update": "Update",
    "settings.language": "Language",
    "settings.luxMode": "Lux Mode",
    "settings.checkUpdates": "Check for updates",
    "settings.update.unable": "Unable to check updates",
    "settings.update.checking": "Checking...",
    "update.checking": "Checking...",
    "update.available": "Update available{version}",
    "update.downloading": "Downloading...",
    "update.downloadingPercent": "Downloading {percent}%",
    "update.ready": "Ready to install",
    "update.uptodate": "Up to date",
    "update.error": "Error: {message}",
    "update.idle": "Idle",
    "challenge.label": "Challenge",
    "challenge.refresh": "Refresh challenge",
    "filters.title": "Filters",
    "filters.searchPlaceholder": "Champion name",
    "filters.hideCompleted": "Hide completed champions",
    "collection.title": "Collection",
    "collection.titleWithCount": "Collection {completed}/{total}",
    "crowdFavorite.title": "Crowd Favorite",
    "summoner.connected": "Connected",
    "summoner.notConnected": "Not connected",
    "summoner.unknown": "Not connected",
    "summoner.noTag": "No tag",
    "summoner.level": "Level {level}",
    "summoner.waitingLauncher": "Waiting for launcher ({seconds}s)",
    "summoner.waitingProfile": "Fetching profile ({seconds}s)",
    "summoner.iconAlt": "{name} profile icon",
    "selected.none": "No champion",
    "selected.bravery": "Bravery",
    "selected.unknownStatus": "Unknown status",
    "selected.braveryWaiting": "Waiting for the game to start",
    "selected.valid": "Champion valid for the challenge",
    "selected.invalid": "Champion not valid for the challenge",
    "selected.aram.noneActive": "No active ARAM modifiers.",
    "selected.urf.noneActive": "No active URF modifiers.",
    "selected.aram.none": "No ARAM modifiers.",
    "selected.urf.none": "No URF modifiers.",
    "cards.viewStats": "View stats for {name}",
    "cards.iconUnavailable": "{name} icon unavailable",
    "cards.empty": "No champion for these filters."
  }
};

const isSupportedLanguage = (value) => value === "fr" || value === "en";

const normalizeLanguage = (value) => {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!text) {
    return "fr";
  }

  if (text.startsWith("fr")) {
    return "fr";
  }

  if (text.startsWith("en")) {
    return "en";
  }

  return "fr";
};

const detectInitialLanguage = () => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(stored)) {
      return stored;
    }
  } catch (error) {
    // Ignore storage read failures and fallback to navigator language.
  }

  return normalizeLanguage(navigator.language);
};

let currentLanguage = detectInitialLanguage();

export const getLanguage = () => currentLanguage;

export const setLanguage = (language) => {
  const normalizedLanguage = normalizeLanguage(language);
  currentLanguage = normalizedLanguage;

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
  } catch (error) {
    // Ignore storage write failures.
  }

  return currentLanguage;
};

export const t = (key, params = {}) => {
  const dictionary = translations[currentLanguage] || translations.fr;
  const fallbackDictionary = translations.fr;
  const rawTemplate = dictionary[key] || fallbackDictionary[key] || key;

  return rawTemplate.replace(/\{(\w+)\}/g, (_, token) => {
    const value = params[token];
    return value === undefined || value === null ? "" : String(value);
  });
};
