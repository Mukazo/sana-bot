const summon = require('./summon');

module.exports = async interaction => {
  if (!interaction.isButton()) return false;

  // Let command-specific collectors handle these buttons
  const collectorButtons = ['confirm', 'cancel'];

    if (interaction.customId.startsWith('summon:')) {
      await summon(interaction);
      return true;
    }

  if (collectorButtons.includes(interaction.customId)) {
    return false;
  }

  console.log(`Unhandled global button: ${interaction.customId}`);

  return false;
};