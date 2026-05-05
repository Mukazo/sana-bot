const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    cardCode: { type: String, required: true, unique: true, index: true},
    name: {type: String, required: true},
    group: {type: String, rquired: true},
    groupalias: {type: String},
    rarity: {type: String, required: true},
    active: {type: Boolean, required: true},
    emoji: {type: String},
    era: { type: String },                                    // Era or expansion tag
  batch: {
  type: String,
  default: null
},
releaseAt: {
  type: Date,
  default: null
},
deactivateAt: { type: Date, default: null },
availableQuantity: { type: Number, default: null }, // max times pullable
timesPulled: { type: Number, default: 0 },          // counter
  localImagePath: { type: String},
  designerIds: { type: [String], default: [] },                             // Discord user ID of the designer(s)
}, {
  timestamps: true
});


cardSchema.index({ rarity: 1, active: 1, batch: 1 });

cardSchema.index({ group: 1 });
cardSchema.index({ groupalias: 1 });
cardSchema.index({ name: 1 });
cardSchema.index({ era: 1 });

cardSchema.index({ releaseAt: 1 });
cardSchema.index({ deactivateAt: 1 });

cardSchema.index({ availableQuantity: 1 });
cardSchema.index({ timesPulled: 1 });

module.exports = mongoose.model('Card', cardSchema);