// preview the go-live announcement using the same embed builder as the real one
// guild-only and whispered, so it's safe to spam while tweaking
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildAnnouncementEmbed } = require('../announce');
const twitch = require('../twitch');

module.exports = {
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('testannounce')
    .setDescription('Preview the stream announcement (only you see it).'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const broadcaster = await twitch.getBroadcaster();
    // use the real stream if live, otherwise fake one
    const stream = await twitch.getLiveStream() || {
      title: 'Doom Part XX',
      game_name: 'DOOM 2016',
      thumbnail_url: null,
    };
    await interaction.editReply({ embeds: [buildAnnouncementEmbed(stream, broadcaster)] });
  },
};
