const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

const COST = 1500;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('craft')
    .setDescription('Exchange kittokens into pawprints!')
    .addIntegerOption(opt =>
      opt.setName('pawprints')
        .setDescription('amount of pawprints')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    let user = await User.findOne({ userId });
    if (!user) return interaction.editReply({ content: 'User not found.', ephemeral: true });

    const requested = interaction.options.getInteger('pawprints');

    // Initialize or reset convert log
    const totalCost = requested * COST;

    if (user.kittokens < totalCost) {
      return interaction.editReply({ content: `You need <:kittokens:1501647903486116081> **${totalCost.toLocaleString()}** to craft <:pawprints:1501648560700002506> **${requested}** !`, ephemeral: true });
    }

    // Perform conversion
    user.kittokens -= totalCost;
    user.pawprints += requested;
    await user.save();
    

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#523f23')
          .setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
  })
          .setDescription([
            `## Crafting table ⋆˚🛠️˖°`,
            `- You have crafted <:pawprints:1501648560700002506> **${requested}** with Chococats help! <a:blk_chococatclap:1507454723974889654>`,
            `-# ⌯⌲ This costed you <:kittokens:1501647903486116081> **${totalCost.toLocaleString()}**.`,
          ].filter(Boolean).join('\n'))
      ],
      ephemeral: true
    });
  }
};