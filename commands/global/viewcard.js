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

    let page = 0;

    function buildPage(index) {
      const card = orderedCards[index];

      const rarityDisplay = generateRarity({
        rarity: card.rarity,
        overrideEmoji: card.emoji ?? undefined
      });

      const designers = Array.isArray(card.designerIds) && card.designerIds.length
        ? card.designerIds.map(id => `<@${id}>`).join(', ')
        : 'Unknown';

      const embed = new EmbedBuilder()
        .setTitle(`${rarityDisplay}`)
        .setColor(0x5865F2)
        .setDescription(`***Viewing...***\n
﹒ \<:samus:1501287426537029676> ${card.name} ﹗ ${card.group} 彡\n
︵︵ ${card.era} ⟡﹐\n
✨ ﹒ ┈ ﹕${rarityDisplay} | \`${card.cardCode}\` ﹒ ᶻᶻ ﹒`)
        .setFooter({
          text: `Page ${index + 1} of ${orderedCards.length}`
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
          .setLabel('First')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId('viewcard_prev')
          .setLabel('Prev')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),

        new ButtonBuilder()
          .setCustomId('viewcard_next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === orderedCards.length - 1),

        new ButtonBuilder()
          .setCustomId('viewcard_last')
          .setLabel('Last')
          .setStyle(ButtonStyle.Secondary)
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