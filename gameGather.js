// finally a not stream related command that might actually be useful:
// /games: presents a message with emoji reactions for toggling game notifications
//         games available as test on 3/18: among us, blazblue, hustle, doom
//         users can opt in or out; their choices are stored persistently in gameData.json cause database no thx
// /rally: initiates a rally for a chosen game (via an option?)
//         pings all users who have opted in for that game, and adds reaction options:
//         ✅ for "yay", ❌ for "nay", and 🚫 for "stfu" (which also removes them from notifications)
//         after 5(?) minutes, screech posts a summary of who is interested

require('dotenv').config();
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// store game info for opt in of users
const gameDataFilePath = path.join(__dirname, 'gameData.json');

// list the games for the file
const defaultGameData = {
  games: {
    "Among Us": [],
    "BlazBlue": [],
    "Hustle": [],
    "DOOM": []
  }
};

// similar to other json, we need to read it
function loadGameData() {
  if (fs.existsSync(gameDataFilePath)) {
    try {
      const rawData = fs.readFileSync(gameDataFilePath, 'utf8');
      return JSON.parse(rawData);
    } catch (err) {
      console.error("Error reading game data file:", err);
      return defaultGameData;
    }
  }
  return defaultGameData;
}

// similar ot other json, we need to save as well
function saveGameData(data) {
  try {
    fs.writeFileSync(gameDataFilePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing game data file:", err);
  }
}

// using discord dev portal emojis uploaded to bot's account
const gameEmojis = {
  "Among Us": "1351763461973213314",
  "BlazBlue": "1351763469652983879",
  "Hustle": "1351763476502151270",
  "Doom": "1342021381742788689"
};

// also available is their markdown code
function getEmoji(game) {
  switch(game) {
    case "Among Us": return "<:amongus:1351763461973213314>";
    case "BlazBlue": return "<:blazblue:1351763469652983879>";
    case "Hustle": return "<:hustle:1351763476502151270>";
    case "Doom": return "<:cacopog:1342021381742788689>";
    default: return "";
  }
}

// let's create the commands...
module.exports = (client) => {
  
  // /games command implementation using a select menu (whispered so only the user sees it)
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'games') return;
    
    console.log(`[GAMES] Command received from ${interaction.user.tag}`);
    
    // immediately respond with a whispered message containing a select menu
    try {
      // load current game data from file
      let gameData = loadGameData();
      
      // build the description showing current status for each game
      let description = "```ansi\n\u001b[2;31m\nTELL ME WHAT GAMES YOU WANT WANT\nTO BE RALLIED IN WITH OTHERS!!!!\u001b[0m\n \n```";
      for (const game in gameData.games) {
        const opted = gameData.games[game].includes(interaction.user.id);
        description += `${getEmoji(game)}  \`${game.padEnd(15, " ")} |   ${opted ? "SCREECH AT YOU!!" : "No notification."}\`\n`;
      }
      
      // create a select menu with options for each game.
      // set the 'default' flag to true if the user is already opted in.
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('games_select')
        .setPlaceholder('SELECT ALL YOUR GAMES!!!')
        .setMinValues(0)
        .setMaxValues(Object.keys(gameEmojis).length);
      
      for (const game in gameEmojis) {
        const opted = gameData.games[game].includes(interaction.user.id);
        selectMenu.addOptions({
          label: game,
          value: game,
          description: opted ? "Notifications enabled, select to disable." : "No notification, select to notify.",
          default: opted
        });
      }
      
      // create an action row containing the select menu
      const row = new ActionRowBuilder().addComponents(selectMenu);
      
      // send a whisper reply with the select menu
      await interaction.reply({
        content: description,
        components: [row],
        flags: 64
      });
      console.log("[GAMES] Whisper select menu sent for /games command.");
      
    } catch (err) {
      console.error("Error handling /games command:", err);
    }
  });
  
  // listen for the select menu interaction with customId 'games_select'
  client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'games_select') return;
    
    console.log(`[GAMES] Select menu submitted by ${interaction.user.tag}`);
    
    // load current game data
    let gameData = loadGameData();
    // the selected games are in interaction.values (an array of game names)
    const selectedGames = interaction.values;
    
    // for each game in our list, update the user's opt-in status based on selection
    for (const game in gameData.games) {
      if (selectedGames.includes(game)) {
        // if user is not in the list, add them
        if (!gameData.games[game].includes(interaction.user.id)) {
          gameData.games[game].push(interaction.user.id);
          console.log(`[GAMES] ${interaction.user.tag} opted in for ${game}`);
        }
      } else {
        // if user is in the list, remove them
        if (gameData.games[game].includes(interaction.user.id)) {
          gameData.games[game] = gameData.games[game].filter(id => id !== interaction.user.id);
          console.log(`[GAMES] ${interaction.user.tag} opted out of ${game}`);
        }
      }
    }
    
    // save the updated game data
    saveGameData(gameData);
    
    // build a confirmation message
    let confirmation = "```ansi\n\u001b[2;31m\n   YOU HAVE SCREECHED YOUR\n PREFERENCES AND I WILL RALLY\nYOU WHEN THE TIME COMES, FIEND!\u001b[0m\n \n```";
    for (const game in gameData.games) {
      const opted = gameData.games[game].includes(interaction.user.id);
      confirmation += `${getEmoji(game)}  \`${game.padEnd(15, " ")} |   ${opted ? "SCREECH AT YOU!!" : "No notification."}\`\n`;

    }
    
    try {
      await interaction.update({ content: confirmation, components: [] });
      console.log("[GAMES] Confirmation updated for /games command.");
    } catch (err) {
      console.error("Error updating /games confirmation:", err);
    }
  });
  
  // /rally command implementation
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'rally') return;
    
    console.log(`[RALLY] Command received from ${interaction.user.tag}`);
    
    // for /rally, we expect a string option named "game"
    const game = interaction.options.getString('game');
    // validate that the game is one of the allowed ones
    if (!Object.keys(gameEmojis).includes(game)) {
      try {
        await interaction.reply({ content: "Invalid game selected. Please choose one of Among Us, BlazBlue, Hustle, or Doom.", flags: 64 });
        console.log("[RALLY] Invalid game selected reply sent.");
      } catch (err) {
        console.error("Error replying to invalid game in /rally:", err);
      }
      return;
    }
    
    // defer reply with whisper option so only the invoker sees it
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({ flags: 64 });
        console.log("[RALLY] Deferred reply successfully.");
      } catch (err) {
        console.error("Error deferring reply for /rally:", err);
        return;
      }
    }
    
    // load current game data
    let gameData = loadGameData();
    // get list of users opted in for the selected game
    const optedInUsers = gameData.games[game] || [];
    const mentions = optedInUsers.length > 0 ? optedInUsers.map(id => `<@${id}>`).join(' ') : "None";
    
    // create an embed announcement for the rally
    const embed = new EmbedBuilder()
      .setTitle(`Rally for ${game}!`)
      .setDescription(`React to this message to indicate your interest:\n\n✅ : I'm in\n❌ : I'm not\n🚫 : Stop alerts & remove me from notifications`)
      .setColor(0x9146FF)
      .setTimestamp();
      
    let rallyMsg;
    try {
      rallyMsg = await interaction.editReply({ content: `${mentions}\nRally initiated for ${game}!`, embeds: [embed] });
      console.log("[RALLY] Rally message sent.");
    } catch (err) {
      console.error("Error sending rally message for /rally:", err);
      return;
    }
    
    try {
      await rallyMsg.react('✅');
      await rallyMsg.react('❌');
      await rallyMsg.react('🚫');
      console.log("[RALLY] Reactions added to rally message.");
    } catch (err) {
      console.error("Error adding reactions to rally message:", err);
    }
    
    // create a ReactionCollector on the rally message with a 5 minute duration
    const rallyFilter = (reaction, user) => {
      return ['✅', '❌', '🚫'].includes(reaction.emoji.name) && !user.bot;
    };
    const rallyCollector = rallyMsg.createReactionCollector({ filter: rallyFilter, time: 300000 });
    console.log("[RALLY] Rally reaction collector started.");
    
    // object to store rally responses
    const rallyResults = {
      interested: new Set(),
      notInterested: new Set(),
      stop: new Set()
    };
    
    rallyCollector.on('collect', (reaction, user) => {
      console.log(`[RALLY] Collected reaction ${reaction.emoji.name} from ${user.tag}`);
      if (reaction.emoji.name === '✅') {
        rallyResults.interested.add(user.id);
      } else if (reaction.emoji.name === '❌') {
        rallyResults.notInterested.add(user.id);
      } else if (reaction.emoji.name === '🚫') {
        rallyResults.stop.add(user.id);
      }
    });
    
    rallyCollector.on('end', async () => {
      console.log("[RALLY] Rally collector ended.");
      // remove any users who reacted with 🚫 from the opt-in list for this game
      let updated = false;
      rallyResults.stop.forEach(userId => {
        if (gameData.games[game].includes(userId)) {
          gameData.games[game] = gameData.games[game].filter(id => id !== userId);
          console.log(`[RALLY] Removed user ${userId} from ${game} notifications due to 🚫 reaction.`);
          updated = true;
        }
      });
      if (updated) {
        saveGameData(gameData);
      }
      
      // build a summary of the rally
      let summary = `Rally for ${game} has ended.\n\n`;
      summary += "Interested (✅): " + (rallyResults.interested.size > 0 ? Array.from(rallyResults.interested).map(id => `<@${id}>`).join(', ') : "None") + "\n";
      summary += "Not Interested (❌): " + (rallyResults.notInterested.size > 0 ? Array.from(rallyResults.notInterested).map(id => `<@${id}>`).join(', ') : "None") + "\n";
      summary += "Removed from notifications (🚫): " + (rallyResults.stop.size > 0 ? Array.from(rallyResults.stop).map(id => `<@${id}>`).join(', ') : "None");
      
      try {
        await interaction.followUp({ content: summary, flags: 64 });
        console.log("[RALLY] Rally summary follow-up sent.");
      } catch (err) {
        console.error("Error sending rally summary follow-up:", err);
      }
    });
  });
};
