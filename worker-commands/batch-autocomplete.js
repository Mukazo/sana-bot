const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Card = require('../models/Card');

module.exports = {
  async execute(data) {
    const jobId = data.jobId;

    try {
      if (!data.cardCode) throw new Error('Missing cardCode');
      if (!data.name) throw new Error('Missing name');
      if (!data.imageUrl) throw new Error('Missing imageUrl');

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
        batch: data.batch || null,
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
      return {
        ok: false,
        jobId,
        cardCode: data.cardCode,
        error: err.message
      };
    }
  }
};