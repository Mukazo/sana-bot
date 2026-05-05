module.exports = async interaction => {
  if (!interaction.isButton()) return false;

  // Let command-specific collectors handle these buttons
  const collectorButtons = ['confirm', 'cancel'];

  if (collectorButtons.includes(interaction.customId)) {
    return false;
  }

  console.log(`Unhandled global button: ${interaction.customId}`);

  return false;
};