// finally a not stream related command that might actually be useful:
// /games: presents a message with emoji reactions for toggling game notifications
//         games available as test on 3/18: among us, blazblue, hustle, doom
//         users can opt in or out; their choices are stored persistently in gameData.json cause database no thx
// /rally: initiates a rally for a chosen game (via an option?)
//         pings all users who have opted in for that game, and adds reaction options:
//         ✅ for "yay", ❌ for "nay", and 🚫 for "stfu" (which also removes them from notifications)
//         after 5(?) minutes, screech posts a summary of who is interested

require('dotenv').config();
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

console.log("[GAMEGATHER] Module loaded");

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
  
  // /games command implementation
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'games') return;
    
    console.log(`[GAMES] Command received from ${interaction.user.tag}`);
    
    // Defer reply if not already done
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply(); // not ephemeral so that reactions can be added
        console.log("[GAMES] Deferred reply successfully.");
      } catch (err) {
        console.error("Error deferring reply for /games:", err);
        return;
      }
    }
    
    // Immediately send a short "processing" message to satisfy Discord
    try {
      await interaction.editReply("Processing your game selections...");
      console.log("[GAMES] Initial processing message sent.");
    } catch (err) {
      console.error("Error sending initial processing message for /games:", err);
      return;
    }
    
    // load current game data from file
    let gameData = loadGameData();
    // build the embed for this communication
    let content = "React with the following emojis to toggle your notifications for each game:\n";
    for (const game in gameData.games) {
      const opted = gameData.games[game].includes(interaction.user.id);
      content += `${game}: ${opted ? "Opted In" : "Not Opted In"} — ${getEmoji(game)}\n`;
    }
    content += "\nWhen finished, react with ✅ to confirm your choices.";
    
    let msg;
    try {
      // send the message as a follow-up (so we can add reactions)
      msg = await interaction.editReply(content);
      console.log("[GAMES] Follow-up message sent.");
    } catch (err) {
      console.error("Error sending /games follow-up:", err);
      return;
    }
    
    // add game emoji reactions and the confirm emoji
    for (const game in gameEmojis) {
      try {
        await msg.react(getEmoji(game));
        console.log(`[GAMES] Added reaction for ${game}.`);
      } catch (err) {
        console.error(`Error adding reaction for ${game}:`, err);
      }
    }
    try {
      await msg.react('✅');
      console.log("[GAMES] Added confirm reaction (✅).");
    } catch (err) {
      console.error("Error adding confirm reaction:", err);
    }
    
    // create a ReactionCollector that listens only for reactions from the invoker
    const filter = (reaction, user) => {
      return user.id === interaction.user.id && 
             (Object.values(gameEmojis).includes(reaction.emoji.id) || reaction.emoji.name === '✅');
    };
    const collector = msg.createReactionCollector({ filter, time: 30000 });
    console.log("[GAMES] Reaction collector started.");
    
    // when confirm (✅) is received, stop the collector
    collector.on('collect', (reaction, user) => {
      console.log(`[GAMES] Collected reaction ${reaction.emoji.name} from ${user.tag}`);
      if (reaction.emoji.name === '✅') {
        collector.stop();
      }
    });
    
    // when the collector ends, process the reactions and update opt-in status
    collector.on('end', async collected => {
      console.log("[GAMES] Collector ended. Collected reactions:", collected.size);
      // for each game, check if the user reacted with that game's emoji
      for (const game in gameEmojis) {
        // find the reaction corresponding to the game's emoji
        const r = collected.find(r => r.emoji.id === gameEmojis[game]);
        if (r) {
          // if user reacted, toggle their opt-in status for that game
          if (gameData.games[game].includes(interaction.user.id)) {
            // remove user (opt out)
            gameData.games[game] = gameData.games[game].filter(id => id !== interaction.user.id);
            console.log(`[GAMES] ${interaction.user.tag} opted out of ${game}`);
          } else {
            // or add user (opt in)
            gameData.games[game].push(interaction.user.id);
            console.log(`[GAMES] ${interaction.user.tag} opted in for ${game}`);
          }
        }
      }
      // save updated game data
      saveGameData(gameData);
      
      // build a confirmation message
      let confirmation = "Your game notification subscriptions have been updated:\n";
      for (const game in gameData.games) {
        const opted = gameData.games[game].includes(interaction.user.id);
        confirmation += `${game}: ${opted ? "Opted In" : "Opted Out"}\n`;
      }
      try {
        await interaction.followUp(confirmation);
        console.log("[GAMES] Confirmation follow-up sent.");
      } catch (err) {
        console.error("Error sending /games confirmation follow-up:", err);
      }
    });
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
        await interaction.reply("Invalid game selected. Please choose one of Among Us, BlazBlue, Hustle, or Doom.");
        console.log("[RALLY] Invalid game selected reply sent.");
      } catch (err) {
        console.error("Error replying to invalid game in /rally:", err);
      }
      return;
    }
    
    // defer reply if not already done
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply();
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
        await interaction.followUp(summary);
        console.log("[RALLY] Rally summary follow-up sent.");
      } catch (err) {
        console.error("Error sending rally summary follow-up:", err);
      }
    });
  });
};
