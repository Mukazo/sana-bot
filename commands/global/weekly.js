const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const cooldowns = require('../../utils/cooldownManager');
const cooldownConfig = require('../../utils/cooldownConfig');
const handleReminders = require('../../utils/reminderHandler');

const User = require('../../models/User');
const CardInventory = require('../../models/CardInventory');

const randomCardFromRarity = require('../../utils/randomCardFromRarity');
const pickRarity = require('../../utils/rarityPicker');
const generateRarity = require('../../utils/generateRarity');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('Claim your weekly rewards'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const commandName = 'Weekly';
    const cooldownDuration = cooldownConfig[commandName];

    if (await cooldowns.isOnCooldown(userId, commandName)) {
      const nextTime = await cooldowns.getCooldownTimestamp(userId, commandName);

      return interaction.editReply({
        content: `*/weekly* is currently on cooldown! You can use it again ${nextTime}`,
      });
    }

    const now = new Date();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const twoWeeks = 10 * 24 * 60 * 60 * 1000;

    let user = await User.findOne({ userId });

    if (!user) {
      user = await User.create({
        userId,
        weeklystreak: {
          count: 0,
          lastClaim: null,
        },
      });
    }

    const lastClaim = user.weeklystreak?.lastClaim
      ? new Date(user.weeklystreak.lastClaim)
      : null;

    let streak = user.weeklystreak?.count || 0;

    if (lastClaim) {
      const diff = now - lastClaim;

      if (diff < oneWeek) {
        return interaction.editReply({
          content: 'Try again another time, you already earned weekly rewards!',
        });
      }

      streak = diff < twoWeeks ? streak + 1 : 1;
    } else {
      streak = 1;
    }

    function calculateWeeklyReward(currentStreak) {
      const kittokens = 5000 + Math.min(5000, Math.floor(currentStreak / 4) * 250);
      const pawprints = 10;

      return { kittokens, pawprints };
    }

    async function pullOneCard(rarityOverride = null, maxAttempts = 15) {
      const loadedUser = await User.findOne({ userId })
        .select('blockedPulls')
        .lean();

      for (let i = 0; i < maxAttempts; i++) {
        const rarity = rarityOverride || pickRarity();
        const card = await randomCardFromRarity(rarity, userId, loadedUser);

        if (card) return card;
      }

      return null;
    }

    async function pullGuaranteedSpecialOrMythic() {
      const rarities = Math.random() < 0.5
        ? ['Special', 'Mythic']
        : ['Mythic', 'Special'];

      for (const rarity of rarities) {
        const card = await pullOneCard(rarity, 15);
        if (card) return card;
      }

      return null;
    }
    const guaranteedCard = await pullGuaranteedSpecialOrMythic();

    const otherCards = [];

    for (let i = 0; i < 4; i++) {
      const card = await pullOneCard(null, 15);
      if (card) otherCards.push(card);
    }

    const pulledCards = [guaranteedCard, ...otherCards].filter(Boolean);

    if (pulledCards.length < 5) {
      return interaction.editReply({
        content: 'Not enough eligible cards available for your weekly reward.',
      });
    }

    const reward = calculateWeeklyReward(streak);

    user.kittokens += reward.kittokens;
    user.pawprints += reward.pawprints;
    user.weeklystreak = {
      count: streak,
      lastClaim: now,
    };

    await user.save();

    for (const card of pulledCards) {
      await CardInventory.updateOne(
        { userId, cardCode: card.cardCode },
        { $inc: { quantity: 1 } },
        { upsert: true }
      );
    }

    await cooldowns.setCooldown(userId, commandName, cooldownDuration);

    const cardLines = pulledCards.map((card, index) => {
      const rarityEmoji = generateRarity({ rarity: card.rarity });
      const guaranteed = index === 0 ? '' : '';

      return `(${card.version}) **${card.name || 'Unknown'}** ${card.group || 'Unknown Group'} __${card.era || 'Unknown Era'}__ ${rarityEmoji} | \`${card.cardCode}\``;
    });

    const embed = new EmbedBuilder()
      .setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
  })
      .setColor('#565656')
      .setDescription([
        '## ໒꒰ྀིᵔ ᵕ ᵔ ꒱ྀི১ Weekly',
        '- **Kuromi** <:NH_kuromi:1466870426415272111> is up to something again... You decided to join her which resulted in unforgettable memories and new collection items!!',
        `> :kittokens: Kittokens : **${reward.kittokens.toLocaleString()}** ♡ :pawprints: Pawprints : **${reward.pawprints}**`,
        `~ Streak increased to ${streak} weeks! <:pinkfire:1502212161596948512>`,
        '',
        ...cardLines,
      ].join('\n'));

    await handleReminders(interaction, 'weekly', cooldownDuration);

    return interaction.editReply({
      embeds: [embed],
    });
  },
};