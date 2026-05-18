const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

const VALID_COMMANDS = [
  'summon',
  'bewitch',
  'fortune',
  'route',
  'slots',
  'daily',
  'weekly',
  'assemble',
];

// ✨ Pretty display names (SAFE to decorate)
const COMMAND_DISPLAY = {
  summon: '─ Summon',
  bewitch: '─ Bewitch',
  fortune: '─ Fortune',
  route: '─ Route',
  slots: '─ Slots',
  daily: '─ Daily',
  weekly: '─ Weekly',
  assemble: '─ Assemble',
};

// 💖 Cute mode formatter
function formatMode(mode) {
  if (mode === 'dm') return '<:dm:1503647696123330602>';
  if (mode === 'channel') return '<:__:1503647732118585448>';
  return '<:x_:1503647662157725786>';
}

module.exports = {
  ephemeral: true,
  data: new SlashCommandBuilder()
    .setName('reminders')
    .setDescription('View or update your cooldown reminder settings')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Select a command to update')
        .setRequired(false)
        .addChoices(
          ...VALID_COMMANDS.map(cmd => ({
            name: COMMAND_DISPLAY[cmd],
            value: cmd
          }))
        )
    )
    .addStringOption(option =>
      option.setName('remind')
        .setDescription('Where should the reminder be sent?')
        .setRequired(false)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'DM', value: 'dm' },
          { name: 'Channel', value: 'channel' }
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const command = interaction.options.getString('command');
    const mode = interaction.options.getString('remind');

    const user = await User.findOne({ userId });
    if (!user) {
      return interaction.editReply({ content: 'User not found.' });
    }

    // Ensure Map exists
    if (!user.reminderPreferences) {
      user.reminderPreferences = new Map();
    }

    // 🔔 Update setting if both options provided
    if (command && mode) {
      user.reminderPreferences.set(command, mode);
      await user.save();
    }

    // 🌸 Build display
    const settingsDisplay = VALID_COMMANDS.map(cmd => {
      const current = user.reminderPreferences.get(cmd) || 'off';
      return `> ${formatMode(current)} \`${COMMAND_DISPLAY[cmd]}\`\n`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription([
        '## Choose your reminders! ⊹ ࣪ ˖',
        '',
        settingsDisplay,
        ''
      ].join('\n'));

    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });
  }
};