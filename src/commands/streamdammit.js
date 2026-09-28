// how many times have we asked mac to stream since the last one?
const { SlashCommandBuilder } = require('discord.js');
const { CACOPOG } = require('../config');
const nags = require('../nags');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streamdammit')
    .setDescription('How many times have we asked mAc to stream?'),

  async execute(interaction) {
    await interaction.deferReply();
    const trackedGIFs = await nags.getCounts();
    const lines = trackedGIFs.map(gif =>
      `MAC CHAOS HAS YET TO GIB STREAM OF **${gif.game}** ${CACOPOG}\`${gif.count} TIMES\`${CACOPOG} **STREAMDAMMIT!**`);
    await interaction.editReply(lines.join('\n'));
  },
};
