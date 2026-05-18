const { weightedPick } = require('./weightedPick');
const User = require('../models/User');
const { getPullPool } = require('./pullPoolCache');

async function getRandomCardFromRarity(rarity, userId, providedUser = null) {
  const user =
    providedUser ??
    await User.findOne({ userId })
      .select('enabledCategories blockedPulls')
      .lean();

  const { cards, weights } = await getPullPool(rarity, user);

  if (!cards.length) return null;

  return weightedPick(cards, weights);
}

module.exports = getRandomCardFromRarity;