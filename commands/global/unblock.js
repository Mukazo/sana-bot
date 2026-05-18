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
  return String(value || '').trim();
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
    .setName('unblock')
    .setDescription('Remove blocked groups, names, or group+name pairs.')
    .addStringOption(option =>
      option.setName('groups')
        .setDescription('Select blocked groups to remove')
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
        .setDescription('Select blocked idols to remove')
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

    const groups = parseCsv(
      interaction.options.getString('groups'),
      100
    ).map(normalize);

    const rawNames = parseCsv(
      interaction.options.getString('names'),
      100
    );
    const {
      names,
      forcedPairs,
    } = parseNameChoices(rawNames);

    const user = await User.findOne({ userId });

    if (!user || !user.blockedPulls) {
      return interaction.editReply({
        content: 'You do not have any blocked values set.',
        ephemeral: true,
      });
    }

    user.blockedPulls.groups ||= [];
    user.blockedPulls.names ||= [];
    user.blockedPulls.pairs ||= [];

    if (!groups.length && !names.length && !forcedPairs.length) {
      user.blockedPulls = {
        groups: [],
        names: [],
        pairs: [],
      };

      await user.save();

      const embed = new EmbedBuilder()
        .setThumbnail(
          interaction.user.displayAvatarURL({ dynamic: true })
        )
        .setDescription([
          '## Block List Cleared ⋆˙⟡',
          '',
          '> **Groups:** None',
          '> **Names:** None',
          '',
        ].join('\n'))
        .setFooter({
          text: 'You can change these settings anytime!',
        });

      return interaction.editReply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    let removedGroups = [];
    let removedNames = [];
    let removedPairs = [];

    removedGroups = user.blockedPulls.groups.filter(g =>
      groups.includes(g)
    );

    removedNames = user.blockedPulls.names.filter(n =>
      names.includes(n)
    );

    user.blockedPulls.groups =
      user.blockedPulls.groups.filter(
        g => !groups.includes(g)
      );

    user.blockedPulls.names =
      user.blockedPulls.names.filter(
        n => !names.includes(n)
      );

    if (forcedPairs.length) {
      const pairKeys = new Set(
        forcedPairs.map(
          p => `${p.group}:::${p.name}`
        )
      );

      removedPairs = user.blockedPulls.pairs.filter(p =>
        pairKeys.has(`${p.group}:::${p.name}`)
      );

      user.blockedPulls.pairs =
        user.blockedPulls.pairs.filter(
          p => !pairKeys.has(`${p.group}:::${p.name}`)
        );
    }

    await user.save();

    const embed = new EmbedBuilder()
      .setThumbnail(
        interaction.user.displayAvatarURL({ dynamic: true })
      )
      .setDescription([
        '## Block List Updated ⋆˙⟡',
        '',
        `You currently have these __Groups__ blocked.\n🚫 **Group:** ${
          user.blockedPulls.groups.length
            ? user.blockedPulls.groups.join('\n🚫 **Group:** ')
            : 'None'
        }`,
        '',
        `You currently have these __Idols__ blocked.\n🚫 **Name:** ${
          user.blockedPulls.names.length
            ? user.blockedPulls.names.join('\n🚫 **Name:** ')
            : ''
        } ${
          user.blockedPulls.pairs.length
            ? user.blockedPulls.pairs
                .map(p => `${p.group} + ${p.name}`)
                .join('\n🚫 **Name:** ')
            : 'None'
        }`,
        '',
      ].join('\n'))
      .setFooter({
        text: 'You can change these settings anytime!',
      });

    return interaction.editReply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};