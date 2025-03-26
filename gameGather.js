// finally a not stream related command that might actually be useful:
// /games: presents a message with emoji reactions for toggling game notifications
//         games available as test on 3/18: among us, blazblue, hustle, doom
//         users can opt in or out; their choices are stored persistently in gameData.json cause database no thx
// /rally: initiates a rally for a chosen game (via an option?)
//         pings all users who have opted in for that game, and adds reaction options:
//         ✅ for "yay", ❌ for "nay", and 🚫 for "stfu" (which also removes them from notifications)
//         after 5(?) minutes, screech posts a summary of who is interested

require('dotenv').config();
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    "Doom": []
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
  // let's not copy paste things
  if (gameEmojis[game]) {
    return `<:${game.toLowerCase().replace(/\s+/g, '')}:${gameEmojis[game]}>`;
  }
  return "";
}

// /rally statistics json (this is new)
const rallyStatsFilePath = path.join(__dirname, 'rallyStats.json');

function loadRallyStats() {
  if (fs.existsSync(rallyStatsFilePath)) {
    try {
      const rawData = fs.readFileSync(rallyStatsFilePath, 'utf8');
      return JSON.parse(rawData);
    } catch (err) {
      console.error("Error reading rally stats file:", err);
      return {};
    }
  }
  return {};
}
// /rally statistics write to file as usual
function saveRallyStats(stats) {
  try {
    fs.writeFileSync(rallyStatsFilePath, JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error("Error writing rally stats file:", err);
  }
}

// make the input case-insensitive and trim spaces
// really kind of failed on the idea of not having alternatives
// so dirty fix below
const gameAliases = {
  "among us": "Among Us",
  "amogus": "Among Us",
  "amongus": "Among Us",
  "blazblue": "BlazBlue",
  "blaz blue": "BlazBlue",
  "bb": "BlazBlue",
  "hustle": "Hustle",
  "doom": "Doom",
  "DOOM": "Doom",
  "dloolm": "Doom",
};

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
        const opted = gameData.games[game] && gameData.games[game].includes(interaction.user.id);
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
    let gameInput = interaction.options.getString('game');
    if (!gameInput) {
      await interaction.reply({ content: "You must specify a game. Available options: Among Us, BlazBlue, Hustle, Doom", flags: 64 });
      return;
    }
    
    // normalize input (trim, lower case) and use alias mapping, this is to verify game
    gameInput = gameInput.trim().toLowerCase();
    const canonicalGame = gameAliases[gameInput];
    if (!canonicalGame) {
      await interaction.reply({ content: "Invalid game selected. Please choose one of: Among Us, BlazBlue, Hustle, Doom", flags: 64 });
      console.log("[RALLY] Invalid game selected reply sent.");
      return;
    }
    
    // verify if the user wants to actually do this is not to prevent spam
    const confirmEmbed = new EmbedBuilder()
      .setTitle(`Confirm Rally for ${canonicalGame}`)
      .setDescription(`Are you sure you want to initiate a rally for **${canonicalGame}**?`)
      .setColor(0x9146FF)
      .setTimestamp();
      
	// the buttons for the confirmation or cancel
    const confirmButton = new ButtonBuilder()
      .setCustomId(`rally_confirm_${canonicalGame}`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success);
    const cancelButton = new ButtonBuilder()
      .setCustomId(`rally_cancel_${canonicalGame}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger);
      
    const buttonRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);
    
    try {
      await interaction.reply({ embeds: [confirmEmbed], components: [buttonRow], flags: 64 });
      console.log("[RALLY] Confirmation prompt sent.");
    } catch (err) {
      console.error("Error sending confirmation prompt for /rally:", err);
    }
  });
  
  // interaction responders for confirmation or cancellation need to be established
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    
    // if user picks cancel then...
    if (customId.startsWith('rally_cancel_')) {
      // update dialogue to state the user has cancelled the rally request
      const gameName = customId.replace('rally_cancel_', '');
      await interaction.update({ content: `Rally cancelled for ${gameName}.`, embeds: [], components: [] });
      console.log(`[RALLY] Rally cancelled for ${gameName} by ${interaction.user.tag}`);
      return;
    }
    
    // if user picks confirm, then...
    if (customId.startsWith('rally_confirm_')) {
      const gameName = customId.replace('rally_confirm_', '');
      // update the whisper confirmation confirmation to indicate rally initiation
	  // note may opt to delete the message instead but for testing let's keep it
      await interaction.update({ content: `Rally confirmed for ${gameName}.`, embeds: [], components: [] });
      console.log(`[RALLY] Rally confirmed for ${gameName} by ${interaction.user.tag}`);
      
      // after confirmation, prepare announcement
	  // load current game data
      const gameData = loadGameData();
	  // get list of users opted in for the selected game (using the canonical name)
      const optedInUsers = gameData.games[gameName] || [];
      const mentions = optedInUsers.length > 0 ? optedInUsers.map(id => `<@${id}>`).join(' ') : "NO ONE JOINED, I AM SORRY!";
      
      // create an embed announcement for the rally
      const rallyDuration = 300000; // 5 minutes in ms
      const rallyEndTime = Date.now() + rallyDuration;
      const publicEmbed = new EmbedBuilder()
        .setTitle(`I SCREECH AT YOU ALL!!!!`)
        .setDescription(`THE TIME HAS COME! THE RALLY IS HERE!\n\`\`\`IT IS TIME FOR ${gameName.toUpperCase()}\`\`\`\n**TELL THEM WHAT YOU THINK!!!**`)
        .setColor(0xf2b0ff)
        .setTimestamp()
		.addFields(
		  { name: '✅', value: 'I AM IN!!', inline: true },
		  { name: '❌', value: 'NOTHX!!', inline: true },
		  { name: '🚫', value: 'NO SCREECH!!', inline: true },
		  { name: 'TIME REMAINING:', value: '5:00 TO RALLY TOGETHER!!!', inline: false }
		);
      
	  // create the actual message for the rally that will have the embed
      let rallyMsg;
      try {
        rallyMsg = await interaction.channel.send({ content: `${mentions}`, embeds: [publicEmbed] });
        console.log("[RALLY] Public rally message sent.");
      } catch (err) {
        console.error("Error sending public rally message:", err);
        return;
      }
      
      // available actions by the users
      try {
        await rallyMsg.react('✅');
        await rallyMsg.react('❌');
        await rallyMsg.react('🚫');
        console.log("[RALLY] Reactions added to public rally message.");
      } catch (err) {
        console.error("Error adding reactions:", err);
      }
      
      // create a ReactionCollector on the rally message
      const rallyFilter = (reaction, user) => {
        return ['✅', '❌', '🚫'].includes(reaction.emoji.name) && !user.bot;
      };
      const rallyCollector = rallyMsg.createReactionCollector({ filter: rallyFilter, time: rallyDuration });
      console.log("[RALLY] Reaction collector started.");
      
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
      
      // timer to update the embed with remaining time every 15 seconds
	  // big test here for "live updates"
      const updateInterval = 15000;
      const timer = setInterval(async () => {
        const timeLeft = rallyEndTime - Date.now();
        if (timeLeft <= 0) return;
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        const updatedEmbed = EmbedBuilder.from(publicEmbed);
        const timeFieldIndex = updatedEmbed.data.fields.findIndex(field => field.name === 'TIME REMAINING:');
        if (timeFieldIndex !== -1) {
          updatedEmbed.data.fields[timeFieldIndex].value = `${timeStr} TO RALLY TOGETHER!!!`;
        } else {
          console.warn("Could not find 'TIME REMAINING:' field to update.");
        }
        try {
          await rallyMsg.edit({ embeds: [updatedEmbed] });
        } catch (err) {
          console.error('Error updating rally message:', err);
        }
      }, updateInterval);
      
      setTimeout(() => {
        clearInterval(timer);
        rallyCollector.stop();
      }, rallyDuration);
	  
      // when the collector ends, process the results
      rallyCollector.on('end', async () => {
        clearInterval(timer);
        console.log("[RALLY] Reaction collector ended.");
        
        // remove any users who reacted with hecking no from the opt-in list for this game
        let updated = false;
        rallyResults.stop.forEach(userId => {
          if (gameData.games[gameName] && gameData.games[gameName].includes(userId)) {
            gameData.games[gameName] = gameData.games[gameName].filter(id => id !== userId);
            console.log(`[RALLY] Removed user ${userId} from ${gameName} notifications due to 🚫 reaction.`);
            updated = true;
          }
        });
        if (updated) {
          saveGameData(gameData);
        }
        
        // build a summary of the rally results
        let summary = `Rally for **${gameName}** has ended.\n\n`;
        summary += "Interested (✅): " + (rallyResults.interested.size > 0 ? Array.from(rallyResults.interested).map(id => `<@${id}>`).join(', ') : "None") + "\n";
        summary += "Not Interested (❌): " + (rallyResults.notInterested.size > 0 ? Array.from(rallyResults.notInterested).map(id => `<@${id}>`).join(', ') : "None") + "\n";
        summary += "Opted Out (🚫): " + (rallyResults.stop.size > 0 ? Array.from(rallyResults.stop).map(id => `<@${id}>`).join(', ') : "None");
        
        // update rally stats
        const rallyStats = loadRallyStats();
        // initiator is included in the stats, using interaction.user.id from confirmation
        const initiatorId = interaction.user.id;
        if (!rallyStats[initiatorId]) {
          rallyStats[initiatorId] = { initiated: 0, totalJoined: 0, joined: {} };
        }
        rallyStats[initiatorId].initiated++;
        
        // initiator is in the interested list
        rallyResults.interested.add(initiatorId);
        
        // user who joined (✅), update their stats
        rallyResults.interested.forEach(userId => {
          if (!rallyStats[userId]) {
            rallyStats[userId] = { initiated: 0, totalJoined: 0, joined: {} };
          }
          // update for this specific game
          if (!rallyStats[userId].joined[gameName]) {
            rallyStats[userId].joined[gameName] = 0;
          }
          rallyStats[userId].joined[gameName]++;
          rallyStats[userId].totalJoined++;
        });
        
		// update the stats
        saveRallyStats(rallyStats);
        
        // build a stats summary embed, the whole reason for the stats
        let statsDescription = "";
        // list the users who participated in the list
        for (const userId of rallyResults.interested) {
          const stats = rallyStats[userId];
          const gameCount = stats.joined[gameName] || 0;
          statsDescription += `<@${userId}>:\n • Joined **${gameName}** rallies: ${gameCount}\n • Total joined rallies: ${stats.totalJoined}\n • Initiated rallies: ${stats.initiated}\n\n`;
        }
        
        const statsEmbed = new EmbedBuilder()
          .setTitle(`Rally for ${gameName} Summary`)
          .setDescription(statsDescription || "No participants.")
          .setColor(0x9146FF)
          .setTimestamp();
        
        try {
          await interaction.channel.send({ content: summary, embeds: [statsEmbed] });
          console.log("[RALLY] Rally summary follow-up sent.");
        } catch (err) {
          console.error("Error sending rally summary follow-up:", err);
        }
      });
    }
  });
};
