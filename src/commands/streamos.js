// toggles opt in/out for stream notifications
const { SlashCommandBuilder } = require('discord.js');
const { CACOPOG } = require('../config');
const { streamOptIns } = require('../data');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streamos')
    .setDescription('Toggle opt in/out for stream notifications.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    let optedIn;
    streamOptIns.update(data => {
      optedIn = !data.optInUsers.includes(userId);
      data.optInUsers = optedIn
        ? [...data.optInUsers, userId]
        : data.optInUsers.filter(id => id !== userId);
    });

    await interaction.reply(optedIn
      ? `${CACOPOG} **I WILL SCREECH AT YOU WHEN MAC CHAOS IS STREAMING!** ${CACOPOG}`
      : `${CACOPOG} I WILL TRY TO SCREECH AT YOU LESS! ${CACOPOG}`);
  },
};
