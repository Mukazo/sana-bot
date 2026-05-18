require('dotenv').config();
const { Client, GatewayIntentBits, Events, Collection, InteractionType, Partials } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const handleButton = require('./handlers/buttons');
const { EmbedBuilder } = require('discord.js');
const User = require('./models/User');
const Maintenance = require('./models/Maintenance');
const { startReminderPoller } = require('./utils/reminderPoller');
const syncCardAvailability = require('./utils/syncCardAvailability');

const MAINTENANCE_BYPASS_ROLE_ID = '1496904131045228734';

function buildMaintenanceEmbed(maintenance) {
  return new EmbedBuilder()
    .setDescription(
      [
        '## Sana is exhausted & now resting . . .',
        '> All adventures in the meantime are temporarily paused.',
        '',
        maintenance.reason
          ? `**Reason:** ${maintenance.reason}`
          : '**Reason:** Ongoing maintenance.',
        maintenance.endsAt
          ? `**Estimated completion:** <t:${Math.floor(
              new Date(maintenance.endsAt).getTime() / 1000
            )}:R>`
          : '**Estimated completion:** Unknown',
      ].join('\n')
    );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

client.commands = new Collection();

// Load commands
const commandFolders = ['global', 'guild-only'];

for (const folder of commandFolders) {
  const commandsPath = path.join(__dirname, 'commands', folder);
  if (!fs.existsSync(commandsPath)) continue;

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
  }
}

/* ===========================
   MAIN INTERACTION HANDLER
=========================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    /*===========================
       AUTOCOMPLETE FIRST
    =========================== */
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
      return;
    }

    /* ===========================
       BUTTONS FIRST
    =========================== */
    if (interaction.isButton()) {
      const handled = await handleButton(interaction);
      if (handled) return;
    }

    /* ===========================
       SLASH COMMANDS ONLY
    =========================== */
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const maintenance = await Maintenance.findOne().lean();

      const hasBypassRole =
        interaction.inGuild() &&
        interaction.member?.roles?.cache?.has(MAINTENANCE_BYPASS_ROLE_ID);

      if (maintenance?.active && !hasBypassRole) {
        return interaction.reply({
          embeds: [buildMaintenanceEmbed(maintenance)],
        });
      }

      const ephemeral = command.ephemeral === true;

      if (interaction.commandName !== 'log-in') {
        const userExists = await User.exists({ userId: interaction.user.id });
        if (!userExists) {
          return interaction.reply({
            content: 'Greetings Adventurer! You must use `/log-in` before attempting any other commands.'
          });
        }
      }

      try {
        await interaction.deferReply({ ephemeral });
        await command.execute(interaction);
      } catch (err) {
        console.error(err);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Something went wrong.',
            ephemeral: true
          }).catch(() => {});
        } else {
          await interaction.editReply('Something went wrong.').catch(() => {});
        }
      }

      return;
    }

    // other interaction types can go here later
  } catch (err) {
    console.error('[INTERACTION ERROR]', err);
  }
});

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Main bot MongoDB connected'))
  .catch(console.error);

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  global.client = client;

  await syncCardAvailability().catch(console.error);
  setInterval(() => {
    syncCardAvailability().catch(console.error);
  }, 60_000);

  startReminderPoller();
});

client.login(process.env.TOKEN);