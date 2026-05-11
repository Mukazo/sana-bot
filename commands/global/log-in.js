const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log-in')
    .setDescription('Log in to begin your adventure with Sana!'),

  async execute(interaction) {
    const userId = interaction.user.id;

    const kittyReward = 2000;
    const pawprintReward = 2;

    // Check if user already exists
    const existingUser = await User.findOne({ userId });

    if (existingUser) {
      const embed = new EmbedBuilder()
        .setDescription(
          'Woah there! You have already begun your adventure with Sana~'
        )

      return interaction.editReply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    // Create new user with rewards
    const user = await User.create({
      userId,
      kittokens: kittyReward,
      pawprints: pawprintReward,
    });

    const embed = new EmbedBuilder()
      .setColor('#ffb6c1')
      .setDescription(`## ໒꒰ྀིᵔ ᵕ ᵔ ꒱ྀི১ Loading… \n- You have successfully landed on the adventure island! \nExplore further, fulfill quests and make new friends along the way! \n> <:kittokens:1501647903486116081> _Kittokens_ : **${kittyReward}** ♡ <:pawprints:1501648560700002506> _Pawprints_ : **${pawprintReward}**`)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))

    await interaction.editReply({
      embeds: [embed],
    });
  },
};