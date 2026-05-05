const axios = require('axios');
const fs = require('fs');
const path = require('path');

const Card = require('../models/Card');
const Batch = require('../models/Batch');

module.exports = {
  async execute(data) {
    const jobId = data.jobId;

    try {
      if (!data.cardCode) throw new Error('Missing cardCode');
      if (!data.name) throw new Error('Missing name');
      if (!data.imageUrl) throw new Error('Missing imageUrl');

      let deactivateAt = null;

      // This replaces your old select menu finalization logic
      if (data.batch) {
        const batch = await Batch.findOne({ code: data.batch }).lean();

        if (!batch) {
          throw new Error(`Batch not found: ${data.batch}`);
        }

        deactivateAt = batch.deactivateCardsAt ?? null;
      }

      const image = await axios.get(data.imageUrl, {
        responseType: 'arraybuffer'
      });

      const imageDir = path.join(__dirname, '..', 'images');

      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      const imagePath = path.join(imageDir, `${data.cardCode}.png`);

      fs.writeFileSync(imagePath, image.data);

      await Card.create({
        cardCode: data.cardCode,
        name: data.name,
        rarity: data.rarity,
        namealias: data.namealias,
        groupalias: data.groupalias,
        emoji: data.emoji,
        group: data.group,
        era: data.era,

        // finalized batch values
        batch: data.batch || null,
        deactivateAt,

        active: data.active,
        availableQuantity: data.availableQuantity,
        designerIds: data.designerIds,
        localImagePath: imagePath,
        createdBy: data.userId
      });

      return {
        ok: true,
        jobId,
        cardCode: data.cardCode,
        batch: data.batch || null
      };
    } catch (err) {
      console.error('[CARD CREATE ERROR]', err);

      return {
        ok: false,
        jobId,
        cardCode: data.cardCode,
        error: err.message
      };
    }
  }
};