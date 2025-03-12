require('dotenv').config();
const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');

async function getTwitchAccessToken() {
  const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
  const response = await fetch(tokenUrl, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Error fetching Twitch access token: ${data.message}`);
  }
  return data.access_token;
}

// so much setup..
async function getBroadcasterId(token) {
  const TWITCH_CHANNEL_LOGIN = process.env.TWITCH_CHANNEL_LOGIN;
  const userUrl = `https://api.twitch.tv/helix/users?login=${TWITCH_CHANNEL_LOGIN}`;
  const response = await fetch(userUrl, {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok || !data.data || data.data.length === 0) {
    throw new Error(`Error fetching broadcaster ID for ${TWITCH_CHANNEL_LOGIN}`);
  }
  return data.data[0].id;
}

// "get streams" doc suggestion
async function getLiveStreamInfo() {
  try {
    const token = await getTwitchAccessToken();
    const broadcasterId = await getBroadcasterId(token);
    const streamUrl = `https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`;
    const response = await fetch(streamUrl, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    if (!response.ok || !data.data || data.data.length === 0) {
	  // return nothing
      return null;
    }
	// return info
    return data.data[0];
  } catch (error) {
    console.error("Error fetching live stream info:", error);
    return null;
  }
}

// announcement
async function announceLiveStream(client) {
  const liveStream = await getLiveStreamInfo();
  // if this is somehow called and is not live, note it in console to see why
  if (!liveStream) {
    console.log("Streamer is not live, why did this send?");
    return;
  }

  // create data
  const streamTitle = liveStream.title || "Streaming!";
  const gameName = liveStream.game_name || ""; // want it empty if no game selected
  const streamUrl = `https://twitch.tv/${process.env.TWITCH_CHANNEL_LOGIN}`;

  // embed generation
  const embed = new EmbedBuilder()
    .setTitle("<:cacopog:1342021381742788689> MAC CHAOS IS STREAMING <:cacopog:1342021381742788689>")
    .setURL(streamUrl)
    .setDescription(`**${streamTitle}**\n${gameName}`)
    .setColor(0x9146FF)
    .setTimestamp();

  // retrieve opted-in users using the helper attached in streamos.js (aha it was needed)
  let mentions = "";
  if (client.getOptInUsers && typeof client.getOptInUsers === 'function') {
    const userIds = client.getOptInUsers();
    if (userIds && userIds.length > 0) {
      mentions = userIds.map(id => `<@${id}>`).join(' ');
    }
  }

  // retrieve the announcement channel ID from environment variables.
  const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
  if (!announcementChannelId) {
    console.error("ANNOUNCEMENT_CHANNEL_ID is not set.");
    return;
  }

  // get the announcement channel from the client's cache if fail
  const channel = client.channels.cache.get(announcementChannelId);
  if (!channel) {
    console.error("Announcement channel not found.");
    return;
  }

  // send the announcement message with the embed and pings.
  channel.send({ content: mentions, embeds: [embed] });
}

module.exports = announceLiveStream;
