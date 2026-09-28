// everything that talks to twitch goes through here
// errors are thrown, never swallowed, so callers can tell "offline" apart from "twitch is down"
const { env } = require('./config');

const BROADCASTER_CACHE_MS = 60 * 60 * 1000;

let accessToken = null;
let accessTokenExpiry = 0; // in ms
let tokenRequest = null; // shared so simultaneous callers don't each fetch a token

let broadcaster = null;
let broadcasterFetchedAt = 0;

async function fetchAccessToken() {
  console.log('[TWITCH] fetching new token');
  // send the secret in the body, not the url, so it doesn't end up in logs
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`error fetching twitch access token: ${data.message}`);
  }
  accessToken = data.access_token;
  // refresh a minute early to account for delays
  accessTokenExpiry = Date.now() + data.expires_in * 1000 - 60000;
  return accessToken;
}

async function getAccessToken() {
  if (accessToken && Date.now() < accessTokenExpiry) return accessToken;
  if (!tokenRequest) {
    tokenRequest = fetchAccessToken().finally(() => { tokenRequest = null; });
  }
  return tokenRequest;
}

// GET a helix endpoint and return its data array
// a 401 means the token got revoked early, so drop it and try once more
async function twitchGet(endpoint, params, retried = false) {
  const url = `https://api.twitch.tv/helix/${endpoint}?${new URLSearchParams(params)}`;
  const token = await getAccessToken();
  const response = await fetch(url, {
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401 && !retried) {
    accessToken = null;
    return twitchGet(endpoint, params, true);
  }
  if (!response.ok) {
    throw new Error(`twitch ${endpoint} request failed: ${response.status} ${await response.text()}`);
  }
  const body = await response.json();
  return body.data || [];
}

// the streamer's twitch user (id, login, display_name, profile_image_url)
// looked up by id when we have it, so a channel rename doesn't break anything
async function getBroadcaster() {
  if (broadcaster && Date.now() - broadcasterFetchedAt < BROADCASTER_CACHE_MS) {
    return broadcaster;
  }
  const params = env.TWITCH_BROADCASTER_ID
    ? { id: env.TWITCH_BROADCASTER_ID }
    : { login: env.TWITCH_CHANNEL_LOGIN };
  const [user] = await twitchGet('users', params);
  if (!user) {
    throw new Error(`twitch user not found for ${JSON.stringify(params)}`);
  }
  if (!env.TWITCH_BROADCASTER_ID) {
    console.log(`[TWITCH] tip: set TWITCH_BROADCASTER_ID=${user.id} in .env so renames can't break the bot`);
  }
  broadcaster = user;
  broadcasterFetchedAt = Date.now();
  return broadcaster;
}

// the current stream, or null if offline (throws if twitch can't be reached)
async function getLiveStream() {
  const { id } = await getBroadcaster();
  const [stream] = await twitchGet('streams', { user_id: id });
  return stream || null;
}

// when the most recent vod started, or null if there are no vods
async function getLatestStreamDate() {
  const { id } = await getBroadcaster();
  const [video] = await twitchGet('videos', { user_id: id, type: 'archive', first: 1 });
  return video ? video.created_at : null;
}

async function getClips(count = 50) {
  const { id } = await getBroadcaster();
  return twitchGet('clips', { broadcaster_id: id, first: count });
}

module.exports = { getBroadcaster, getLiveStream, getLatestStreamDate, getClips };
