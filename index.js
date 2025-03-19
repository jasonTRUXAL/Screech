// screech index, here goes...
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_CHANNEL_LOGIN = "mAcStreamos"; // single use only for now, maybe turn into array later to randomly pick

// update the gatewat intents
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

require('./streamdamnit')(client);
require('./streamos')(client);
require('./testAnnounce')(client); // this is for testing only don't really need it
require('./gameGather')(client);
const announceLiveStream = require('./announceStream');

// vars to cache Twitch token and broadcaster ID
let twitchAccessToken = null;
let twitchAccessTokenExpiry = null;
let broadcasterId = null;

// get (or refresh) the Twitch access token
async function getTwitchAccessToken() {
  if (twitchAccessToken && twitchAccessTokenExpiry && Date.now() < twitchAccessTokenExpiry) {
    return twitchAccessToken;
  }
  const url = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Error fetching Twitch access token: ${data.message}`);
  }
  twitchAccessToken = data.access_token;
  // set expiry (data.expires_in is in seconds so math it out; subtract a 1-minute buffer)
  twitchAccessTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
  return twitchAccessToken;
}

// get the broadcaster ID using the twitch username
async function getBroadcasterId() {
  if (broadcasterId) return broadcasterId;
  const token = await getTwitchAccessToken();
  const url = `https://api.twitch.tv/helix/users?login=${TWITCH_CHANNEL_LOGIN}`;
  const response = await fetch(url, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok || !data.data || data.data.length === 0) {
    throw new Error(`Error fetching broadcaster ID for ${TWITCH_CHANNEL_LOGIN}`);
  }
  broadcasterId = data.data[0].id;
  return broadcasterId;
}

// fetch a random clip from Twitch
async function getRandomClip() {
  const token = await getTwitchAccessToken();
  const broadcasterId = await getBroadcasterId();
  // gathered this example from the internets, change value of "first" for more... so, do many
  const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=50`;
  const response = await fetch(url, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok || !data.data || data.data.length === 0) {
    throw new Error("No clips found.");
  }
  // select a random clip from the list
  const randomIndex = Math.floor(Math.random() * data.data.length);
  return data.data[randomIndex];
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  // if (!interaction.isChatInputCommand()) return;
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
        .setDescription("FPS Legend mAc Chaos plays DOOM 2016 live on Twitch over 11 gameplay sessions and here we highlight the best moment of his legendary experience raising Hell itself as he blasts through every Cacodemon in sight.")
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

setInterval(async () => {
  // console.log("Checking if mAc is live..."); // confirmed this is working
  await announceLiveStream(client);
}, 60000);

client.login(DISCORD_TOKEN);
