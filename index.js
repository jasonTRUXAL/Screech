// screech index, here goes...
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_CHANNEL_LOGIN = "mAcStreamos"; // single use only for now, maybe turn into array later to randomly pick

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
  // Fetch a list of clips (adjust 'first' if you want more results)
  const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=20`;
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
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'clips') {
    await interaction.deferReply(); // Acknowledge the command while processing
    try {
      const clip = await getRandomClip();

      // build an embed with the clip details
      const embed = new EmbedBuilder()
        .setTitle(clip.title || "Twitch Clip")
        .setURL(clip.url)
        .setImage(clip.thumbnail_url) // shows the clip thumbnail
        .setFooter({ text: `By ${clip.creator_name}` })
        .setTimestamp(new Date(clip.created_at));

      await interaction.editReply({
        content: `Here's a random clip from ${TWITCH_CHANNEL_LOGIN}:`,
        embeds: [embed]
      });
    } catch (error) {
      console.error("Error fetching clip:", error);
      await interaction.editReply("Sorry, I couldn't fetch a clip at this time.");
    }
  }
});

client.login(DISCORD_TOKEN);
