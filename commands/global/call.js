const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require('discord.js');

const randomCardFromRarity = require('../../utils/randomCardFromRarity');
const pickRarity = require('../../utils/rarityPicker');
const cooldowns = require('../../utils/cooldownManager');
const generateRarity = require('../../utils/generateRarity');
const handleReminders = require('../../utils/reminderHandler');

const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('call')
    .setDescription('Call one random card'),

  async execute(interaction) {
    console.time(`[call] total ${interaction.user.id}`);

    const ownerId = interaction.user.id;

    const commandName = 'Call';
    const cooldownMs = await cooldowns.getEffectiveCooldown(
      interaction,
      commandName
    );

    if (await cooldowns.isOnCooldown(ownerId, commandName)) {
      const nextTime = await cooldowns.getCooldownTimestamp(
        ownerId,
        commandName
      );

      console.timeEnd(`[call] total ${interaction.user.id}`);

      return interaction.editReply({
        content: `*/call* is currently on cooldown! You can use it again ${nextTime}`,
      });
    }

    await cooldowns.setCooldown(ownerId, commandName, cooldownMs);

    const callUser = await User.findOne({ userId: ownerId })
      .select('enabledCategories blockedPulls')
      .lean();

    async function pullOneCard(userId, loadedUser, maxAttempts = 10) {
      for (let i = 0; i < maxAttempts; i++) {
        const rarity = pickRarity();

        const card = await randomCardFromRarity(
          rarity,
          userId,
          loadedUser
        );

        if (card) return card;
      }

      return null;
    }

    const card = await pullOneCard(ownerId, callUser, 10);

    if (!card) {
      console.timeEnd(`[call] total ${interaction.user.id}`);

      return interaction.editReply({
        content: 'No eligible card was available to call.',
      });
    }

    const rarityEmoji = generateRarity({ rarity: card.rarity });
    const versionEmoji = card.version || 'Unknown';

    const embed = new EmbedBuilder()
      .setColor('#ffb6e5')
      .setDescription([
        `**Idol** : **${card.name || 'Unknown'}** ⋆:･.`,
        `⋆.ೃ࿔ **Group** :  __${card.group || 'Unknown Group'}__`,
        `**Era** : ${card.era || 'Unknown Era'} ⋆:･.`,
        `⋆.ೃ࿔ ${rarityEmoji} : ${versionEmoji}`,
        `🌸 \`${card.cardCode}\``,
      ].join('\n'));

    const files = [];

    if (card.localImagePath) {
      const attachment = new AttachmentBuilder(card.localImagePath, {
        name: `${card.cardCode}.png`,
      });

      embed.setImage(`attachment://${card.cardCode}.png`);
      files.push(attachment);
    }

    await interaction.editReply({
      embeds: [embed],
      files,
    });

    await handleReminders(interaction, 'call', cooldownMs);

    console.timeEnd(`[call] total ${interaction.user.id}`);
  },
};