const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const { safeReply } = require('../../utils/safeReply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription(`view yours or another player's balance`)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('provide another user to view')
        .setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userId = targetUser.id;

    let userData = await User.findOne({ userId });

    const embed = new EmbedBuilder()
  .setColor('#D8E34B')
  .setDescription(`## ✧ ࣪.•  ꒰ <:keroppi:1502031714778742784> ꒱ __**${targetUser.user} Keroppi Bank**__ !! 𓈒⁺*♪* ♫\n\n ꒷₊˚ <:kittokens:1501647903486116081> __Kittokens__ : **${userData.kittokens.toLocaleString()}**\n  .     𓂃 ଓ  ۪   ݁   ⌁\n ꒷₊˚ <:pawprints:1501648560700002506> __Pawprints__ : **${userData.pawprints.toLocaleString()}**`)

    return safeReply(interaction, { embeds: [embed] });
  }
};