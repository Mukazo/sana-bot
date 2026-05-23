const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const cooldowns = require('../../utils/cooldownManager');
const cooldownConfig = require('../../utils/cooldownConfig');
const handleReminders = require('../../utils/reminderHandler');
const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Embark on a daily adventure to receive rewards'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const commandName = 'Daily';
    const cooldownDuration = cooldownConfig[commandName];

    if (await cooldowns.isOnCooldown(userId, commandName)) {
      const nextTime = await cooldowns.getCooldownTimestamp(userId, commandName);

      return interaction.editReply({
        content: `*/daily* is currently on cooldown! You can use it again ${nextTime}`,
      });
    }

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    let user = await User.findOne({ userId });

    if (!user) {
      user = await User.create({
        userId,
        dailystreak: {
          count: 0,
          lastClaim: null,
        },
      });
    }

    const lastClaim = user.dailystreak?.lastClaim
      ? new Date(user.dailystreak.lastClaim)
      : null;

    let streak = user.dailystreak?.count || 0;

    if (lastClaim) {
      const diff = now - lastClaim;

      if (diff < oneDay) {
        return interaction.editReply({
          content: 'Try again another time, you already earned daily rewards today!',
        });
      }

      if (diff < oneDay * 2) {
        streak++;
      } else {
        streak = 1;
      }
    } else {
      streak = 1;
    }

    function calculateDailyReward(currentStreak) {
      const kittokens = 2500 + Math.min(2500, Math.floor(currentStreak / 7) * 125);
      const pawprints = 2;

      return { kittokens, pawprints };
    }

    const reward = calculateDailyReward(streak);

    user.kittokens += reward.kittokens;
    user.pawprints += reward.pawprints;
    user.dailystreak = {
      count: streak,
      lastClaim: now,
    };

    await user.save();
    await cooldowns.setCooldown(userId, commandName, cooldownDuration);

    const embed = new EmbedBuilder()
      .setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
  })
      .setColor('#EA9ABA')
      .setDescription([
        '## ໒꒰ྀིᵔ ᵕ ᵔ ꒱ྀི১ Daily',
        '- **My Melody** <:melodysmile:1502029168492286134> has been waiting for ur return! Get ready for new quests and most importantly friends! .ೀ',
        `> <:kittokens:1501647903486116081> Kittokens : **${reward.kittokens.toLocaleString()}** ♡ <:pawprints:1501648560700002506> Pawprints : **${reward.pawprints}**`,
        `~ Streak increased to ${streak} days! <:pinkfire:1502212161596948512>`,
        '',
      ].join('\n'));

    await handleReminders(interaction, 'daily', cooldownDuration);

    return interaction.editReply({
      embeds: [embed],
    });
  },
};