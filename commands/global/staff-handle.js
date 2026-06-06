const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const User = require('../../models/User');
const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');
const generateRarity = require('../../utils/generateRarity');
const generateVersion = require('../../utils/generateVersion');

const PAGE_SIZE = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-handle')
    .setDescription('Handle rewarding users with currency and cards')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to give rewards to')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('kittokens')
        .setDescription('Amount of kittokens')
        .setMinValue(0)
    )
    .addIntegerOption(option =>
      option.setName('pawprints')
        .setDescription('Amount of pawprints')
        .setMinValue(0)
    )
    .addStringOption(option =>
      option.setName('cardcodes')
        .setDescription('Example: ABC001, ABC002:3, ABC003:10')
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const kittokens = interaction.options.getInteger('kittokens') || 0;
    const pawprints = interaction.options.getInteger('pawprints') || 0;
    const rawCardInput = interaction.options.getString('cardcodes') || '';

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

    if (!kittokens && !pawprints && !cardEntries.length) {
      return interaction.editReply({
        content: 'You must provide at least one reward.',
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

    const cards = uniqueCardCodes.length
      ? await Card.find({
          cardCode: { $in: uniqueCardCodes },
        })
          .select('cardCode name group era rarity version emoji')
          .lean()
      : [];

    const validCodes = new Set(cards.map(card => card.cardCode));

    const invalidCodes = uniqueCardCodes.filter(code => !validCodes.has(code));

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
        .setCustomId('staff-handle_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || maxPage === 0),

      new ButtonBuilder()
        .setCustomId('staff-handle_confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId('staff-handle_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId('staff-handle_next')
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
          `## Cinnamoroll has dropped off some gifts!! <:NH_cinnamoroll:1512807779730063480>`,
          `-# ${targetUser}`,
          `<:kittokens:1501647903486116081> Kittokens : **${kittokens.toLocaleString()}** ♡ <:pawprints:1501648560700002506> Pawprints : **${pawprints.toLocaleString()}**`,
          '',
          '<:cards:1502007264868040897>',
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
          confirmed
            ? '\n'
            : null,
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
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: 'This command was not ran by you, you cannot use the buttons.',
          ephemeral: true,
        });
      }

      if (i.customId === 'staff-handle_prev') {
        page = page <= 0 ? maxPage : page - 1;

        return i.update({
          embeds: [buildEmbed(false)],
          components: [buildRow(false)],
        });
      }

      if (i.customId === 'staff-handle_next') {
        page = page >= maxPage ? 0 : page + 1;

        return i.update({
          embeds: [buildEmbed(false)],
          components: [buildRow(false)],
        });
      }

      if (i.customId === 'staff-handle_cancel') {
        collector.stop('cancelled');

        return i.update({
          content: 'Staff gifting has been cancelled.',
          embeds: [],
          components: [],
        });
      }

      if (i.customId === 'staff-handle_confirm') {
        confirmed = true;

        let target = await User.findOne({
          userId: targetUser.id,
        });

        if (!target) {
          target = await User.create({
            userId: targetUser.id,
          });
        }

        target.kittokens += kittokens;
        target.pawprints += pawprints;

        await target.save();

        for (const card of cards) {
          const quantity = quantityMap.get(card.cardCode) || 1;

          await CardInventory.updateOne(
            {
              userId: targetUser.id,
              cardCode: card.cardCode,
            },
            {
              $inc: { quantity },
            },
            {
              upsert: true,
            }
          );
        }

        try {
          await targetUser.send({
            embeds: [
              new EmbedBuilder()
                .setColor('#baeef2')
                .setDescription([
                  `You received staff rewards from ${interaction.user}.`,
                  '',
                  `> Kittokens: **${kittokens.toLocaleString()}**`,
                  `> Pawprints: **${pawprints.toLocaleString()}**`,
                  `> Card Copies: **${totalCardCopies}**`,
                ].join('\n')),
            ],
          });
        } catch {}

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