module.exports = function generateVersion({ version = 1 }) {
  const versionEmojis = {
    1: '<:V1:1502351394647314522>', // Version 1 emoji
    2: '<:two:1452220520027394150>', // Version 2 emoji
  };

  let value = 1;

  if (typeof version === 'string') {
    const match = version.match(/^(\d)/); // handles "3" or "3Alpha"
    if (match) value = parseInt(match[1]);
  } else if (typeof version === 'number') {
    value = version;
  }

  const clamped = Math.max(1, Math.min(2, value));
  return versionEmojis[clamped] || '';
};