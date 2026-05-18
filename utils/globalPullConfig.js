// utils/globalPullConfig.js

// Hardcoded rarity weights
const RARITY_WEIGHTS = {
  'Common': 41,
  'Rare': 29,
  'Ultra': 18,
  'Epic': 9,
  'Special': 2,
  'Mythic': 1,
};

// Hardcoded multipliers for eras (always lowercased keys!)
const ERA_MULTIPLIERS = {
};

// Hardcoded multipliers for specific card codes (always lowercased keys!)
const CODE_MULTIPLIERS = {
};

const MIN_WEIGHT = 0.00001;
const MAX_WEIGHT = 10000;

function getGlobalPullConfig() {
  return {
    rarityWeights: RARITY_WEIGHTS,
    eraMultipliers: ERA_MULTIPLIERS,
    codeMultipliers: CODE_MULTIPLIERS,
    minWeight: MIN_WEIGHT,
    maxWeight: MAX_WEIGHT,
  };
}

module.exports = { getGlobalPullConfig };