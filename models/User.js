const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
kittokens: { type: Number, default: 1 },
chocolates: { type: Number, default: 1 },
dailystreak: {
    count: { type: Number, default: 0},
    lastClaim: { type: Date, default: null }
  },
weeklystreak: {
    count: { type: Number, default: 0},
    lastClaim: { type: Date, default: null }
  },
  pityData: {
  type: Map,
  of: {
    count: { type: Number, default: 0 },
    codes: [{ type: String }],
    lastUsed: { type: Date }
  },
  default: {}
},
blockedPulls: {
  groups: {
    type: [String],
    default: []
  },
  names: {
    type: [String],
    default: []
  },
  pairs: {
    type: [
      {
        group: String,
        name: String
      }
    ],
    default: []
  }
},
reminderPreferences: {
  type: Map,
  of: String, // 'off' | 'dm' | 'channel'
  default: {}
},
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);