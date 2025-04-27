// screech index, here goes...
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { getAccessToken } = require('./twitchManager');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITCH_CHANNEL_LOGIN = process.env.TWITCH_CHANNEL_LOGIN;

// update the gateway intents
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ] 
});

require('./streamdamnit')(client);
require('./streamos')(client);
require('./testAnnounce')(client);
require('./gameGather')(client);

// fetch a random clip from Twitch
async function getRandomClip() {
  const token = await getAccessToken();
  const { getBroadcasterId } = require('./twitchManager');
  const broadcasterId = await getBroadcasterId(TWITCH_CHANNEL_LOGIN, token);
  // fetch up to 50 clips
  const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=50`;
  const response = await fetch(url, {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok || !data.data || data.data.length === 0) {
    throw new Error("no clips found");
  }
  // select a random clip from the list
  const randomIndex = Math.floor(Math.random() * data.data.length);
  return data.data[randomIndex];
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    console.log("Received interaction:", interaction.commandName);
  }
  
  if (interaction.commandName === 'clips') {
    // altering defer (just a note)
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply();
      } catch (err) {
        console.error("Error deferring reply for /clips:", err);
        return;
      }
    }
    try {
      const clip = await getRandomClip();
      // change the process to instead embed the video not show a thumbnail, also flavor text
      await interaction.editReply(`<:cacopog:1342021381742788689> HERE IS MAC CHAOS SCREECHING <:cacopog:1342021381742788689>\n${clip.url}`);
    } catch (error) {
      console.error("Error fetching clip:", error);
      await interaction.editReply("APOLOGIES, I AM DEAF CURRENTLY!");
    }
  } else if (interaction.commandName === 'doom') {
    // new /doom command to present a fancy YouTube link card
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply();
      } catch (err) {
        console.error("Error deferring reply for /doom:", err);
        return;
      }
    }
    try {
      const youtubeUrl = "https://youtu.be/uzqG536vBTw";
      // create a custom embed that resembles card.
      // note: setting the URL on the embed makes the title clickable.
      // Discord does not support making the image itself clickable independently. :|
      const embed = new EmbedBuilder()
        .setTitle("mAc Chaos Plays DOOM")
        .setURL(youtubeUrl)
        .setDescription("FPS Legend mAc Chaos plays DOOM 2016 live on Twitch over 11 gameplay sessions and here we highlight the best moments of his legendary experience raising Hell itself as he blasts through every Cacodemon in sight.")
        .setColor(10158080)
        .setFooter({ text: "A Lavarinth Compilation", iconURL: "https://cdn.discordapp.com/emojis/1342021381742788689.webp" })
        .setImage("https://i9.ytimg.com/vi/uzqG536vBTw/mqdefault.jpg?v=67cfd09a&sqp=CLSgv74G&rs=AOn4CLAUZrQ8m95z3KpuyDbAZNSqrswKUQ")
        .setThumbnail("https://cdn.discordapp.com/emojis/966554880695226368.webp?size=96&animated=true");
      await interaction.editReply({ content: youtubeUrl, embeds: [embed] });
    } catch (error) {
      console.error("Error handling /doom command:", error);
      await interaction.editReply("An error occurred while processing the command.");
    }
  }
});

let hasAnnouncedLive = false;

setInterval(async () => {
  try {
    const token = await getAccessToken();
    const liveStream = await require('./announceStream').getLiveStreamInfo(token);

    if (liveStream) {
      if (!hasAnnouncedLive) {
        // not announced yet, announce now
        await announceLiveStream(client, token);
        hasAnnouncedLive = true;
        console.log("stream is live!");
      } else {
        console.log("stream is live but already announced");
      }
    } else {
      if (hasAnnouncedLive) {
        console.log("no longer live, resetting announcement");
      }
      hasAnnouncedLive = false; // reset if streamer goes offline
    }
  } catch (err) {
    console.error("Error in setInterval announcement: ", err);
  }
}, 60000);

client.login(DISCORD_TOKEN);
