const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');

const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');
const generateVersion = require('../../utils/generateVersion');
const generateRarity = require('../../utils/generateRarity');

const PAGE_SIZE = 6;

const THEY_HAVE_EMOJI = '🌺';
const YOU_HAVE_EMOJI = '🧚';

function normalize(value) {
  if (typeof value !== 'string') return '';
  return value.toLowerCase();
}

function parseList(str) {
  if (typeof str !== 'string') return [];
  return str
    .split(',')
    .map(v => normalize(v.trim()))
    .filter(Boolean);
}



function parseNumberList(str) {
  if (typeof str !== 'string') return [];
  return str
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => Number(v))
    .filter(n => Number.isFinite(n));
}

function parseMulti(input) {
  if (typeof input !== 'string') return [];

  const trimmed = input.trim();

  const match = trimmed.match(/^\((.+)\)$/);

  if (match) {
    return match[1]
      .split(',')
      .map(v => normalize(v.trim()))
      .filter(Boolean);
  }

  return [normalize(trimmed)];
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const toRegexList = (arr) => arr.map(v => new RegExp(`^${escapeRegExp(v)}$`, 'i'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View yours or another players card inventory!')
    .addStringOption(o =>
      o.setName('view')
        .setDescription('options')
        .setRequired(true)
        .addChoices(
          { name: 'Owned', value: 'owned' },
          { name: 'Duplicates', value: 'duplicates' },
          { name: 'Missing', value: 'missing' },
        )
    )
    .addUserOption(o =>
      o.setName('user')
        .setDescription('View another user’s inventory')
    )
    .addStringOption(o => o.setName('group').setDescription('Filter by group'))
    .addStringOption(o => o.setName('name').setDescription('Filter by name'))
    .addStringOption(o => o.setName('era').setDescription('Filter by era'))
    .addStringOption(o => o.setName('category').setDescription('Filter by category'))
    .addStringOption(o => o.setName('rarity').setDescription('Filter by rarity'))
    .addStringOption(o => o.setName('version').setDescription('Filter by version')),

  async execute(interaction) {
    const viewerId = interaction.user.id;
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const targetId = targetUser.id;
    const view = interaction.options.getString('view');

    const parseList = (s) => (s || '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    const groups = parseList(interaction.options.getString('group'));
const eras = parseList(interaction.options.getString('era'));
const categories = parseList(interaction.options.getString('category'));
const versions = parseNumberList(interaction.options.getString('version'));
const names = parseList(interaction.options.getString('name'));
const rarities = parseList(interaction.options.getString('rarity'));

    const [viewerInv, targetInv] = await Promise.all([
      CardInventory.find({ userId: viewerId })
        .select('cardCode quantity')
        .lean(),
      CardInventory.find({ userId: targetId })
        .select('cardCode quantity')
        .lean(),
    ]);

    const viewerMap = new Map(viewerInv.map(i => [i.cardCode, i.quantity]));
    const targetMap = new Map(targetInv.map(i => [i.cardCode, i.quantity]));

    const cardQuery = {
      batch: null,
    };

    if (groups.length) {
  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    $or: groups.flatMap(g => ([
      { group: { $in: toRegexList(groups)} },
      { groupalias: { $in: toRegexList(groups)} },
    ]))
  });
}

if (rarities.length) {
  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    rarity: { $in: toRegexList(rarities) },
  });
}

    if (eras.length) {
  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    $or: eras.map(e => ({
      era: { $in: toRegexList(eras)}
    }))
  });
}

    if (versions.length) {
      cardQuery.version = { $in: versions };
    }

    if (names.length) {
  cardQuery.$and = cardQuery.$and || [];

  cardQuery.$and.push({
    $or: names.flatMap(n => ([
      { name: { $in: toRegexList(names)} },
      { namealias: { $in: toRegexList(names)} },
    ]))
  });
}

    let cards = [];

    if (view === 'owned' || view === 'duplicates') {
      const allowedCodes = targetInv
        .filter(i => (view === 'owned' ? i.quantity > 0 : i.quantity > 1))
        .map(i => i.cardCode);

      cards = allowedCodes.length
        ? await Card.find({
            ...cardQuery,
            cardCode: { $in: allowedCodes },
          })
            .select('cardCode group groupalias name namealias era version rarity emoji')
            .lean()
        : [];
    } else {
      cards = await Card.find(cardQuery)
        .select('cardCode group groupalias name namealias era version rarity emoji')
        .lean();
    }

    let results = cards.filter(card => {
  const targetQty = targetMap.get(card.cardCode) || 0;
  const isCustom = String(card.era || '').toUpperCase() === 'CUSTOM';

  // CUSTOM cards only show if the target owns them
  if (isCustom && targetQty <= 0) return false;

  if (view === 'owned' && targetQty <= 0) return false;
  if (view === 'missing' && targetQty > 0) return false;
  if (view === 'duplicates' && targetQty <= 1) return false;

  return true;
});

    const defaultSort = () => {
      results.sort((a, b) => {
        const versionA = Number(a.version);
        const versionB = Number(b.version);

        if (Number.isFinite(versionB) && Number.isFinite(versionA) && versionB !== versionA) {
          return versionB - versionA;
        }

        if (Number.isFinite(versionB) && !Number.isFinite(versionA)) return -1;
        if (!Number.isFinite(versionB) && Number.isFinite(versionA)) return 1;

        const gDiff = (a.group || '').localeCompare(b.group || '');
        if (gDiff !== 0) return gDiff;

        return (a.name || '').localeCompare(b.name || '');
      });
    };

    defaultSort();

    if (!results.length) {
      return interaction.editReply('No cards matched your filters.');
    }

    let page = 0;
    let sortMode = 'default';

    const getEmbed = () => {
  const slice = results.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor('#E8A6E1')
    .setAuthor({
    name: targetUser.username,
    iconURL: targetUser.displayAvatarURL({ dynamic: true }),
  })
    .setFooter({
      text: `Page ${page + 1} / ${Math.max(1, Math.ceil(results.length / PAGE_SIZE))}`,
    });

  const fields = slice.map(card => {
    const viewerQty = viewerMap.get(card.cardCode) || 0;
    const targetQty = targetMap.get(card.cardCode) || 0;

    let compareEmoji = '';
    if (viewerId !== targetId) {
      if (targetQty > 0 && viewerQty === 0) compareEmoji = THEY_HAVE_EMOJI;
      else if (viewerQty > 0 && targetQty === 0) compareEmoji = YOU_HAVE_EMOJI;
    }

    const rarityEmoji = generateRarity({ rarity: card.rarity });
        const versionEmoji = generateVersion({ version: card.version });

    return {
      name: ``,
      value: [
        `${rarityEmoji} **${card.name || 'Unknown'}** | ${card.group || 'Unknown'}`,
        card.era ? `__${card.era}__` : null `**${versionEmoji}**`,
        `\`${card.cardCode}\` x__**${targetQty}**__ ${compareEmoji}`,
        '⋆˙⟡ —————— ⋆˙⟡',
      ].filter(Boolean).join('\n'),
      inline: true,
    };
  });

  embed.addFields(fields.length ? fields : [
    {
      name: 'No cards',
      value: 'No cards matched this page.',
      inline: false,
    },
  ]);

  return embed;
};

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel(' • Previous').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('copy').setLabel('Copy • Codes').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sort_copies').setLabel('Sort • Copies').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('Next • ').setStyle(ButtonStyle.Secondary),
    );

    const message = await interaction.editReply({
      embeds: [getEmbed()],
      components: [row],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300_000,
    });

    collector.on('collect', async btn => {
      await btn.deferUpdate();

      if (btn.customId === 'prev') {
        page = Math.max(0, page - 1);
      }

      if (btn.customId === 'next') {
        page = Math.min(Math.ceil(results.length / PAGE_SIZE) - 1, page + 1);
      }

      if (btn.customId === 'sort_copies') {
        sortMode = sortMode === 'copies' ? 'default' : 'copies';

        if (sortMode === 'copies') {
          results.sort((a, b) => {
            const qa = targetMap.get(a.cardCode) || 0;
            const qb = targetMap.get(b.cardCode) || 0;

            if (qb !== qa) return qb - qa;

            const versionA = Number(a.version);
            const versionB = Number(b.version);

            if (Number.isFinite(versionB) && Number.isFinite(versionA) && versionB !== versionA) {
              return versionB - versionA;
            }

            const gDiff = (a.group || '').localeCompare(b.group || '');
            if (gDiff !== 0) return gDiff;

            return (a.name || '').localeCompare(b.name || '');
          });
        } else {
          defaultSort();
        }

        page = 0;
      }

      if (btn.customId === 'copy') {
        const slice = results.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
        const codes = slice.map(c => c.cardCode).join(', ');
        return btn.followUp({ content: codes || 'No cards on this page.', ephemeral: true });
      }

      await message.edit({ embeds: [getEmbed()] });
    });

    collector.on('end', async () => {
      row.components.forEach(b => b.setDisabled(true));
      await message.edit({ components: [row] }).catch(() => {});
    });
  },
};