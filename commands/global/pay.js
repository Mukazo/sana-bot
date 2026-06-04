const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Pay another user kittokens and/or pawprints')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user you want to pay')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('kittokens')
        .setDescription('Amount of kittokens to pay')
        .setMinValue(0)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('pawprints')
        .setDescription('Amount of pawprints to pay')
        .setMinValue(0)
        .setRequired(false)
    ),

  async execute(interaction) {
    const senderId = interaction.user.id;
    const receiver = interaction.options.getUser('user');
    const receiverId = receiver.id;

    const kittokens = interaction.options.getInteger('kittokens') || 0;
    const pawprints = interaction.options.getInteger('pawprints') || 0;

    if (receiver.bot) {
      return interaction.editReply({
        content: 'You cannot pay bots.',
      });
    }

    if (receiverId === senderId) {
      return interaction.editReply({
        content: 'You cannot pay yourself.',
      });
    }

    if (kittokens <= 0 && pawprints <= 0) {
      return interaction.editReply({
        content: 'You must pay at least **1 kittoken** or **1 pawprint**.',
      });
    }

    const sender = await User.findOne({ userId: senderId });

    if (!sender) {
      return interaction.editReply({
        content: 'You do not have an account yet.',
      });
    }

    if (sender.kittokens < kittokens) {
      return interaction.editReply({
        content: 'You do not have enough kittokens.',
      });
    }

    if (sender.pawprints < pawprints) {
      return interaction.editReply({
        content: 'You do not have enough pawprints.',
      });
    }

    let recipient = await User.findOne({ userId: receiverId });

    if (!recipient) {
      recipient = await User.create({
        userId: receiverId,
      });
    }

    sender.kittokens -= kittokens;
    sender.pawprints -= pawprints;

    recipient.kittokens += kittokens;
    recipient.pawprints += pawprints;

    await sender.save();
    await recipient.save();

    const rewards = [];

if (kittokens > 0) {
  rewards.push(`<:kittokens:1501647903486116081> **${kittokens.toLocaleString()}**`);
}

if (pawprints > 0) {
  rewards.push(`<:pawprints:1501648560700002506> **${pawprints.toLocaleString()}**`);
}

    const publicEmbed = new EmbedBuilder()
      .setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
  })
      .setColor('#de6ead')
      .setDescription([
        `${receiver} you have received ${rewards.join(' and ')} from ${interaction.user} ༄.° `,
      ].filter(Boolean).join('\n'));

    const sentMessage = await interaction.editReply({
      embeds: [publicEmbed],
    });

    const messageLink = sentMessage.url;

    const dmEmbed = new EmbedBuilder()
      .setColor('#de6ead')
      .setDescription([
        `${interaction.user} paid you ${rewards.join(' and ')}༄.° `,
        '',
        `> **New Balance:** <:kittokens:1501647903486116081> ${recipient.kittokens.toLocaleString()} & <:pawprints:1501648560700002506> ${recipient.pawprints.toLocaleString()}`,
        `[Jump to payment message](${messageLink})`,
      ].filter(Boolean).join('\n'));

    await receiver.send({
      embeds: [dmEmbed],
    }).catch(() => null);
  },
};