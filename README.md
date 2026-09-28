# Screech
 Discord bot that is multifunctional in that it pulls Twitch clips to display on Discord, last stream time to keep count of particular GIFs on Discord before reset if last stream newer than recorded last stream, and streamer goes live announcement on Discord. Discord specific functionality includes game preferences via dropdown choice, live updating of options, capabilities to request those who opt into choices to play, capabilities for those request to opt to join, opt to not, or opt to not get notified further. All actions have tallies kept as records stored as JSON files. You can try to use it, but it'll probably break, good luck.

## Setup

1. `npm install` (Node 18+)
2. Copy `.env.example` to `.env` and fill it in. Prefer `TWITCH_BROADCASTER_ID` over `TWITCH_CHANNEL_LOGIN` so a channel rename can't break the bot (the bot logs the id on startup if you only set the login).
3. `npm run deploy` to register slash commands (`/rally` and `/testannounce` go to `GUILD_ID` only).
4. `npm start`

## Layout

- `index.js` – starts the bot and routes every command, button and select menu, with error handling in one place
- `src/commands/` – one file per slash command (plus its buttons/menus)
- `src/announce.js` – go-live announcements
- `src/nags.js` – `strim.gif` nag counting
- `src/twitch.js` – Twitch API client
- `src/config.js` – env vars, emojis, colors, the game list, timings
- `data/` – the bot's JSON data (not committed). Old root-level JSON files are copied in automatically on first start.
