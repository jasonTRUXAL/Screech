// this handles the /streamos command for toggling opt in/out for stream notifications.
require('dotenv').config();
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// using a json to store the users because database too much work and am lazy
const optInFilePath = path.join(__dirname, 'optinData.json');

// read through data and create an array
function loadOptInData() {
  if (fs.existsSync(optInFilePath)) {
    try {
      const rawData = fs.readFileSync(optInFilePath, 'utf8');
      return JSON.parse(rawData);
    } catch (err) {
      console.error("Error reading data file:", err);
      return { optInUsers: [] };
    }
  }
  return { optInUsers: [] };
}

// json save/write to file
function saveOptInData(data) {
  try {
    fs.writeFileSync(optInFilePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing data file:", err);
  }
}

// reload data in case of crash/restart/etc
let optInData = loadOptInData();

// creating the /streamos command
module.exports = (client) => {
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'streamos') return;
	
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
    } catch (err) {
      console.error("Error deferring reply for /streamos:", err);
      return;
    }
	
	try {
      // toggle opt in/out for stream notifications
      const userId = interaction.user.id;
      if (optInData.optInUsers.includes(userId)) {
        // if already opted in remove them (opt out)
        optInData.optInUsers = optInData.optInUsers.filter(id => id !== userId);
        saveOptInData(optInData);
        await interaction.editReply("<:cacopog:1342021381742788689> I WILL TRY TO SCREECH AT YOU LESS! <:cacopog:1342021381742788689>");
      } else {
        // if not then add them (opt in)
        optInData.optInUsers.push(userId);
        saveOptInData(optInData);
        await interaction.editReply("<:cacopog:1342021381742788689> **I WILL SCREECH AT YOU WHEN MAC CHAOS IS STREAMING!** <:cacopog:1342021381742788689>");
      }
	} catch (err) {
      console.error("Error processing /streamos interaction:", err);
    }
  });
  
  // in the event we need to use this list elsewhere we should make it available...
  client.getOptInUsers = () => {
    return optInData.optInUsers;
  };
};
