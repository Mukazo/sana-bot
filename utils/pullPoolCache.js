const Card = require('../models/Card');
const { getGlobalPullConfig } = require('./globalPullConfig');
const buildPullFilter = require('./buildPullFilter');

const CACHE = new Map();
const IN_FLIGHT = new Map();

const TTL_MS = 60_000;
const MAX_ENTRIES = 100;

function makeKey(rarity, user) {
  const categories = [...(user?.enabledCategories || [])].sort().join(',');
  const blockedGroups = [...(user?.blockedPulls?.groups || [])].sort().join(',');
  const blockedNames = [...(user?.blockedPulls?.names || [])].sort().join(',');
  const blockedPairs = [...(user?.blockedPulls?.pairs || [])]
    .map(pair => `${pair.group}:${pair.name}`)
    .sort()
    .join(',');

  return `${rarity}::${categories}::${blockedGroups}::${blockedNames}::${blockedPairs}`;
}

function pruneCache() {
  const now = Date.now();

  for (const [key, entry] of CACHE.entries()) {
    if (entry.expiresAt <= now) {
      CACHE.delete(key);
    }
  }

  if (CACHE.size <= MAX_ENTRIES) return;

  const sorted = [...CACHE.entries()].sort(
    (a, b) => a[1].expiresAt - b[1].expiresAt
  );

  while (sorted.length > MAX_ENTRIES) {
    const [oldestKey] = sorted.shift();
    CACHE.delete(oldestKey);
  }
}

async function buildPool(rarity, user) {
  const filter = buildPullFilter(rarity, user);

  const cards = await Card.find(filter)
    .select(
      'cardCode era group name rarity emoji localImagePath designerIds discordPermalinkImage imgurImageLink'
    )
    .lean();

  if (!cards.length) {
    return { cards: [], weights: [] };
  }

  const cfg = getGlobalPullConfig();
  const { eraMultipliers, codeMultipliers, minWeight, maxWeight } = cfg;

  const weights = cards.map(card => {
    const eraKey = card.era ? String(card.era).toLowerCase() : '';
    const codeKey = card.cardCode ? String(card.cardCode).toLowerCase() : '';

    const eraMultiplier =
      eraKey && eraMultipliers[eraKey] !== undefined
        ? eraMultipliers[eraKey]
        : 1;

    const codeMultiplier =
      codeKey && codeMultipliers[codeKey] !== undefined
        ? codeMultipliers[codeKey]
        : 1;

    return Math.min(
      maxWeight,
      Math.max(minWeight, 1 * eraMultiplier * codeMultiplier)
    );
  });

  return { cards, weights };
}

async function getPullPool(rarity, user) {
  pruneCache();

  const key = makeKey(rarity, user);
  const now = Date.now();

  const cached = CACHE.get(key);

  if (cached && cached.expiresAt > now) {
    return cached;
  }

  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key);
  }

  const promise = (async () => {
    try {
      const built = await buildPool(rarity, user);

      const entry = {
        ...built,
        expiresAt: Date.now() + TTL_MS,
      };

      CACHE.set(key, entry);
      return entry;
    } finally {
      IN_FLIGHT.delete(key);
    }
  })();

  IN_FLIGHT.set(key, promise);
  return promise;
}

function clearPullPoolCache() {
  CACHE.clear();
  IN_FLIGHT.clear();
}

module.exports = {
  getPullPool,
  clearPullPoolCache,
};