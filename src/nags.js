// keeps track of how much we nag mac to stream (posting strim.gif and friends)
// counts reset whenever a newer stream shows up. we check for that *before*
// counting a nag, so nags posted after a stream are never wiped out later.
const { nagData } = require('./data');
const twitch = require('./twitch');

const STREAM_SYNC_INTERVAL_MS = 5 * 60 * 1000;
let lastSyncAt = 0;

// a stream started at this time; if it's newer than what we know, start counting over
function recordStream(startedAt) {
  if (!startedAt) return;
  const { lastStreamDate } = nagData.read();
  if (lastStreamDate && new Date(startedAt) <= new Date(lastStreamDate)) return;

  nagData.update(data => {
    data.trackedGIFs.forEach(gif => { gif.count = 0; });
    data.lastStreamDate = startedAt;
  });
  console.log(`[NAGS] new stream at ${startedAt}, counts reset`);
}

// ask twitch about the latest vod, at most every few minutes
async function syncWithLatestStream() {
  if (Date.now() - lastSyncAt < STREAM_SYNC_INTERVAL_MS) return;
  lastSyncAt = Date.now();
  try {
    recordStream(await twitch.getLatestStreamDate());
  } catch (err) {
    // counting still works without it, the reset just waits for next time
    console.error('[NAGS] could not check latest stream:', err);
  }
}

function findTrackedGIFs(message) {
  const { trackedGIFs } = nagData.read();
  const attachmentNames = [...message.attachments.values()].map(a => a.name || '');
  return trackedGIFs
    .filter(gif => message.content.includes(gif.filename) || attachmentNames.includes(gif.filename))
    .map(gif => gif.filename);
}

async function handleMessage(message) {
  if (message.author.bot) return;
  const seen = findTrackedGIFs(message);
  if (seen.length === 0) return;

  await syncWithLatestStream();
  nagData.update(data => {
    for (const gif of data.trackedGIFs) {
      if (seen.includes(gif.filename)) {
        gif.count++;
        console.log(`[NAGS] saw ${gif.filename} again, ${gif.count} times total`);
      }
    }
  });
}

async function getCounts() {
  await syncWithLatestStream();
  return nagData.read().trackedGIFs;
}

module.exports = { recordStream, handleMessage, getCounts };
