const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');
const generateRarity = require('../../utils/generateRarity');
const generateVersion = require('../../utils/generateVersion');

const PAGE_SIZE = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Gift cards to another user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to gift cards to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('codes')
        .setDescription('Example: ABC001, ABC002:3, ABC003:10')
        .setRequired(true)
    ),

  async execute(interaction) {
    const senderId = interaction.user.id;
    const targetUser = interaction.options.getUser('user');
    const rawCardInput = interaction.options.getString('codes') || '';

    if (targetUser.bot) {
      return interaction.editReply({
        content: 'You cannot gift cards to bots.',
      });
    }

    if (targetUser.id === senderId) {
      return interaction.editReply({
        content: 'You cannot gift cards to yourself.',
      });
    }

    const cardEntries = rawCardInput
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
      .map(entry => {
        const [rawCode, rawQty] = entry.split(':');
        const quantity = Number(rawQty || 1);

        return {
          cardCode: rawCode.trim().toUpperCase(),
          quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
        };
      });

    if (!cardEntries.length) {
      return interaction.editReply({
        content: 'Please provide at least one card code.',
      });
    }

    const quantityMap = new Map();

    for (const entry of cardEntries) {
      quantityMap.set(
        entry.cardCode,
        (quantityMap.get(entry.cardCode) || 0) + entry.quantity
      );
    }

    const uniqueCardCodes = [...quantityMap.keys()];

    const cards = await Card.find({
      cardCode: { $in: uniqueCardCodes },
    })
      .select('cardCode name group era rarity version emoji')
      .lean();

    const validCodes = new Set(cards.map(card => card.cardCode));
    const invalidCodes = uniqueCardCodes.filter(code => !validCodes.has(code));

    if (!cards.length) {
      return interaction.editReply({
        content: `No valid cards found. Invalid: ${invalidCodes.join(', ')}`,
      });
    }

    const senderInventory = await CardInventory.find({
      userId: senderId,
      cardCode: { $in: cards.map(card => card.cardCode) },
    }).lean();

    const senderMap = new Map(
      senderInventory.map(item => [item.cardCode, item.quantity || 0])
    );

    const missingCards = cards.filter(card => {
      const ownedQty = senderMap.get(card.cardCode) || 0;
      const giftQty = quantityMap.get(card.cardCode) || 1;

      return ownedQty < giftQty;
    });

    if (missingCards.length) {
      return interaction.editReply({
        content: [
          'You do not have enough copies of:',
          missingCards
            .map(card => {
              const ownedQty = senderMap.get(card.cardCode) || 0;
              const giftQty = quantityMap.get(card.cardCode) || 1;
              return `\`${card.cardCode}\` owned: ${ownedQty}, needed: ${giftQty}`;
            })
            .join('\n'),
        ].join('\n'),
      });
    }
    const totalCardCopies = cards.reduce((sum, card) => {
      return sum + (quantityMap.get(card.cardCode) || 1);
    }, 0);

    let page = 0;

    const maxPage = Math.max(
      0,
      Math.ceil(cards.length / PAGE_SIZE) - 1
    );

    const buildRow = disabled => new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('gift_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || maxPage === 0),

      new ButtonBuilder()
        .setCustomId('gift_confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId('gift_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId('gift_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || maxPage === 0)
    );

    const buildEmbed = confirmed => {
      const slice = cards.slice(
        page * PAGE_SIZE,
        page * PAGE_SIZE + PAGE_SIZE
      );

      return new EmbedBuilder()
        .setColor('#baeef2')
        .setAuthor({
          name: targetUser.username,
          iconURL: targetUser.displayAvatarURL({ dynamic: true }),
        })
        .setDescription([
          `${targetUser} you have received <:cards:1502007264868040897> cards from ${interaction.user} ༄.°`,
          '',
          slice.length
            ? slice.map(card => {
                const rarityDisplay = generateRarity({ rarity: card.rarity });
                const versionDisplay = card.emoji || generateVersion({ version: card.version });
                const qty = quantityMap.get(card.cardCode) || 1;

                return `${versionDisplay} **${card.name || 'Unknown'}** ${card.group || 'Unknown'} __${card.era || 'Unknown'}__ ${rarityDisplay} | \`${card.cardCode}\` x${qty}`;
              }).join('\n')
            : 'None',
          '',
          invalidCodes.length
            ? `Invalid: ${invalidCodes.join(', ')}`
            : null,
          confirmed ? '' : null,
        ].filter(Boolean).join('\n'))
        .setFooter({
          text: `Page ${page + 1} / ${maxPage + 1} • Total Card Copies: ${totalCardCopies}`,
        });
    };
    const reply = await interaction.editReply({
      embeds: [buildEmbed(false)],
      components: [buildRow(false)],
    });

    const collector = reply.createMessageComponentCollector({
      time: 120000,
    });

    let confirmed = false;

    collector.on('collect', async i => {
      if (i.user.id !== senderId) {
        return i.reply({
          content: 'This command was not ran by you, you cannot use the buttons.',
          ephemeral: true,
        });
      }

      if (i.customId === 'gift_prev') {
        page = page <= 0 ? maxPage : page - 1;

        return i.update({
          embeds: [buildEmbed(false)],
          components: [buildRow(false)],
        });
      }

      if (i.customId === 'gift_next') {
        page = page >= maxPage ? 0 : page + 1;

        return i.update({
          embeds: [buildEmbed(false)],
          components: [buildRow(false)],
        });
      }

      if (i.customId === 'gift_cancel') {
        collector.stop('cancelled');

        return i.update({
          content: 'Gift has been cancelled.',
          embeds: [],
          components: [],
        });
      }

      if (i.customId === 'gift_confirm') {
        confirmed = true;

        for (const card of cards) {
          const quantity = quantityMap.get(card.cardCode) || 1;

          await CardInventory.updateOne(
            { userId: senderId, cardCode: card.cardCode },
            { $inc: { quantity: -quantity } }
          );

          await CardInventory.updateOne(
            { userId: targetUser.id, cardCode: card.cardCode },
            { $inc: { quantity } },
            { upsert: true }
          );
        }

        await CardInventory.deleteMany({
          userId: senderId,
          quantity: { $lte: 0 },
        });

        const messageLink = reply.url;

        const receiptCards = cards.slice(0, 5).map(card => {
  const rarityDisplay = generateRarity({ rarity: card.rarity });
  const versionDisplay = card.emoji || generateVersion({ version: card.version });
  const qty = quantityMap.get(card.cardCode) || 1;

  return `${versionDisplay} **${card.name || 'Unknown'}** ${card.group || 'Unknown'} __${card.era || 'Unknown'}__ ${rarityDisplay} | \`${card.cardCode}\` x${qty}`;
});

await targetUser.send({
  embeds: [
    new EmbedBuilder()
      .setColor('#baeef2')
      .setDescription([
        `${interaction.user} has gifted you cards ༄.°`,
        '',
        `> <:cards:1502007264868040897>: **${totalCardCopies}** copies`,
        '',
        receiptCards.length
          ? receiptCards.join('\n')
          : '',
        cards.length > 5
          ? ``
          : null,
        '',
        `[Jump to gift message](${messageLink})`,
      ].filter(Boolean).join('\n')),
  ],
}).catch(() => null);

        collector.stop('confirmed');

        return i.update({
          embeds: [buildEmbed(true)],
          components: [buildRow(true)],
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (confirmed || reason === 'cancelled') return;

      try {
        await interaction.editReply({
          components: [buildRow(true)],
        });
      } catch {}
    });
  },
};