// okay everything is borking so making a module for caching 
// and refreshing the twitch token and broadcaster id for everything
require('dotenv').config();
const fetch = require('node-fetch');

let twitchAccessToken = null;
let twitchAccessTokenExpiry = 0; // in ms

// return a valid twitch access token, refresh if needed
async function getAccessToken() {
  if (twitchAccessToken && Date.now() < twitchAccessTokenExpiry) {
    console.log('using cached twitch token');
    return twitchAccessToken;
  }
  console.log('fetching new twitch token');
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
  const response = await fetch(tokenUrl, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`error fetching twitch access token: ${data.message}`);
  }
  twitchAccessToken = data.access_token;
  // set expiry a minute before actual expiry to account for delays
  // (this has been a problem before... hopefully solution)
  twitchAccessTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
  console.log(`new token expires at ${new Date(twitchAccessTokenExpiry).toLocaleString()}`);
  return twitchAccessToken;
}

// return the broadcaster id for the given channel login
async function getBroadcasterId(channelLogin) {
  const token = await getAccessToken();
  const url = `https://api.twitch.tv/helix/users?login=${channelLogin}`;
  const response = await fetch(url, {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok || !data.data || data.data.length === 0) {
    throw new Error(`error fetching broadcaster id for ${channelLogin}`);
  }
  return data.data[0].id;
}

module.exports = { getAccessToken, getBroadcasterId };