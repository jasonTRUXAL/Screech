// bot has been a success let's update with the ability to keep track of how much we nag mac
require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { getAccessToken, getBroadcasterId } = require('./twitchManager');
const TWITCH_CHANNEL_LOGIN = process.env.TWITCH_CHANNEL_LOGIN;

// annoying functions to utilize local files:
const dataFilePath = path.join(__dirname, 'gifData.json');
function loadData() {
  if (fs.existsSync(dataFilePath)) {
    try {
      const rawData = fs.readFileSync(dataFilePath, 'utf8');
      return JSON.parse(rawData);
    } catch (err) {
      console.error("Error reading data file:", err);
      return null;
    }
  }
  return null;
}
function saveData(data) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing data file:", err);
  }
}
let defaultTrackedGIFs = [
  {
    filename: "strim.gif",
    game: "DLOOLM",
    count: 0,
  },
];
const storedData = loadData();
let trackedGIFs = storedData && storedData.trackedGIFs ? storedData.trackedGIFs : defaultTrackedGIFs;
let lastStreamDate = storedData && storedData.lastStreamDate ? storedData.lastStreamDate : null;

module.exports = (client) => {
  // use bot to read and detect use of gifs, this is really tricky... should prob name vars better
  // use discord.js client.on's messageCreate class
  // https://discord.js.org/docs/packages/discord.js/main/Message:Class
  client.on('messageCreate', message => {
	// ignore bots using the gif
    if (message.author.bot) return;
    let updated = false;
	// iterate through the array and check...
    trackedGIFs.forEach(gifTracker => {
	  // if the content of the message has the array's filename..
      if (message.content.includes(gifTracker.filename)) {
		// keep track!
        gifTracker.count++;
		updated = true;
		console.log(`Count++ | Saw ${gifTracker.filename} again, ${gifTracker.count} times total.`);
      }
    });
	if (updated) {
      saveData({ trackedGIFs, lastStreamDate });
    }
  });

  // let's create a new command we've done this before
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
	// ugh i changed it from streamdamnit to streamdammit because we are weird
    if (interaction.commandName === 'streamdammit') {
      try {
		// using try to see if this prevents the timeout
		await interaction.deferReply();
      } catch (err) {
		console.error("Error deferring reply:", err);
		return;
      }

      try {
        // let's get the latest stream date
        const currentStreamDate = await getLastStreamDate();
        // if the date is not present or newer than last time it checked, reset it all
        if (!lastStreamDate || new Date(currentStreamDate) > new Date(lastStreamDate)) {
          trackedGIFs.forEach(gifTracker => {
            gifTracker.count = 0;
          });
		  // and keep track of the last stream by making it current
          lastStreamDate = currentStreamDate;
		  saveData({ trackedGIFs, lastStreamDate });
        }
      } catch (error) {
        console.error("Error fetching last stream date:", error);
		try {
			await interaction.editReply("An error occurred while fetching stream data.");
		} catch (editError) {
			console.error("Error editing reply:", editError);
		}
		return;
      }

      // let's type out responses generically for now
	  // declare the bot responses and reference each game, basically
      const responseLines = trackedGIFs.map(gifTracker => {
        return `MAC CHAOS HAS YET TO GIB STREAM OF **${gifTracker.game}** <:cacopog:1342021381742788689>\`${gifTracker.count} TIMES\`<:cacopog:1342021381742788689> **STREAMDAMMIT!**`;
      });
      let responseText = responseLines.join('\n');

      // reflection section
      const reflectionNote = "";
      if (reflectionNote) {
        responseText += "\n" + reflectionNote;
      }

      try {
		  await interaction.editReply(responseText);
	  } catch (err) {
		  console.error("Error editing reply:", err);
	  }
    }
  });

  // we have to use twitch api to get stream dates...
  async function getLastStreamDate() {
    const channelLogin = TWITCH_CHANNEL_LOGIN;
    // get valid access token (cached) and broadcaster id using new module
    const accessToken = await getAccessToken();
    const broadcasterId = await getBroadcasterId(channelLogin);
    // fetch latest archived video for the broadcaster
    const videosUrl = `https://api.twitch.tv/helix/videos?user_id=${broadcasterId}&first=1&type=archive`;
    const videosResponse = await fetch(videosUrl, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const videosData = await videosResponse.json();
    if (!videosResponse.ok || !videosData.data || videosData.data.length === 0) {
      throw new Error(`Error fetching videos for broadcaster ${channelLogin}`);
    }
    return videosData.data[0].created_at;
  }
};
