// utils/cooldownConfig.js

module.exports = {
  Summon: 5 * 60 * 1000,
  Call: 2 * 60 * 1000,
  Duel: 10 * 60 * 1000,
  Miracle: 1 * 60 * 60 * 1000,
  Daily: 24 * 60 * 60 * 1000,
  Weekly: 7 * 24 * 60 * 60 * 1000,
  'Pick-Up': 15 * 60 * 1000,

  Assemble: {
    default: 25 * 60 * 1000,
    reductions: [
  { id: '1447006737042378772', percent: 10, group: 'patreon' }, // Daydream
  { id: '1447006766733725747', percent: 20, group: 'patreon' }, // Ethereal
  { id: '1447006809419415622', percent: 30, group: 'patreon' }, // Stardust
  { id: '1465789192326873231', percent: 40, group: 'patreon' }, // Pixie

  { id: '1447197066156703774', percent: 5 },  // Booster
  { id: '1459260084034076823', percent: 5 },  // /mukazobot
    ]
  },
  
  Route: {
    default: 20 * 60 * 1000,
    reductions: [
  { id: '1447006737042378772', percent: 15, group: 'patreon' }, // Daydream
  { id: '1447006766733725747', percent: 25, group: 'patreon' }, // Ethereal
  { id: '1447006809419415622', percent: 40, group: 'patreon' }, // Stardust
  { id: '1465789192326873231', percent: 50, group: 'patreon' }, // Pixie

  { id: '1447197066156703774', percent: 10 },  // Booster
  { id: '1459260084034076823', percent: 5 },  // /mukazobot
    ]
  },
  Bewitch: {
    default: 30 * 60 * 1000,
    reductions: [
  { id: '1447006737042378772', percent: 15, group: 'patreon' }, // Daydream
  { id: '1447006766733725747', percent: 25, group: 'patreon' }, // Ethereal
  { id: '1447006809419415622', percent: 40, group: 'patreon' }, // Stardust
  { id: '1465789192326873231', percent: 50, group: 'patreon' }, // Pixie

  { id: '1447197066156703774', percent: 10 },  // Booster
  { id: '1459260084034076823', percent: 5 },  // /mukazobot
    ]
  },
  Fortune: {
    default: 35 * 60 * 1000,
    reductions: [
  { id: '1447006737042378772', percent: 15, group: 'patreon' }, // Daydream
  { id: '1447006766733725747', percent: 25, group: 'patreon' }, // Ethereal
  { id: '1447006809419415622', percent: 40, group: 'patreon' }, // Stardust
  { id: '1465789192326873231', percent: 50, group: 'patreon' }, // Pixie

  { id: '1447197066156703774', percent: 10 },  // Booster
  { id: '1459260084034076823', percent: 5 },  // /mukazobot
    ]
  },
  // Add more as needed
};