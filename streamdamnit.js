// bot has been a success let's update with the ability to keep track of how much we nag mac
require('dotenv').config();
const fetch = require('node-fetch');

module.exports = (client) => {
  // array of tracked gifs, currently two, doom stuffs and miside stuffs
  const trackedGIFs = [
    {
      url: "https://cdn.discordapp.com/attachments/628059125204385794/1335780946498293760/strim.gif?ex=67be6b73&is=67bd19f3&hm=a7187e0632704b043b72b7bccbb845a946bef8749a44818090018a47ed05596b&",
      game: "DLOOLM",
      count: 0,
    },
    {
      url: "https://cdn.discordapp.com/attachments/628059125204385794/1339097921777307669/streamdammit.gif?ex=67bdf65f&is=67bca4df&hm=06c47dfbcca10a1a04b114cea5b869259267ed2eda6fa7c641a9db448f38d21e&",
      game: "MiSide",
      count: 0,
    },
    // sure more to come in the future
  ];

  // may use but need to store date somewhere of last stream
  let lastStreamDate = null;

  // use bot to read and detect use of gifs, this is really tricky... should prob name vars better
  // use discord.js client.on's messageCreate class
  // https://discord.js.org/docs/packages/discord.js/main/Message:Class
  client.on('messageCreate', message => {
	// ignore bots using the gif
    if (message.author.bot) return;
	// iterate through the array and check...
    trackedGIFs.forEach(gifTracker => {
	  // if the content of the message has the array's url..
      if (message.content.includes(gifTracker.url)) {
		// keep track!
        gifTracker.count++;
      }
    });
  });

  // let's create a new command we've done this before
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
	// ugh i changed it from streamdamnit to streamdammit because we are weird
    if (interaction.commandName === 'streamdammit') {
      await interaction.deferReply();

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
        }
      } catch (error) {
        console.error("Error fetching last stream date:", error);
      }

      // let's type out responses generically for now
	  // declare the bot responses and reference each game, basically
      const responseLines = trackedGIFs.map(gifTracker => {
        return `<:cacopog:1342021381742788689> MAC CHAOS HAS BEEN TOLD TO STREAM ${gifTracker.game.toUpperCase()} ${gifTracker.count} AMOUNT OF TIMES! <:cacopog:1342021381742788689>`;
      });
      let responseText = responseLines.join('\n');

      // reflection section
      const reflectionNote = "this will be post content displayed after";
      if (reflectionNote) {
        responseText += "\n" + reflectionNote;
      }

      await interaction.editReply(responseText);
    }
  });

  // we have to use twitch api to get stream dates...
  async function getLastStreamDate() {
    const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;
    const channelLogin = "mAcStreamos"; // should move this to env var to be honest

    // need access token.
    const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
    const tokenResponse = await fetch(tokenUrl, { method: 'POST' });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(`Error fetching Twitch access token: ${tokenData.message}`);
    }
    const accessToken = tokenData.access_token;

    // need broadcaster ID.
    const userUrl = `https://api.twitch.tv/helix/users?login=${channelLogin}`;
    const userResponse = await fetch(userUrl, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const userData = await userResponse.json();
    if (!userResponse.ok || !userData.data || userData.data.length === 0) {
      throw new Error(`Error fetching broadcaster ID for ${channelLogin}`);
    }
    const broadcasterId = userData.data[0].id;

    // maybe we can just lookup latest stream date
    const videosUrl = `https://api.twitch.tv/helix/videos?user_id=${broadcasterId}&first=1&type=archive`;
    const videosResponse = await fetch(videosUrl, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const videosData = await videosResponse.json();
    if (!videosResponse.ok || !videosData.data || videosData.data.length === 0) {
      throw new Error(`Error fetching videos for broadcaster ${channelLogin}`);
    }
    // return date
    return videosData.data[0].created_at;
  }
};
