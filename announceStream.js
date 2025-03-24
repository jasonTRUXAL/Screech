require('dotenv').config();
const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');
const { getAccessToken, getBroadcasterId } = require('./twitchManager');

// "get streams" doc suggestion
async function getLiveStreamInfo() {
  try {
    const token = await getAccessToken();
    const broadcasterId = await getBroadcasterId(process.env.TWITCH_CHANNEL_LOGIN);
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
async function announceLiveStream(client, token) {
  const liveStream = await getLiveStreamInfo(token);
  // if this is somehow called and is not live, note it in console to see why
  if (!liveStream) {
    // console.log("Streamer is not live"); // no longer needed
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
    .setDescription(`**${streamTitle}**\n> ${gameName}`)
    .setThumbnail("https://static-cdn.jtvnw.net/jtv_user_pictures/macstreamos-profile_image-e05c6b505301c2de-70x70.png")
    .setColor(0x9146FF)
    .setTimestamp();
	
  if (liveStream.thumbnail_url) {
    const thumbnailUrl = liveStream.thumbnail_url
      .replace('{width}', '1280')
      .replace('{height}', '720');
    embed.setImage(thumbnailUrl);
  }

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
