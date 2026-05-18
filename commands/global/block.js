const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

function parseCsv(input, limit = 100) {
  return (input || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function parseNameChoices(values) {
  const names = [];
  const forcedPairs = [];

  for (const raw of values) {
    if (raw.startsWith('pair|')) {
      const [, group, name] = raw.split('|');

      if (group && name) {
        forcedPairs.push({
          group: normalize(group),
          name: normalize(name),
        });
      }
    } else {
      names.push(normalize(raw));
    }
  }

  return { names, forcedPairs };
}

module.exports = {
  ephemeral: true,

  data: new SlashCommandBuilder()
    .setName('block')
    .setDescription('Block up to 5 groups, names, or group+name pairs.')
    .addStringOption(option =>
      option.setName('groups')
        .setDescription('Select from a list of groups to block')
        .addChoices(
          { name: 'Kiss of Life', value: 'Kiss of Life' },
          { name: 'BTS', value: 'BTS' },
          { name: 'CORTIS', value: 'CORTIS' },
          { name: 'Fifty Fifty', value: 'Fifty Fifty' },
          { name: 'BLACKPINK', value: 'BLACKPINK' },
        )
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('names')
        .setDescription('Select from a list of idols to block')
        .addChoices(
          { name: 'RIIZE — Eunseok', value: 'pair|RIIZE|Eunseok' },
          { name: 'TREASURE — Haruto', value: 'pair|TREASURE|Haruto' },
          { name: 'TREASURE — Hyunsik', value: 'pair|TREASURE|Hyunsik' },
          { name: 'SEVENTEEN — The8', value: 'pair|SEVENTEEN|The8' },
          { name: 'tripleS — Xinyu', value: 'pair|tripleS|Xinyu' },
          { name: 'GOT7 — Jackson', value: 'pair|GOT7|Jackson' },
          { name: 'LNGSHOT — Woojin', value: 'pair|LNGSHOT|Woojin' },
          { name: 'ALLDAY PROJECT — Tarzzan', value: 'pair|ALLDAY PROJECT|Tarzzan' },
          { name: 'THE BOYZ — Sunwoo', value: 'pair|THE BOYZ|Sunwoo' },
          { name: 'KARD — BM', value: 'pair|KARD|BM' },
          { name: 'ALPHA DRIVE ONE — Geonwoo', value: 'pair|ALPHA DRIVE ONE|Geonwoo' },
          { name: 'ALPHA DRIVE ONE — Leo', value: 'pair|ALPHA DRIVE ONE|Leo' },

          { name: 'Zico', value: 'Zico' },
          { name: 'Eric Nam', value: 'Eric Nam' },
          { name: 'LeeHi', value: 'LeeHi' },
          { name: 'Jeon Somi', value: 'Jeon Somi' },
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;

    const newGroups = parseCsv(interaction.options.getString('groups'), 100)
      .map(normalize);

    const rawNames = parseCsv(interaction.options.getString('names'), 100);
    const { names: newNames, forcedPairs } = parseNameChoices(rawNames);

    let user = await User.findOne({ userId });
    if (!user) user = await User.create({ userId });

    if (!user.blockedPulls) {
      user.blockedPulls = { groups: [], names: [], pairs: [] };
    }

    const currentGroups = user.blockedPulls.groups || [];
    const currentNames = user.blockedPulls.names || [];
    const currentPairs = user.blockedPulls.pairs || [];

    if (!newGroups.length && !newNames.length && !forcedPairs.length) {
      const embed = new EmbedBuilder()
        .setDescription([
          '### Block List ⋆˙⟡',
          '',
          `🚫 **Groups:** ${currentGroups.length ? currentGroups.join('\n') : 'None'}`,
          `🚫 **Names:** ${currentNames.length ? currentNames.join('\n') : 'None'} ${currentPairs.length ? currentPairs.map(p => `${p.group} + ${p.name}`).join('\n') : 'None'}`,
          '',
        ].join('\n'));

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }
    let addedGroups = [];
    let addedNames = [];
    let addedPairs = [];

    const pairKeys = new Set(
      currentPairs.map(p => `${p.group}:::${p.name}`)
    );

    for (const pair of forcedPairs) {
      const key = `${pair.group}:::${pair.name}`;

      if (!pairKeys.has(key)) {
        currentPairs.push(pair);
        addedPairs.push(pair);
        pairKeys.add(key);
      }
    }

    if (newGroups.length && newNames.length && newGroups.length === newNames.length) {
      for (let i = 0; i < newGroups.length; i++) {
        const pair = {
          group: newGroups[i],
          name: newNames[i],
        };

        const key = `${pair.group}:::${pair.name}`;

        if (!pairKeys.has(key)) {
          currentPairs.push(pair);
          addedPairs.push(pair);
          pairKeys.add(key);
        }
      }
    } else {
      addedGroups = newGroups.filter(g => !currentGroups.includes(g));
      addedNames = newNames.filter(n => !currentNames.includes(n));

      const mergedGroups = [...new Set([...currentGroups, ...newGroups])];
      const mergedNames = [...new Set([...currentNames, ...newNames])];

      if (mergedGroups.length > 100) {
        return interaction.editReply({
          content: `You can only block up to **100 groups** total.`,
          ephemeral: true,
        });
      }

      if (mergedNames.length > 100) {
        return interaction.editReply({
          content: `You can only block up to **100 names** total.`,
          ephemeral: true,
        });
      }

      user.blockedPulls.groups = mergedGroups;
      user.blockedPulls.names = mergedNames;
    }

    if (currentPairs.length > 100) {
      return interaction.editReply({
        content: 'You can only block up to **100 exact group+name pairs** total.',
        ephemeral: true,
      });
    }

    user.blockedPulls.pairs = currentPairs;

    await user.save();

    const embed = new EmbedBuilder()
      .setDescription([
        '## Block List ⋆˙⟡',
        '',
        `🚫 **Groups:** ${user.blockedPulls.groups.length ? user.blockedPulls.groups.join('\n') : 'None'}`,
        `🚫 **Names:** ${user.blockedPulls.names.length ? user.blockedPulls.names.join('\n') : 'None'} ${user.blockedPulls.pairs.length ? user.blockedPulls.pairs.map(p => `${p.group} + ${p.name}`).join('\n') : 'None'}`,
        '',
      ].join('\n'));

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  },
};