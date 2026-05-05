module.exports = async interaction => {
  if (!interaction.isButton()) return false;

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Something went wrong.',
        ephemeral: true,
      }).catch(() => {});
    }

    return true;
};