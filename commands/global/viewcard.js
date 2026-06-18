const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');
const generateRarity = require('../../utils/generateRarity');
const generateVersion = require('../../utils/generateVersion');

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRegex(value) {
  return new RegExp(escapeRegExp(value), 'i');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewcard')
    .setDescription('View card info')
    .addStringOption(option =>
      option
        .setName('codes')
        .setDescription('Card code(s), separated by commas')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('group')
        .setDescription('Search by group')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Search by idol/name')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('era')
        .setDescription('Search by era')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const value = focused.value || '';

    let query = {};
    let field = '';

    if (focused.name === 'codes') {
      query = { cardCode: toRegex(value) };
      field = 'cardCode';
    }

    if (focused.name === 'group') {
      query = {
        $or: [
          { group: toRegex(value) },
          { groupalias: toRegex(value) },
        ],
      };
      field = 'group';
    }

    if (focused.name === 'name') {
      query = {
        $or: [
          { name: toRegex(value) },
          { namealias: toRegex(value) },
        ],
      };
      field = 'name';
    }

    if (focused.name === 'era') {
      query = { era: toRegex(value) };
      field = 'era';
    }

    const cards = await Card.find(query)
      .select('cardCode group name era')
      .limit(25)
      .lean();

    const seen = new Set();

    const choices = cards
      .map(card => {
        if (focused.name === 'codes') {
          return {
            name: `${card.cardCode} — ${card.name} (${card.group})`,
            value: card.cardCode,
          };
        }
        const display = card[field];
        if (!display || seen.has(display.toLowerCase())) return null;

        seen.add(display.toLowerCase());

        return {
          name: display,
          value: display,
        };
      })
      .filter(Boolean)
      .slice(0, 25);

    return interaction.respond(choices);
  },

  async execute(interaction) {
    const rawCodes = interaction.options.getString('codes') || '';
    const groupInput = interaction.options.getString('group') || '';
    const nameInput = interaction.options.getString('name') || '';
    const eraInput = interaction.options.getString('era') || '';

    const codes = rawCodes
      .split(',')
      .map(code => code.trim().toUpperCase())
      .filter(Boolean);

    if (!codes.length && !groupInput && !nameInput && !eraInput) {
      return interaction.editReply({
        content: 'Please provide a card code, group, name, or era.',
      });
    }

    const query = {};

    if (codes.length) {
      query.cardCode = { $in: codes };
    }

    const andFilters = [];

    if (groupInput) {
      andFilters.push({
        $or: [
          { group: toRegex(groupInput) },
          { groupalias: toRegex(groupInput) },
        ],
      });
    }

    if (nameInput) {
      andFilters.push({
        $or: [
          { name: toRegex(nameInput) },
          { namealias: toRegex(nameInput) },
        ],
      });
    }

    if (eraInput) {
      andFilters.push({
        era: toRegex(eraInput),
      });
    }

    if (andFilters.length) {
      query.$and = andFilters;
    }

    const cards = await Card.find(query).lean();

    if (!cards.length) {
      return interaction.editReply('No cards found for those filters.');
    }

    const orderedCards = codes.length
      ? codes
          .map(code => cards.find(card => card.cardCode === code))
          .filter(Boolean)
      : cards.sort((a, b) => {
          const groupCompare = String(a.group || '').localeCompare(String(b.group || ''));
          if (groupCompare !== 0) return groupCompare;

          const nameCompare = String(a.name || '').localeCompare(String(b.name || ''));
          if (nameCompare !== 0) return nameCompare;

          return String(a.era || '').localeCompare(String(b.era || ''));
        });
        const inventoryCounts = await CardInventory.aggregate([
      {
        $match: {
          userId: interaction.user.id,
          cardCode: {
            $in: orderedCards.map(card => card.cardCode),
          },
        },
      },
      {
        $group: {
          _id: '$cardCode',
          total: { $sum: '$quantity' },
        },
      },
    ]);

    const totalCopiesMap = new Map(
      inventoryCounts.map(item => [item._id, item.total])
    );

    let page = 0;

    function buildPage(index) {
      const card = orderedCards[index];

      const rarityDisplay = generateRarity({
        rarity: card.rarity,
      });

      const designers = Array.isArray(card.designerIds) && card.designerIds.length
        ? card.designerIds.map(id => `<@${id}>`).join(', ')
        : 'Unknown';

      const embed = new EmbedBuilder()
        .setColor(0xE8D0A1)
        .setDescription(
          [
            '## ***Viewing...***',
            `﹒ <:samus:1501287426537029676> **${card.name}** ﹗ ${card.group} 彡`,
            `︵︵ __${card.era}__ ⟡﹐`,
            `✨ ﹒ ┈ ﹕${rarityDisplay} | ${card.emoji || generateVersion(card)} ﹒ ᶻᶻ ﹒`,
            `-# ¦ made by : ${designers}`,
          ].join('\n')
        )
        .setFooter({
          text: `Page ${index + 1} of ${orderedCards.length} • Copies Owned: ${totalCopiesMap.get(card.cardCode) || 0}`,
        });

      let attachment = null;

      if (card.localImagePath) {
        attachment = new AttachmentBuilder(card.localImagePath, {
          name: `${card.cardCode}.png`,
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
        files: attachment ? [attachment] : [],
      };
    }

    await interaction.editReply(await render());

    if (orderedCards.length <= 1) return;

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on('collect', async button => {

      if (button.user.id !== interaction.user.id) {

        return button.reply({

          content: 'Only the command user can use these buttons.',

          ephemeral: true,

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

          files: attachment ? [attachment] : [],

        });

      } catch {}
    });
  },
};