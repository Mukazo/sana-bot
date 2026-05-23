const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const User = require('../../models/User');
const cooldowns = require('../../utils/cooldownManager');
const cooldownConfig = require('../../utils/cooldownConfig');
const handleReminders = require('../../utils/reminderHandler');

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pick-up')
    .setDescription('Scramble through lost kittokens'),

  async execute(interaction) {
    const userId = interaction.user.id;

    const commandName = 'Pick-Up';
    const cooldownDuration = cooldownConfig[commandName];

    if (await cooldowns.isOnCooldown(userId, commandName)) {
      const nextTime = await cooldowns.getCooldownTimestamp(
        userId,
        commandName
      );

      return interaction.editReply({
        content: `*/pick-up* is currently on cooldown! You can use it again ${nextTime}`,
      });
    }

    let user = await User.findOne({ userId });

    if (!user) {
      user = await User.create({
        userId,
      });
    }

    const reward = random(250, 500);

    user.kittokens += reward;

    await user.save();

    await cooldowns.setCooldown(
      userId,
      commandName,
      cooldownDuration
    );

    const embed = new EmbedBuilder()
      .setColor('#EA6B55')
      .setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
  })
      .setImage('https://media.tenor.com/3SG3jecr5o4AAAAi/trip-fall.gif')
      .setDescription([
        '## <:lffcry:1496905526150299880> You’re here just in time!',
        '- Littleforestfellow fell and scattered all his buttons... Thank you for helping him pick everything up~',
        '',
        `୨୧ <:kittokens:1501647903486116081> *Kittokens* : **${reward}**`,
        '',
      ].join('\n'));

    await handleReminders(
      interaction,
      'pick-up',
      cooldownDuration
    );

    return interaction.editReply({
      embeds: [embed],
    });
  },
};