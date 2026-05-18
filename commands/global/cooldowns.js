const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cooldownManager = require('../../utils/cooldownManager');

const emojiMap = {
  Summon: '',
  Claim: '',
  Route: '',
  Daily: '',
  Enchant: '',
  Weekly: '',
  Bewitch: '',
  Fortune: '',
  Slots: '',
  Assemble: '',
};

const categories = {
  Cards: ['Summon', 'Claim', 'Enchant', 'Assemble'],
  Money: ['Route', 'Fortune', 'Bewitch'],
  Both: ['Slots', 'Daily', 'Weekly'],
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
      description += `\n## <:space:1455504212069842956>୨ **__${category}__** ୧\n`;

      for (const command of commands) {
        const emoji = emojiMap[command] ?? '•';
        const expires = cooldowns[command];

        if (expires && expires > now) {
          const unix = Math.floor(expires / 1000);
          description += `${emoji} You can use __**\`${command.toLowerCase()}\`**__ again <t:${unix}:R>! \n`;
        } else {
          description += `${emoji} <a:NH_pinkarrow:1479588610725384242> __**\`${command.toLowerCase()}\`**__ is ready! \n`;
        }
      }
    }

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setColor('#F2A2C0')
      .setDescription(
        [
          '### <:space:1455504212069842956> My Cooldowns',
          '',
          '',
          description,
        ].join('\n\n')
      );

    await interaction.editReply({ embeds: [embed] });
  },
};