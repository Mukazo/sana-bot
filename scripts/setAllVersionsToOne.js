require('dotenv').config();
const mongoose = require('mongoose');
const Card = require('../models/Card');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('Connected to MongoDB');

    const result = await Card.updateMany(
      {},
      {
        $set: {
          version: 1,
        },
      }
    );

    console.log(
      `Updated ${result.modifiedCount} cards to version 1`
    );

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();