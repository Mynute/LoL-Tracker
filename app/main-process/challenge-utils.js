/**
 * Ordered whitelist of challenge ids displayed in the app.
 * The order defines select dropdown order and rendering priority.
 * @type {number[]}
 */
const challengerFilterAndOrder = [602002, 602001, 101301, 210001, 210002, 202303, 120002, 401104, 401107, 401106];

/**
 * Filters and sorts challenge payload according to project-specific challenge ids.
 *
 * Supported payload shapes:
 * - Array: keeps only configured ids and sorts by configured order
 * - Object map: returns configured ids in order when present
 *
 * @param {unknown[]|Record<string, any>|unknown} payload
 * @returns {unknown[]|Record<string, any>|unknown}
 */
const filterAndSortChallenges = (payload) => {
  const selectedIds = new Set(challengerFilterAndOrder.map(String));
  const rankById = new Map(challengerFilterAndOrder.map((id, index) => [String(id), index]));

  if (Array.isArray(payload)) {
    const filteredChallenges = payload.filter((challenge) => {
      const challengeId = String(challenge?.challengeId ?? challenge?.id);
      return selectedIds.has(challengeId);
    });

    return filteredChallenges.sort((a, b) => {
      const rankA = rankById.get(String(a?.challengeId ?? a?.id));
      const rankB = rankById.get(String(b?.challengeId ?? b?.id));
      return rankA - rankB;
    });
  }

  if (payload && typeof payload === 'object') {
    return challengerFilterAndOrder
      .map((id) => {
        const key = String(id);
        const challenge = payload[key];
        if (!challenge) {
          return null;
        }

        if (challenge.challengeId || challenge.id) {
          return challenge;
        }

        return { ...challenge, challengeId: id };
      })
      .filter(Boolean);
  }

  return payload;
};

module.exports = {
  filterAndSortChallenges
};
