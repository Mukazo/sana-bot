const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

const { enqueueInteraction, listenForResults } = require('../../../queue');

async function requestBatchChoices(interaction) {
  const focused = interaction.options.getFocused() ?? '';
  const jobId = `batch-autocomplete:${interaction.id}:${Date.now()}`;

  await enqueueInteraction('batch-autocomplete', {
    jobId,
    guildId: interaction.guildId,
    query: focused
  });

  return new Promise(resolve => {
    let unlisten = () => {};

    const timeout = setTimeout(() => {
      unlisten();
      resolve([]);
    }, 2500);

    unlisten = listenForResults(result => {
      if (!result || result.jobId !== jobId) return;

      clearTimeout(timeout);
      unlisten();

      const choices = [
        { name: 'No Batch', value: 'null' },
        ...(result.batches ?? [])
      ]
        .filter(choice => choice?.name && choice?.value)
        .slice(0, 25);

      resolve(choices);
    });
  });
}

module.exports = {
  async autocompleteBatch(interaction) {
    try {
      const choices = await requestBatchChoices(interaction);
      return interaction.respond(choices);
    } catch {
      return interaction.respond([{ name: 'No Batch', value: 'null' }]);
    }
  },

  async execute(interaction) {
    await interaction.editReply({ content: 'Loading…' });

    const opts = interaction.options;
    const selectedBatch = opts.getString('batch');

    const payload = {
      cardCode: opts.getString('cardcode'),
      name: opts.getString('name'),
      rarity: opts.getString('rarity'),
      group: opts.getString('group'),
      batch: selectedBatch && selectedBatch !== 'null' ? selectedBatch : null,
      namealias: opts.getString('namealias'),
      groupalias: opts.getString('groupalias'),
      era: opts.getString('era'),
      emoji: opts.getString('emoji'),
      active: opts.getBoolean('active'),
      availableQuantity: opts.getInteger('availablequantity'),
      imageUrl: opts.getAttachment('image').url,
      designerIds: [
        opts.getUser('designer')?.id,
        opts.getUser('designer2')?.id,
        opts.getUser('designer3')?.id
      ].filter(Boolean),
      userId: interaction.user.id,
      guildId: interaction.guildId
    };
    const preview = new EmbedBuilder()
      .setTitle(`Card Preview — ${payload.cardCode}`)
      .setColor(0x5865F2)
      .setImage(payload.imageUrl)
      .addFields(
        { name: 'Name', value: payload.name, inline: true },
        { name: 'Rarity', value: payload.emoji || payload.rarity, inline: true },
        { name: 'Group', value: payload.group ?? '—', inline: true },
        { name: 'Batch', value: payload.batch ?? 'No Batch', inline: true },
        { name: 'Era', value: payload.era ?? '—', inline: true },
        { name: 'Active', value: String(payload.active), inline: true },
        { name: 'Name Alias', value: payload.namealias ?? '—', inline: true },
        { name: 'Group Alias', value: payload.groupalias ?? '—', inline: true },
        {
          name: 'Designers',
          value: payload.designerIds.length
            ? payload.designerIds.map(id => `<@${id}>`).join(', ')
            : '—',
          inline: true
        },
        {
          name: 'Limited',
          value: payload.availableQuantity ? String(payload.availableQuantity) : 'No',
          inline: true
        }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({
      content: null,
      embeds: [preview],
      components: [row]
    });

    const msg = await interaction.fetchReply();

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000
    });

    collector.on('collect', async btn => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({
          content: 'Only the invoker can use these buttons.',
          ephemeral: true
        });
      }

      await btn.deferUpdate();

      if (btn.customId === 'cancel') {
        collector.stop('cancelled');

        return interaction.editReply({
          content: 'Cancelled.',
          embeds: [],
          components: []
        });
      }

      if (btn.customId !== 'confirm') return;

      collector.stop('confirmed');

      await interaction.editReply({
        content: 'Creating card...',
        embeds: [],
        components: []
      });

      const jobId = `${interaction.id}:${Date.now()}`;

      console.log('[CARD CREATE] enqueueing job:', jobId);

      let unlisten = () => {};

      const timeout = setTimeout(async () => {
        unlisten();

        await interaction.editReply({
          content: 'Card creation timed out. Worker did not send a result back.',
          embeds: [],
          components: []
        }).catch(() => {});
      }, 60_000);

      unlisten = listenForResults(async result => {
        if (!result || result.jobId !== jobId) return;

        console.log('[CARD CREATE] got result:', result);

        clearTimeout(timeout);
        unlisten();

        if (!result.ok) {
          return interaction.followUp({
            content: `${result.error}`,
            ephemeral: true
          });
        }

        return interaction.followUp({
          content: `Created \`${result.cardCode}\`${payload.batch ? ` in batch \`${payload.batch}\`` : ''}.`
        });
      });

      await enqueueInteraction('card-create', {
        jobId,
        ...payload
      });
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        try {
          await interaction.editReply({
            content: 'Timed out.',
            embeds: [],
            components: []
          });
        } catch {}
      }
    });
  }
};