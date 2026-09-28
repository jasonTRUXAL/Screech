// go-live announcements
// we remember the twitch stream id we last announced (on disk), so:
//  - a twitch api hiccup is just a skipped check, not "offline" -> re-announce
//  - a quick stream reconnect keeps the same stream id -> no second ping
//  - restarting the bot mid-stream doesn't ping everyone again
const { EmbedBuilder } = require('discord.js');
const { env, CACOPOG, COLORS, LIVE_CHECK_INTERVAL_MS } = require('./config');
const { streamOptIns, liveState } = require('./data');
const twitch = require('./twitch');
const nags = require('./nags');

function buildAnnouncementEmbed(stream, broadcaster) {
  const embed = new EmbedBuilder()
    .setTitle(`${CACOPOG} MAC CHAOS IS STREAMING ${CACOPOG}`)
    .setURL(`https://twitch.tv/${broadcaster.login}`)
    .setDescription(`**${stream.title || 'Streaming!'}**${stream.game_name ? `\n> ${stream.game_name}` : ''}`)
    .setColor(COLORS.twitch)
    .setTimestamp();
  if (broadcaster.profile_image_url) {
    embed.setThumbnail(broadcaster.profile_image_url);
  }
  if (stream.thumbnail_url) {
    // cache-bust so discord doesn't show an old preview
    const image = stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720');
    embed.setImage(`${image}?t=${Date.now()}`);
  }
  return embed;
}

async function checkLive(client) {
  const stream = await twitch.getLiveStream();
  if (!stream) return;

  const { lastAnnouncedStreamId } = liveState.read();
  if (stream.id === lastAnnouncedStreamId) return;

  // a new stream happened, so the nag count starts over
  nags.recordStream(stream.started_at);

  const channel = await client.channels.fetch(env.ANNOUNCEMENT_CHANNEL_ID);
  const broadcaster = await twitch.getBroadcaster();
  const userIds = streamOptIns.read().optInUsers;

  await channel.send({
    content: userIds.map(id => `<@${id}>`).join(' '),
    embeds: [buildAnnouncementEmbed(stream, broadcaster)],
    allowedMentions: { users: userIds },
  });

  // only remember it once the message actually went out, so a failed send gets retried
  liveState.write({ lastAnnouncedStreamId: stream.id });
  console.log(`[LIVE] announced stream ${stream.id}`);
}

function startLiveMonitor(client) {
  if (!env.ANNOUNCEMENT_CHANNEL_ID) {
    console.error('[LIVE] ANNOUNCEMENT_CHANNEL_ID is not set, live announcements are off.');
    return;
  }

  let checking = false;
  const tick = async () => {
    if (checking) return; // previous check is still going, don't stack them up
    checking = true;
    try {
      await checkLive(client);
    } catch (err) {
      console.error('[LIVE] check failed, will try again next time:', err);
    } finally {
      checking = false;
    }
  };

  tick();
  setInterval(tick, LIVE_CHECK_INTERVAL_MS);
}

module.exports = { buildAnnouncementEmbed, startLiveMonitor };
