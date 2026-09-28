// registers the slash commands with discord. run after adding or changing a command.
const { REST, Routes } = require('discord.js');
const { env } = require('./src/config');
const commands = require('./src/commands');

// guild-only commands (testing, /rally) go to GUILD_ID; everything else is global
const globalCommands = commands.filter(c => !c.guildOnly).map(c => c.data.toJSON());
const guildCommands = commands.filter(c => c.guildOnly).map(c => c.data.toJSON());

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Registering ${globalCommands.length} global commands...`);
    await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: globalCommands });
    console.log('Global commands registered.');

    if (env.GUILD_ID) {
      console.log(`Registering ${guildCommands.length} guild commands...`);
      await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), { body: guildCommands });
      console.log('Guild commands registered.');
    } else {
      console.log('GUILD_ID not set, skipping guild commands:', guildCommands.map(c => c.name).join(', '));
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
