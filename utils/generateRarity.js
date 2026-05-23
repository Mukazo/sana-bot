module.exports = function generateRarity({ rarity = 'Common' }) {
  if (!rarity) rarity = 'Common';

  const rarityEmojis = {
    common: '<:common:1500053687941464104>',
    rare: '<:rare:1500053749656453240>',
    ultra: '<:ultra:1500053798742261881>',
    epic: '<:epic:1505252146344497322>',
    special: '<:sulk:1496905608731824278>',
    mythic: '<:tt_blush:1496905353911079044>',
    prestige: '<:Yippeeyay:1496905291298504754>'
  };

  const normalized = String(rarity).trim().toLowerCase();

  if (normalized.includes('prestige')) return rarityEmojis.prestige;
  if (normalized.includes('mythic')) return rarityEmojis.mythic;
  if (normalized.includes('special')) return rarityEmojis.special;
  if (normalized.includes('epic')) return rarityEmojis.epic;
  if (normalized.includes('ultra')) return rarityEmojis.ultra;
  if (normalized.includes('rare')) return rarityEmojis.rare;
  if (normalized.includes('common')) return rarityEmojis.common;

  return rarityEmojis.common;
};