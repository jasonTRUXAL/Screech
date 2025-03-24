// okay everything is borking so making a module for caching 
// and refreshing the twitch token and broadcaster id for everything
require('dotenv').config();
const fetch = require('node-fetch');

let twitchAccessToken = null;
let twitchAccessTokenExpiry = 0; // in ms

// returns a valid twitch access token, refreshing if needed
async function getAccessToken() {
  if (twitchAccessToken && Date.now() < twitchAccessTokenExpiry) {
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
  twitchAccessTokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
  console.log(`new token expires at ${new Date(twitchAccessTokenExpiry).toLocaleString()}`);
  return twitchAccessToken;
}

// returns the broadcaster id for the given channel login; if token is provided, use that token
async function getBroadcasterId(channelLogin, token) {
  token = token || await getAccessToken();
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
