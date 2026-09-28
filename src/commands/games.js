// /games: a whispered select menu for picking which games you want to be rallied for
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { GAMES, GAME_NAMES } = require('../config');
const { gameOptIns } = require('../data');

const SELECT_ID = 'games_select';

function statusLines(games, userId) {
  return GAME_NAMES.map(game => {
    const opted = games[game].includes(userId);
    return `${GAMES[game].emoji}  \`${game.padEnd(15, ' ')} |   ${opted ? 'SCREECH AT YOU!!' : 'No notification.'}\``;
  }).join('\n');
}

function banner(text) {
  return `\`\`\`ansi\n\u001b[2;31m\n${text}\u001b[0m\n \n\`\`\`\n`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('games')
    .setDescription('Register your preferred game notifications.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const { games } = gameOptIns.read();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(SELECT_ID)
      .setPlaceholder('SELECT ALL YOUR GAMES!!!')
      .setMinValues(0)
      .setMaxValues(GAME_NAMES.length)
      .addOptions(GAME_NAMES.map(game => {
        const opted = games[game].includes(userId);
        return {
          label: game,
          value: game,
          description: opted ? 'Notifications enabled, unselect to disable.' : 'No notification, select to notify.',
          default: opted,
        };
      }));

    await interaction.reply({
      content: banner('TELL ME WHAT GAMES YOU WANT\nTO BE RALLIED IN WITH OTHERS!!!!') + statusLines(games, userId),
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      flags: MessageFlags.Ephemeral,
    });
  },

  components: {
    [SELECT_ID]: async interaction => {
      const userId = interaction.user.id;
      const selected = interaction.values;

      const { games } = gameOptIns.update(data => {
        for (const game of GAME_NAMES) {
          const has = data.games[game].includes(userId);
          if (selected.includes(game) && !has) {
            data.games[game].push(userId);
            console.log(`[GAMES] ${interaction.user.tag} opted in for ${game}`);
          } else if (!selected.includes(game) && has) {
            data.games[game] = data.games[game].filter(id => id !== userId);
            console.log(`[GAMES] ${interaction.user.tag} opted out of ${game}`);
          }
        }
      });

      await interaction.update({
        content: banner('   YOU HAVE SCREECHED YOUR\n PREFERENCES AND I WILL RALLY\nYOU WHEN THE TIME COMES, FIEND!') + statusLines(games, userId),
        components: [],
      });
    },
  },
};
