// screech index, here goes...
const { Client, GatewayIntentBits, MessageFlags } = require('discord.js');
const { env } = require('./src/config');
const commands = require('./src/commands');
const { startLiveMonitor } = require('./src/announce');
const nags = require('./src/nags');

// an unhandled error in any async handler would otherwise crash the whole bot
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});
client.on('error', err => console.error('Discord client error:', err));

// command name -> command, and button/select custom id prefix -> handler
const commandsByName = new Map(commands.map(command => [command.data.name, command]));
const componentHandlers = commands.flatMap(command => Object.entries(command.components || {}));

async function replyWithError(interaction) {
  const message = { content: 'SOMETHING WENT WRONG, I HAVE SCREECHED TOO HARD!', flags: MessageFlags.Ephemeral };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(message);
    } else {
      await interaction.reply(message);
    }
  } catch (err) {
    console.error('Could not tell the user about the error:', err);
  }
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      console.log(`[CMD] /${interaction.commandName} from ${interaction.user.tag}`);
      const command = commandsByName.get(interaction.commandName);
      if (command) await command.execute(interaction);
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
      const match = componentHandlers.find(([prefix]) => interaction.customId.startsWith(prefix));
      if (match) {
        const [prefix, handler] = match;
        await handler(interaction, interaction.customId.slice(prefix.length));
      }
    }
  } catch (err) {
    console.error(`Error handling interaction ${interaction.commandName || interaction.customId}:`, err);
    await replyWithError(interaction);
  }
});

client.on('messageCreate', async message => {
  try {
    await nags.handleMessage(message);
  } catch (err) {
    console.error('Error counting nags:', err);
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  startLiveMonitor(client);
});

client.login(env.DISCORD_TOKEN);
