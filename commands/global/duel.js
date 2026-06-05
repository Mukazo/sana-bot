const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const cooldowns = require('../../utils/cooldownManager');
const handleReminders = require('../../utils/reminderHandler');
const User = require('../../models/User');

const OPTIONS = [
  {
    id: 'soccer',
    label: 'Soccer',
    description: 'Kick the ball around',
    emoji: '⚽',
  },
  {
    id: 'basketball',
    label: 'Basketball',
    description: 'Shoot some hoops',
    emoji: '🏀',
  },
  {
    id: 'skateboarding',
    label: 'Skateboarding',
    description: 'Hit some gnarly tricks',
    emoji: '🛹',
  },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Duel it out with Pochacco on various activities!'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const commandName = 'Duel';

    const cooldownMs = await cooldowns.getEffectiveCooldown(
      interaction,
      commandName
    );

    if (await cooldowns.isOnCooldown(userId, commandName)) {
      const nextTime = await cooldowns.getCooldownTimestamp(
        userId,
        commandName
      );

      return interaction.editReply({
        content: `*/duel* is currently on cooldown! You can use it again ${nextTime}`,
      });
    }

    await cooldowns.setCooldown(userId, commandName, cooldownMs);
    const embed = new EmbedBuilder()
      .setColor('#ba4244')
      .setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
  })
      .setDescription([
        '## Pochacco playtime! ٩(^ᗜ^ )و ´-',
        '- He’s been waiting for u! <a:wh_pochaccoplay:1507461099719753828> In which sport do you choose to challenge him this time?',
      ].join('\n'));

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`duel:${userId}`)
      .setPlaceholder('Choose your activity')
      .addOptions(
        OPTIONS.map(option => ({
          label: option.label,
          value: option.id,
          description: option.description,
          emoji: option.emoji,
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      time: 60_000,
      filter: i => i.user.id === userId,
    });

    collector.on('collect', async select => {
      await select.deferUpdate();

      const selected = OPTIONS.find(option => option.id === select.values[0]);
      if (!selected) return;

      const won = Math.random() < 0.5;
      const reward = won ? randomInt(1, 5) : 0;

      let user = await User.findOne({ userId });

      if (!user) {
        user = await User.create({ userId });
      }

      if (won) {
        user.pawprints += reward;
        await user.save();
      }

      row.components[0].setDisabled(true);

      const resultEmbed = new EmbedBuilder()
        .setColor(won ? '#5DEF77' : '#E74531')
        .setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
  })
        .setDescription(
          won
            ? [
                `## You won! (˶˃ ᵕ ˂˶)`,
                '',
                `Amazing skills! You have successfully defeated Pochacco.ೃ࿔\n⌯⌲ Here are your rewards : <:pawprints:1501648560700002506> **${reward.toLocaleString()}**`,
                '',
              ].join('\n')
            : [
                `## You lost! (•́ ᴖ •̀)`,
                '',
                `Maybe next round! But Pochacco got the better of you this time...`,
                '',
              ].join('\n')
        );

      await handleReminders(interaction, 'duel', cooldownMs);

      await interaction.editReply({
        embeds: [resultEmbed],
        components: [row],
      });

      collector.stop('user');
    });

    collector.on('end', async (_, reason) => {
      if (reason !== 'user') {
        row.components[0].setDisabled(true);

        await interaction.editReply({
          components: [row],
        }).catch(() => {});
      }
    });
  },
};