const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cooldownManager = require('../../utils/cooldownManager');

const emojiMap = {
  Summon: '',
  Call: '',
};

const categories = {
  Cards: ['Summon', 'Call'],
};

module.exports = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('cooldowns')
    .setDescription('View your current and available cooldowns'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const now = Date.now();

    const cooldowns = await cooldownManager.getCooldowns(userId);

    let description = '';

    for (const [category, commands] of Object.entries(categories)) {
      description += `\n## ୨ **__${category}__** ୧\n`;

      for (const command of commands) {
        const emoji = emojiMap[command] ?? '•';
        const expires = cooldowns[command];

        if (expires && expires > now) {
          const unix = Math.floor(expires / 1000);
          description += `${emoji} You can use __**\`${command.toLowerCase()}\`**__ again <t:${unix}:R>! <a:pistawp:1505960343011201034> \n`;
        } else {
          description += `${emoji} <a:NH_pinkarrow:1505784904426848276> __**\`${command.toLowerCase()}\`**__ is ready! \n`;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setColor('#F2A2C0')
      .setDescription(
        [
          '### ໒꒰ྀིᵔ ᵕ ᵔ ꒱ྀི১ My Cooldowns',
          '',
          '',
          description,
        ].join('\n\n')
      );

    await interaction.editReply({ embeds: [embed] });
  },
};