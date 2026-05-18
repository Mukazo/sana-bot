const { getGlobalPullConfig } = require('./globalPullConfig');

function pickRarity() {
  const cfg = getGlobalPullConfig();
  const entries = Object.entries(cfg.rarityWeights);

  if (!entries.length) {
    throw new Error('No rarity weights configured');
  }

  const total = entries.reduce((sum, [, weight]) => {
    return sum + Number(weight || 0);
  }, 0);

  if (total <= 0) {
    throw new Error('Rarity weights must be greater than 0');
  }

  let roll = Math.random() * total;

  for (const [rarity, weight] of entries) {
    roll -= Number(weight || 0);

    if (roll <= 0) {
      return rarity;
    }
  }

  return entries[0][0];
}

module.exports = pickRarity;