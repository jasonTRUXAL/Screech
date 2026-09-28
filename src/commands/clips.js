const { SlashCommandBuilder } = require('discord.js');
const { CACOPOG } = require('../config');
const twitch = require('../twitch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clips')
    .setDescription('Screech a clip from mAc\'s Twitch.'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const clips = await twitch.getClips(50);
      if (clips.length === 0) throw new Error('no clips found');
      const clip = clips[Math.floor(Math.random() * clips.length)];
      await interaction.editReply(`${CACOPOG} HERE IS MAC CHAOS SCREECHING ${CACOPOG}\n${clip.url}`);
    } catch (err) {
      console.error('[CLIPS] error fetching clip:', err);
      await interaction.editReply('APOLOGIES, I AM DEAF CURRENTLY!');
    }
  },
};
