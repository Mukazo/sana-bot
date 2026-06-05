const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

const Card = require('../../models/Card');
const generateRarity = require('../../utils/generateRarity');
const generateVersion = require('../../utils/generateVersion');
const CardInventory = require('../../models/CardInventory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewcard')
    .setDescription('View card info')
    .addStringOption(option =>
      option
        .setName('codes')
        .setDescription('Card code(s), separated by commas')
        .setRequired(true)
    ),

  async execute(interaction) {
    const rawCodes = interaction.options.getString('codes');

    const codes = rawCodes
      .split(',')
      .map(code => code.trim().toUpperCase())
      .filter(Boolean);

    if (!codes.length) {
      return interaction.editReply('Please provide at least one card code.');
    }

    const cards = await Card.find({
      cardCode: { $in: codes }
    }).lean();

    if (!cards.length) {
      return interaction.editReply('No cards found for those codes.');
    }

    const cardMap = new Map(cards.map(card => [card.cardCode, card]));

    const orderedCards = codes
      .map(code => cardMap.get(code))
      .filter(Boolean);

      const inventoryCounts = await CardInventory.aggregate([
  {
    $match: {
      userId: interaction.user.id,
      cardCode: { $in: orderedCards.map(card => card.cardCode) }
    }
  },
  {
    $group: {
      _id: '$cardCode',
      total: { $sum: '$quantity' }
    }
  }
]);

const totalCopiesMap = new Map(
  inventoryCounts.map(item => [item._id, item.total])
);

    let page = 0;

    function buildPage(index) {
      const card = orderedCards[index];

      const versionDisplay = generateVersion({
        version: card.version,
      });

      const designers = Array.isArray(card.designerIds) && card.designerIds.length
        ? card.designerIds.map(id => `<@${id}>`).join(', ')
        : 'Unknown';

      const embed = new EmbedBuilder()
        .setColor(0xE8D0A1)
        .setDescription(`## ***Viewing...***\n﹒ \<:samus:1501287426537029676> **${card.name}** ﹗ ${card.group} 彡\n︵︵ __${card.era}__ ⟡﹐\n✨ ﹒ ┈ ﹕${card.emoji || generateRarity(card)} | ${versionDisplay} ﹒ ᶻᶻ ﹒\n-# ¦ made by : ${designers}`)
        .setFooter({
  text: `Page ${index + 1} of ${orderedCards.length} • Copies Owned: ${totalCopiesMap.get(card.cardCode) || 0}`,
});

      let attachment = null;
      if (card.localImagePath) {
        attachment = new AttachmentBuilder(card.localImagePath, {
          name: `${card.cardCode}.png`
        });

        embed.setImage(`attachment://${card.cardCode}.png`);
      }

      return { embed, attachment };
    }

    function buildButtons() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('viewcard_first')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji({ id: '1501300765065740398', name: 'doubleleft' })
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId('viewcard_prev')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji({ id: '1501300648908423219', name: 'left' })
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId('viewcard_next')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji({ id: '1501300585293414490', name: 'right' })
          .setDisabled(page === orderedCards.length - 1),

        new ButtonBuilder()
          .setCustomId('viewcard_last')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji({ id: '1501300703120068678', name: 'doubleright' })
          .setDisabled(page === orderedCards.length - 1)
      );
    }

    async function render() {
      const { embed, attachment } = buildPage(page);

      return {
        embeds: [embed],
        components: orderedCards.length > 1 ? [buildButtons()] : [],
        files: attachment ? [attachment] : []
      };
    }

    await interaction.editReply(await render());

    if (orderedCards.length <= 1) return;

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000
    });

    collector.on('collect', async button => {
      if (button.user.id !== interaction.user.id) {
        return button.reply({
          content: 'Only the command user can use these buttons.',
          ephemeral: true
        });
      }

      if (button.customId === 'viewcard_first') page = 0;
      if (button.customId === 'viewcard_prev') page = Math.max(0, page - 1);
      if (button.customId === 'viewcard_next') page = Math.min(orderedCards.length - 1, page + 1);
      if (button.customId === 'viewcard_last') page = orderedCards.length - 1;

      await button.update(await render());
    });

    collector.on('end', async () => {
      try {
        const { embed, attachment } = buildPage(page);

        await interaction.editReply({
          embeds: [embed],
          components: [],
          files: attachment ? [attachment] : []
        });
      } catch {}
    });
  }
};