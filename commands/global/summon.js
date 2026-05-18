const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');

const Canvas = require('canvas');

const randomCardFromRarity = require('../../utils/randomCardFromRarity');
const pickRarity = require('../../utils/rarityPicker');
const cooldowns = require('../../utils/cooldownManager');
const generateRarity = require('../../utils/generateRarity');
const handleReminders = require('../../utils/reminderHandler');

const CardInventory = require('../../models/CardInventory');
const SummonSession = require('../../models/SummonSession');
const User = require('../../models/User');

function fadeUnownedRegion(ctx, x, y, w, h) {
  const imgData = ctx.getImageData(x, y, w, h);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray =
      0.2126 * data[i] +
      0.7152 * data[i + 1] +
      0.0722 * data[i + 2];

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    data[i + 3] = data[i + 3] * 0.5;
  }

  ctx.putImageData(imgData, x, y);
}

function buttonLabelForCard(card) {
  const MAX = 80;
  let name = card.name || 'Unknown';

  if (name.length > MAX - 8) {
    name = name.slice(0, MAX - 9) + '…';
  }

  return `Claim ୨୧ ${name}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summon')
    .setDescription('Summon cards and choose one'),

  async execute(interaction) {
    console.time(`[summon] total ${interaction.user.id}`);

    const ownerId = interaction.user.id;

    const commandName = 'Summon';
    const cooldownMs = await cooldowns.getEffectiveCooldown(
      interaction,
      commandName
    );

    if (await cooldowns.isOnCooldown(ownerId, commandName)) {
      const nextTime = await cooldowns.getCooldownTimestamp(
        ownerId,
        commandName
      );

      console.timeEnd(`[summon] total ${interaction.user.id}`);

      return interaction.editReply({
        content: `*/summon* is currently on cooldown! You can use it again ${nextTime}`,
      });
    }

    await cooldowns.setCooldown(ownerId, commandName, cooldownMs);
    const summonUser = await User.findOne({ userId: ownerId })
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

    const pullResults = await Promise.all([
      pullOneCard(ownerId, summonUser, 10),
      pullOneCard(ownerId, summonUser, 10),
      pullOneCard(ownerId, summonUser, 10),
    ]);

    const pulls = pullResults.filter(Boolean);

    if (pulls.length < 3) {
      console.timeEnd(`[summon] total ${interaction.user.id}`);

      return interaction.editReply({
        content: 'Not enough eligible cards available to summon.',
      });
    }

    const owned = await CardInventory.find({
      userId: ownerId,
      cardCode: { $in: pulls.map(card => card.cardCode) },
    })
      .select('cardCode quantity')
      .lean();

    const ownedSet = new Set(owned.map(card => card.cardCode));

    const CARD_WIDTH = 380;
    const CARD_HEIGHT = 500;
    const GAP = 15;

    const canvas = Canvas.createCanvas(
  pulls.length * (CARD_WIDTH + GAP),
  CARD_HEIGHT
);
    const ctx = canvas.getContext('2d');

    const loadedImages = await Promise.all(
      pulls.map(card =>
        Canvas.loadImage(card.localImagePath).catch(() => null)
      )
    );

    for (let i = 0; i < pulls.length; i++) {
      const card = pulls[i];
      const img = loadedImages[i];
      const x = i * (CARD_WIDTH + GAP);

      if (!img) continue;

      ctx.drawImage(img, x, 0, CARD_WIDTH, CARD_HEIGHT);

      if (!ownedSet.has(card.cardCode)) {
        fadeUnownedRegion(ctx, x, 0, CARD_WIDTH, CARD_HEIGHT);
      }
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: 'summon.png',
    });

    const cardLines = pulls.map(card => {
      const rarityEmoji = generateRarity({ rarity: card.rarity });

      return [
        `💌 (${card.version}) **${card.name || 'Unknown'}** ${card.group || 'Unknown Group'} __${card.era || 'Unknown Era'}__ ${rarityEmoji} | \`${card.cardCode}\``,
      ].join(' ');
    });

    const embed = new EmbedBuilder()
      .setColor('#D8D8D8')
      .setAuthor({
    name: interaction.user.username,
    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
  })
      .setDescription([
        '## Summoning 3 Cards',
        '',
        ...cardLines,
      ].join('\n'))
      .setImage('attachment://summon.png');

    const row = new ActionRowBuilder().addComponents(
      pulls.map((card, index) =>
        new ButtonBuilder()
          .setCustomId(`summon:${index}`)
          .setLabel(buttonLabelForCard(card))
          .setStyle(ButtonStyle.Secondary)
      )
    );

    const reply = await interaction.editReply({
      embeds: [embed],
      files: [attachment],
      components: [row],
    });

    await handleReminders(interaction, 'summon', cooldownMs);

    await SummonSession.create({
      messageId: reply.id,
      channelId: interaction.channel.id,
      guildId: interaction.guildId,
      ownerId,
      cards: pulls.map(card => ({
        cardCode: card.cardCode,
        claimedBy: null,
      })),
      ownerHasClaimed: false,
      expiresAt: new Date(Date.now() + 180_000),
    });

    setTimeout(async () => {
      try {
        const channel = await interaction.client.channels.fetch(
          reply.channel.id
        );

        const message = await channel.messages.fetch(reply.id);

        if (!message.editable || !message.components.length) return;

        const disabledRow = new ActionRowBuilder().addComponents(
          message.components[0].components.map(button =>
            ButtonBuilder.from(button).setDisabled(true)
          )
        );

        await message.edit({ components: [disabledRow] });
      } catch {}
    }, 180_000);

    console.timeEnd(`[summon] total ${interaction.user.id}`);
  },
};