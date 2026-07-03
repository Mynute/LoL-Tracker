import { DEFAULT_CHALLENGE_ID } from "./config.js";

export const state = {
  champions: [],
  crowdFavoriteIds: [],
  summonerId: "",
  completedChampionIds: new Set(),
  challengePayload: null,
  selectedChallengeId: DEFAULT_CHALLENGE_ID,
  selectedChampionId: "",
  isClientConnected: false,
  isConnecting: false,
  autoConnectTimer: null,
  launcherRetrySecondsRemaining: 0,
  isSummonerConnected: false,
  isSummonerRetrying: false,
  summonerRetryTimer: null,
  summonerRetrySecondsRemaining: 0,
  filters: {
    query: "",
    positions: new Set(),
    hideCompleted: false
  }
};
