const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const SummonSession = require('../../models/SummonSession');
const cooldowns = require('../../utils/cooldownManager');
const Card = require('../../models/Card');
const CardInventory = require('../../models/CardInventory');

module.exports = async function summonButtonHandler(interaction) {
  if (!interaction.customId.startsWith('miracle:')) return;

  await interaction.deferUpdate();

  const index = Number(interaction.customId.split(':')[1]);
  if (Number.isNaN(index)) return;

  const messageId = interaction.message.id;
  const session = await SummonSession.findOne({ messageId });
  const now = Date.now();

  if (!session) {
    console.log('[MIRACLE DEBUG] No session found for message', messageId);
    return;
  }

  if (session.expiresAt && session.expiresAt.getTime() <= now) {
    console.log('[MIRACLE DEBUG] Session expired');

    const disabledRow = new ActionRowBuilder().addComponents(
      interaction.message.components[0].components.map(btn =>
        ButtonBuilder.from(btn).setDisabled(true)
      )
    );

    await interaction.message.edit({ components: [disabledRow] });

    return interaction.followUp({
      content: 'This miracle has expired.',
      ephemeral: true,
    });
  }

  const card = session.cards[index];
  if (!card) {
    console.log('[MIRACLE DEBUG] Card index invalid', index);
    return;
  }

  console.log('[MIRACLE DEBUG] Claim attempt', {
    userId: interaction.user.id,
    cardCode: card.cardCode,
    rarity: card.rarity,
    group: card.group,
    era: card.era,
  });

  if (interaction.user.id !== session.ownerId) {
    return interaction.followUp({
      content: 'Only the caster of this miracle may claim a card.',
      ephemeral: true,
    });
  }

  if (card.claimedBy) {
    return interaction.followUp({
      content: 'This card has already been claimed.',
      ephemeral: true,
    });
  }

  if (
    interaction.user.id === session.ownerId &&
    session.ownerHasClaimed
  ) {
    return interaction.followUp({
      content: 'You already claimed a card from this miracle.',
      ephemeral: true,
    });
  }

  const result = await SummonSession.updateOne(
    {
      _id: session._id,
      [`cards.${index}.claimedBy`]: null,
    },
    {
      $set: {
        [`cards.${index}.claimedBy`]: interaction.user.id,
        ownerHasClaimed:
          interaction.user.id === session.ownerId ||
          session.ownerHasClaimed,
      },
    }
  );

  if (result.modifiedCount === 0) {
    console.log('[MIRACLE DEBUG] Atomic claim failed');
    return interaction.followUp({
      content: 'Someone else claimed this card first.',
      ephemeral: true,
    });
  }

  session.cards[index].claimedBy = interaction.user.id;
  if (interaction.user.id === session.ownerId) {
    session.ownerHasClaimed = true;
  }

  await CardInventory.updateOne(
    { userId: interaction.user.id, cardCode: card.cardCode },
    { $inc: { quantity: 1 } },
    { upsert: true }
  );

  const inventory = await CardInventory.findOne({ userId: interaction.user.id, cardCode: card.cardCode });
const quantity = inventory?.quantity || 1;

  console.log('[MIRACLE DEBUG] Emitting quest event');
  console.log('[MIRACLE DEBUG] emitQuestEvent typeof:', typeof emitQuestEvent);

  // 🔥 FETCH FULL CARD DATA FIRST
const fullCard = await Card.findOne({ cardCode: card.cardCode }).lean();

if (!fullCard) {
  console.error('[MIRACLE DEBUG] Card not found in DB:', card.cardCode);
  return;
}

console.log('[MIRACLE DEBUG] Full card loaded for quest:', {
  cardCode: fullCard.cardCode,
  rarity: fullCard.rarity,
  group: fullCard.group,
  era: fullCard.era,
});


  await interaction.followUp({
  content: `You claimed **${card.cardCode}**. You now have **${quantity}** copies.`,
  ephemeral: true,
});

  if (!interaction.message?.components?.length) return;

const oldRow = interaction.message.components[0];

const newRow = new ActionRowBuilder().addComponents(
  session.cards.map((c, i) =>
    new ButtonBuilder()
      .setCustomId(`miracle:${i}`)
      .setLabel(oldRow.components[i]?.label || `Card ${i + 1}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(Boolean(c.claimedBy))
  )
);

// Fetch fresh channel + message (restart safe)
const channel = await interaction.client.channels
  .fetch(interaction.channelId)
  .catch(() => null);

if (!channel) return;

const message = await channel.messages
  .fetch(interaction.message.id)
  .catch(() => null);

if (!message) return;

await message.edit({ components: [newRow] });
};
