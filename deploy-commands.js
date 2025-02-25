// requirements:
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
// from env:
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // Discord application ID (should probably rename, not client)
const GUILD_ID = process.env.GUILD_ID;   // used only for development, storing for future use but not init release

// declare the command(s), just one for now likely more later so prepare for that
const commands = [
  new SlashCommandBuilder()
    .setName('clips')
    .setDescription('Screech a clip from mAc\'s Twitch')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('streamdammit')
    .setDescription('How many times have we asked mAc to stream?')
    .toJSON()
];

// exploring rest
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

// issue available commands:
(async () => {
  try {
	// maybe be more cereal with console logs for debugging
    console.log('Started refreshing application (/) commands.');
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log('Successfully reloaded restricted server commands.');
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log('Successfully reloaded global commands.');
    }
  } catch (error) {
    console.error(error);
  }
})();
