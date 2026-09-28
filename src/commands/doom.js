const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../config');

const VIDEO_ID = 'uzqG536vBTw';
const VIDEO_URL = `https://youtu.be/${VIDEO_ID}`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('doom')
    .setDescription('Watch the 2 hour documentary of mAc\'s DOOM streams.'),

  async execute(interaction) {
    // setting the url makes the title clickable; discord won't make the image clickable :|
    const embed = new EmbedBuilder()
      .setTitle('mAc Chaos Plays DOOM')
      .setURL(VIDEO_URL)
      .setDescription('FPS Legend mAc Chaos plays DOOM 2016 live on Twitch over 11 gameplay sessions and here we highlight the best moments of his legendary experience raising Hell itself as he blasts through every Cacodemon in sight.')
      .setColor(COLORS.doom)
      .setFooter({ text: 'A Lavarinth Compilation', iconURL: 'https://cdn.discordapp.com/emojis/1342021381742788689.webp' })
      // the plain i.ytimg.com thumbnail url doesn't expire like the signed i9 one did
      .setImage(`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`)
      .setThumbnail('https://cdn.discordapp.com/emojis/966554880695226368.webp?size=96&animated=true');
    await interaction.reply({ content: VIDEO_URL, embeds: [embed] });
  },
};
