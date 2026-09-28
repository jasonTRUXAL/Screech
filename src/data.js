// all the persistent stuff screech remembers, living in data/ (gitignored)
const { createStore } = require('./store');
const { GAME_NAMES } = require('./config');

// users who get pinged when the stream goes live
const streamOptIns = createStore('optinData.json', { optInUsers: [] });

// users who want to be rallied for each game
// backfill any game that was added to config after the file was created
const gameOptIns = createStore('gameData.json', { games: {} }, data => {
  data.games = data.games || {};
  for (const game of GAME_NAMES) {
    if (!Array.isArray(data.games[game])) data.games[game] = [];
  }
  return data;
});

// per-user rally tallies
const rallyStats = createStore('rallyStats.json', {});

// how many times we've nagged for a stream since the last one
const nagData = createStore('gifData.json', {
  trackedGIFs: [{ filename: 'strim.gif', game: 'DLOOLM', count: 0 }],
  lastStreamDate: null,
});

// which stream we already announced, so restarts and api blips don't re-ping everyone
const liveState = createStore('liveState.json', { lastAnnouncedStreamId: null });

module.exports = { streamOptIns, gameOptIns, rallyStats, nagData, liveState };
