// /rally: ping everyone who opted into a game, collect ✅ ❌ 🚫 votes for 5 minutes,
// then post a summary. ✅ opts you in to that game, 🚫 opts you out.
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const {
  GAMES, GAME_NAMES, COLORS, RALLY_DURATION_MS, RALLY_UPDATE_INTERVAL_MS, RALLY_COOLDOWN_MS,
} = require('../config');
const { gameOptIns, rallyStats } = require('../data');

const YES = '✅';
const NO = '❌';
const STOP = '🚫';
const TIME_FIELD = 'TIME REMAINING:';
const MAX_SUMMARY_LINES = 40; // keeps the summary embed well under discord's size limit

// the prefixes are unchanged from before so buttons on old summary messages still work
const CONFIRM_PREFIX = 'rally_confirm_';
const CANCEL_PREFIX = 'rally_cancel_';
const REMOVE_PREFIX = 'remove_opt_in_';

// game -> when its last rally started
const lastRallyAt = new Map();

function cooldownLeft(game) {
  const last = lastRallyAt.get(game) || 0;
  return Math.max(0, last + RALLY_COOLDOWN_MS - Date.now());
}

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function rallyEmbed(game, timeLeftMs) {
  return new EmbedBuilder()
    .setTitle('I SCREECH AT YOU ALL!!!!')
    .setDescription(`THE TIME HAS COME! THE RALLY IS HERE!\n\`\`\`IT IS TIME FOR ${game.toUpperCase()}\`\`\`\n**TELL THEM WHAT YOU THINK!!!**`)
    .setColor(COLORS.rally)
    .setTimestamp()
    .addFields(
      { name: YES, value: 'I AM IN!!', inline: true },
      { name: NO, value: 'NOTHX!!', inline: true },
      { name: STOP, value: 'NO SCREECH!!', inline: true },
      { name: TIME_FIELD, value: `${formatTime(timeLeftMs)} TO RALLY TOGETHER!!!`, inline: false },
    );
}

async function fetchUsernames(client, userIds) {
  const results = await Promise.allSettled(userIds.map(id => client.users.fetch(id)));
  const names = {};
  results.forEach((result, i) => {
    names[userIds[i]] = result.status === 'fulfilled' ? result.value.username : `User ${userIds[i]}`;
  });
  return names;
}

// everything that happens after the rally timer runs out
async function finishRally(interaction, game, votes) {
  const initiatorId = interaction.user.id;
  const votersFor = emoji => [...votes].filter(([, vote]) => vote === emoji).map(([id]) => id);
  const stopVoters = votersFor(STOP);
  const interested = votersFor(YES);

  // update opt-ins from a fresh read, so /games changes made during the rally aren't lost
  gameOptIns.update(data => {
    data.games[game] = data.games[game].filter(id => !stopVoters.includes(id));
    for (const id of interested) {
      if (!data.games[game].includes(id)) data.games[game].push(id);
    }
  });

  // the initiator counts as joined unless they voted against their own rally
  if (!votes.has(initiatorId)) interested.push(initiatorId);

  const stats = rallyStats.update(data => {
    const statsFor = id => (data[id] = data[id] || { initiated: 0, totalJoined: 0, joined: {} });
    statsFor(initiatorId).initiated++;
    for (const id of interested) {
      const userStats = statsFor(id);
      userStats.joined[game] = (userStats.joined[game] || 0) + 1;
      userStats.totalJoined++;
    }
  });

  // one embed with a line per person, since discord only allows 10 embeds per message
  const shown = interested.slice(0, MAX_SUMMARY_LINES);
  const names = await fetchUsernames(interaction.client, shown);
  const lines = shown.map(id => {
    const s = stats[id];
    return `**${names[id]}** — ${game}: \`${s.joined[game] || 0}\` · Total: \`${s.totalJoined}\` · Started: \`${s.initiated}\``;
  });
  if (interested.length > shown.length) {
    lines.push(`...AND ${interested.length - shown.length} MORE!!`);
  }

  const summaryEmbed = new EmbedBuilder()
    .setTitle(`${GAMES[game].emoji} ${game.toUpperCase()} RALLY RESULTS`)
    .setDescription(lines.join('\n') || 'NOBODY. NOT EVEN ONE.')
    .setColor(COLORS.rally)
    .setTimestamp();
  const removeButton = new ButtonBuilder()
    .setCustomId(`${REMOVE_PREFIX}${game}`)
    .setLabel('DON\'T @ ME ANYMORE!')
    .setStyle(ButtonStyle.Danger);

  await interaction.channel.send({
    content: `RALLY COMPLETE!!! ${interested.length} CACOPOGS INTERESTED!!`,
    embeds: [summaryEmbed],
    components: [new ActionRowBuilder().addComponents(removeButton)],
  });
  console.log(`[RALLY] ${game} rally finished with ${interested.length} interested`);
}

async function startRally(interaction, game) {
  const optedIn = gameOptIns.read().games[game];
  const rallyEndTime = Date.now() + RALLY_DURATION_MS;

  const rallyMsg = await interaction.channel.send({
    content: optedIn.length > 0 ? optedIn.map(id => `<@${id}>`).join(' ') : 'NO ONE JOINED, I AM SORRY!',
    embeds: [rallyEmbed(game, RALLY_DURATION_MS)],
    allowedMentions: { users: optedIn },
  });
  try {
    for (const emoji of [YES, NO, STOP]) {
      await rallyMsg.react(emoji);
    }
  } catch (err) {
    // people can still add the reactions themselves
    console.error('[RALLY] error adding reactions:', err);
  }

  // user id -> their current vote; picking a new reaction replaces the old one
  const votes = new Map();
  const collector = rallyMsg.createReactionCollector({
    filter: (reaction, user) => [YES, NO, STOP].includes(reaction.emoji.name) && !user.bot,
    time: RALLY_DURATION_MS,
    dispose: true, // also tell us when reactions are removed
  });

  collector.on('collect', async (reaction, user) => {
    const previous = votes.get(user.id);
    votes.set(user.id, reaction.emoji.name);
    if (previous && previous !== reaction.emoji.name) {
      try {
        await rallyMsg.reactions.cache.get(previous)?.users.remove(user.id);
      } catch (err) {
        console.error(`[RALLY] could not remove old reaction for ${user.tag}:`, err);
      }
    }
  });

  collector.on('remove', (reaction, user) => {
    // only forget the vote if they took back the one that counts
    // (this also fires when we remove their old reaction above)
    if (votes.get(user.id) === reaction.emoji.name) votes.delete(user.id);
  });

  // live countdown on the rally message
  const timer = setInterval(async () => {
    const timeLeft = rallyEndTime - Date.now();
    if (timeLeft <= 0) return;
    try {
      await rallyMsg.edit({ embeds: [rallyEmbed(game, timeLeft)] });
    } catch (err) {
      console.error('[RALLY] error updating countdown:', err);
    }
  }, RALLY_UPDATE_INTERVAL_MS);

  collector.on('end', async () => {
    clearInterval(timer);
    try {
      await rallyMsg.edit({ embeds: [rallyEmbed(game, 0).spliceFields(3, 1, { name: TIME_FIELD, value: 'RALLY OVER!!!' })] });
      await finishRally(interaction, game, votes);
    } catch (err) {
      console.error('[RALLY] error finishing rally:', err);
    }
  });
}

module.exports = {
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('rally')
    .setDescription('RALLY THE SQUAD FOR GAMES!')
    .addStringOption(option => option
      .setName('game')
      .setDescription('Which game?')
      .setRequired(true)
      .addChoices(...GAME_NAMES.map(game => ({ name: game, value: game })))),

  async execute(interaction) {
    const game = interaction.options.getString('game');
    if (!GAMES[game]) {
      await interaction.reply({ content: `Pick one of: ${GAME_NAMES.join(', ')}`, flags: MessageFlags.Ephemeral });
      return;
    }
    const wait = cooldownLeft(game);
    if (wait > 0) {
      await interaction.reply({ content: `A ${game} RALLY JUST HAPPENED! TRY AGAIN IN ${formatTime(wait)}!`, flags: MessageFlags.Ephemeral });
      return;
    }

    const confirmEmbed = new EmbedBuilder()
      .setTitle(`Confirm Rally for ${game}`)
      .setDescription(`Are you sure you want to initiate a rally for **${game}**?`)
      .setColor(COLORS.twitch)
      .setTimestamp();
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${CONFIRM_PREFIX}${game}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${CANCEL_PREFIX}${game}`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({ embeds: [confirmEmbed], components: [buttons], flags: MessageFlags.Ephemeral });
  },

  components: {
    [CANCEL_PREFIX]: async (interaction, game) => {
      await interaction.update({ content: `Rally cancelled for ${game}.`, embeds: [], components: [] });
    },

    [CONFIRM_PREFIX]: async (interaction, game) => {
      if (!GAMES[game]) {
        await interaction.update({ content: 'That game isn\'t supported anymore.', embeds: [], components: [] });
        return;
      }
      // check again, someone else may have rallied while this prompt sat open
      const wait = cooldownLeft(game);
      if (wait > 0) {
        await interaction.update({ content: `Someone beat you to it! Try again in ${formatTime(wait)}.`, embeds: [], components: [] });
        return;
      }
      lastRallyAt.set(game, Date.now());
      await interaction.update({ content: `Rally confirmed for ${game}.`, embeds: [], components: [] });
      console.log(`[RALLY] ${game} rally started by ${interaction.user.tag}`);
      await startRally(interaction, game);
    },

    [REMOVE_PREFIX]: async (interaction, game) => {
      const userId = interaction.user.id;
      let wasOptedIn = false;
      gameOptIns.update(data => {
        if (!data.games[game]) return;
        wasOptedIn = data.games[game].includes(userId);
        data.games[game] = data.games[game].filter(id => id !== userId);
      });
      await interaction.reply({
        content: wasOptedIn
          ? `You have been removed from the opt-in list for ${game}.`
          : `You are not currently opted in for ${game}.`,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
};
