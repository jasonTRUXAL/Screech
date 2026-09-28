// one place for env vars and the stuff that used to be copy pasted everywhere
require('dotenv').config();

const env = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID, // discord application id
  GUILD_ID: process.env.GUILD_ID, // optional, for guild-only (testing) commands
  ANNOUNCEMENT_CHANNEL_ID: process.env.ANNOUNCEMENT_CHANNEL_ID,
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
  // the id never changes, so prefer it; the login is only a fallback (and breaks on renames)
  TWITCH_BROADCASTER_ID: process.env.TWITCH_BROADCASTER_ID,
  TWITCH_CHANNEL_LOGIN: process.env.TWITCH_CHANNEL_LOGIN,
};

const CACOPOG = '<:cacopog:1342021381742788689>';

const COLORS = {
  twitch: 0x9146ff,
  rally: 0xff0000,
  doom: 0x9b0000,
};

// every game lives here and only here. add a game = add an entry.
// the key is what gets stored in gameData.json, so don't rename existing ones.
const GAMES = {
  'Among Us': { emoji: '<:amongus:1351763461973213314>' },
  'BlazBlue': { emoji: '<:blazblue:1351763469652983879>' },
  'Hustle': { emoji: '<:hustle:1351763476502151270>' },
  'Doom': { emoji: CACOPOG },
};

const GAME_NAMES = Object.keys(GAMES);

// timing
const LIVE_CHECK_INTERVAL_MS = 60 * 1000;
const RALLY_DURATION_MS = 5 * 60 * 1000;
const RALLY_UPDATE_INTERVAL_MS = 10 * 1000;
const RALLY_COOLDOWN_MS = 10 * 60 * 1000; // per game, so nobody can ping everyone on repeat

module.exports = {
  env,
  CACOPOG,
  COLORS,
  GAMES,
  GAME_NAMES,
  LIVE_CHECK_INTERVAL_MS,
  RALLY_DURATION_MS,
  RALLY_UPDATE_INTERVAL_MS,
  RALLY_COOLDOWN_MS,
};
