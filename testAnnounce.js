// need a way to verify how it looks, copy most stuff and just make a test command
// not the most elaborate solution but this should just be a temp thing so whatever..
// also just kinda not feeling imo
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'testannounce') return;
	
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply();
      } catch (err) {
        console.error("Error deferring reply for /testannounce:", err);
        return;
      }
    }
    
    try {
        const streamInfo = {
        title: "Doom Part XX",
        game: "DOOM 2016",
        url: "https://twitch.tv/mAcStreamos"
      };

    const embed = new EmbedBuilder()
      .setTitle("<:cacopog:1342021381742788689> MAC CHAOS IS STREAMING <:cacopog:1342021381742788689>")
      .setURL(streamInfo.url)
      .setDescription(`**${streamInfo.title}**\n${streamInfo.game}`)
      .setColor(0x9146FF)
      .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error handling /testannounce command:", error);
      await interaction.editReply("An error occurred while processing the test announcement.");
    }
  });
};
