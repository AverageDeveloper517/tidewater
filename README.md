# Tidewater

**A Discord economy bot where the numbers come from the real world.**

Live crypto and currency prices drive the exchange. The actual weather in a city you pick decides
your harvest. The real tide height offshore decides when the fish feed, and the real swell decides
what bites. Even the moon is real: spring and neap tides are calculated from the synodic cycle, not
rolled on a timer. Every data source is public and keyless - no API key, no paid tier, no signup.

No privileged intents · no database · 26 slash commands · Node 18.17+

[![Node](https://img.shields.io/badge/node-%E2%89%A518.17-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![API keys](https://img.shields.io/badge/API%20keys-none%20required-2ec4b6)](#live-data)
[![License](https://img.shields.io/badge/license-MIT-e9c46a)](LICENSE)

Built with **discord.js v14** on Node ESM, with an in-process cache and graceful fallbacks for every
feed. A complete Discord economy bot you can self-host in about five minutes.

---

## Contents

- [What it looks like](#what-it-looks-like)
- [Why it is not another daily/work/beg bot](#why-it-is-not-another-dailyworkbeg-bot)
- [Quick start](#quick-start)
- [Bot setup: scopes, intents, permissions](#bot-setup-scopes-intents-permissions)
- [The loop](#the-loop)
- [Commands](#commands)
- [Tides, moon and light](#tides-moon-and-light)
- [Harbour contracts](#harbour-contracts)
- [Live data](#live-data)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Ops](#ops)
- [Custom emoji](#custom-emoji)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Adding a command](#adding-a-command)
- [Roadmap](#roadmap)
- [License](#license)

---

## What it looks like

Real output, not mockups. The board refreshes against live prices; the harvest line reflects the
weather at the port the player chose.

```
◆ the exchange
≋ Tide — 3,012.29      ▲ +0.41%
❖ Reef — 85.43         ▼ -1.12%
✦ Glow — 3.39          ▲ +2.08%
◎ Euro note — 110.14   ▬ 0.00%
◇ Yen note — 0.63      ▼ -0.14%

2 instruments moved in the last two minutes · 0.5% fee each way
```

```
❀ harvest
pulled 6 Kelp from 4 base units.
☂ rain → ×1.40
✧ spring → ×1.05

in the hold: 6      rough value: ◈ 182      sell it: /sell
```

```
≋ tide · Lisbon
▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅
now 0.13 m · falling 0.28 m/h
ebbing tide - they follow the drop out

next high    ▲ high · 23:41
             2.84 m · in 3 hours
next low     ▼ low · 06:02
             0.31 m · in 9 hours
range (24h)  2.71 m · spring tide
water        18.2°C      swell 2.2 m · 11.6s
fishing      ×1.16 rare weight
moon         ● full moon · 100% lit · the moon is pulling hard
```

```
▤ the harbour board
three jobs, one hold, one day.

1. The Cannery · a morning run
the line starts at six and the crates are not there.
Kelp ×6 · Mackerel ×3
pays ◈ 742 · +18 xp · /contracts take slot:1

2. Lighthouse Trust · supplies for the rock
the relief boat leaves with or without the list.
Brine ×5
pays ◈ 121 · +15 xp · /contracts take slot:2

resets in 6 hours · same board for everyone in this server
```


## Why it is not another daily/work/beg bot

| most economy bots | Tidewater |
|---|---|
| fixed shop prices | five instruments priced from real markets, fee on both sides |
| random weather flavour text | Open-Meteo decides your crop yield, in a city you choose |
| `!fish` returns a random string | swell, tide height and daylight all change the loot table |
| a daily quest on a timer | contracts priced off the live local goods board, reset at UTC midnight |
| one global high-score | leaderboards scoped to the server they are asked from |
| generic collectibles | PokeAPI, 1025 entries, duplicates pay a bounty |
| trivia hardcoded once | OpenTDB questions, with a local bank when it is down |
| needs a database | one JSON file, atomic writes |

Every one of those external calls has a fallback. If a feed dies the bot keeps running on the last
good quote or a local table, and it says so in the footer instead of pretending.

---

## Quick start

```bash
npm install
cp .env.example .env     # Windows cmd: copy .env.example .env
npm run deploy           # register slash commands
npm start
```

Written for Node 18.17+ (built and tested on Node 24, `.nvmrc` pins 22).

If you have not created the Discord application yet, do
[Bot setup](#bot-setup-scopes-intents-permissions) first.

---

## Bot setup: scopes, intents, permissions

### 1. Create the application

1. [Developer Portal](https://discord.com/developers/applications) → **New Application** → name it
2. **Bot** → **Add Bot** → **Reset Token** → paste into `DISCORD_TOKEN`
3. **General Information** → copy **Application ID** for the invite URL

### 2. Intents

**None.** This bot only needs the `Guilds` intent, which is not privileged and is enabled in code.
You do not have to flip a single switch in the portal, and you never need Message Content.

That also means it works in servers where Message Content is denied to bots.

### 3. Scopes

Required: `bot` + `applications.commands`.

Without `applications.commands` the bot joins but every slash command stays invisible.

### 4. Permissions

The minimum functional set:

| permission | why |
|---|---|
| View Channels | see the channel |
| Send Messages | replies |
| Embed Links | every response is an embed |
| Read Message History | fetch the reply to attach buttons to it |
| Use External Emojis | custom application emojis in embeds |

Invite URL - replace `YOUR_CLIENT_ID`:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=347136&scope=bot%20applications.commands
```

`347136` is exactly those five. Administrator (`permissions=8`) also works if you would rather not
think about it, but it is not required and nothing here needs it.

No role-position rules apply: the bot never creates, edits, deletes, or assigns a role.

---

## The loop

```
/start → pick a real port
   │
   ├─ /dock ─── one card: port, sky, season, tide, garden, net worth
   ├─ /daily ── streak shells
   ├─ /work ─── shift pay, +12% in rain, +35% in a storm, +15% after dark
   ├─ /contracts ─ three daily jobs → deliver goods → payout
   │
   ├─ /garden ── plant → real weather × real season → harvest → /sell
   ├─ /fish ──── swell × tide × daylight → loot table → /sell
   ├─ /catch ─── pokedex roll, duplicate → bounty
   │
   ├─ /market ── live board
   ├─ /trade ─── buy low, sell high, 0.5% each way
   └─ /holdings ─ cost basis, unrealised P/L
```

`/tide` and `/almanac` are the planning layer: next high and low water, six-day outlook, moon phase,
sunrise and sunset, and the crop with the best multiplier in the next four days.

Shells (`◈`) are the only currency. Upgrades in `/shop` are permanent:

- **Rod** - rare catch weight, five levels
- **Net** - extra units per harvest, five levels
- **Vault** - raises the bank cap from 5,000 to 200,000
- **Charm** - luck on every roll

---

## Commands

| command | what it does |
|---|---|
| `/start <port>` | create a profile, geocode a real city |
| `/dock` | one card: port, sky, season, garden, net worth, cooldowns |
| `/profile [user]` | public card: level, streak, collection, achievements |
| `/balance` | wallet, bank, portfolio value |
| `/daily` | 20h cooldown, streak bonus, resets after two missed days |
| `/work` | 30m cooldown, weather pay multiplier, +15% night shift |
| `/pay <user> <amount>` | transfer shells |
| `/bank <deposit\|withdraw> <amount>` | move shells into or out of the vault |
| `/contracts view\|take\|deliver\|abandon` | three daily delivery jobs, priced off local goods |
| `/market` | live board with a refresh button |
| `/trade <buy\|sell> <instrument> <qty>` | market order at the quoted price |
| `/holdings` | cost basis and unrealised profit per position |
| `/sell <good> <qty>` | sell fish and crops at the local price |
| `/garden plant\|harvest\|view` | crops, real weather and real season multipliers |
| `/fish` | swell, tide and daylight drive the catch table, 45s cooldown |
| `/tide` | current height, trend, next four high/low marks, bite multiplier |
| `/almanac` | six-day outlook, moon, tide, sun and the best crop to plant |
| `/catch` | random pokedex entry, bounty on duplicates, 90s cooldown |
| `/trivia` | four buttons, 15 seconds, streak bonus |
| `/slots <wager>` | 20× jackpot, 8× triple, 1.6× pair |
| `/shop [item]` | shelf or buy the next upgrade |
| `/inventory` | kit, hold, collection |
| `/achievements` | paginated list: unlocked, remaining, completion |
| `/leaderboard [metric]` | worth, level, streak or collection - this server only |
| `/help` | paginated command board |
| `/settings <channel> <bool>` | market ticker channel, manage-server only |

Economy commands are ephemeral by default; `/profile`, `/market`, `/tide` and `/leaderboard` are public.

---

## Tides, moon and light

`/tide` is not flavour text. Open-Meteo Marine returns an hourly `sea_level_height_msl` series for
the port's coordinates; the bot parses it into a curve, finds the turning points, and puts a real
tide under the fishing table.

| reading | where it comes from | what it changes |
|---|---|---|
| current height | interpolated between the two nearest marine hours | shown in `/tide`, `/dock` |
| trend and rate | slope of that segment, in m/h | rising water raises the rare weight |
| range (24h) | max minus min over the next day | spring vs neap classification |
| next marks | local maxima/minima, refined with a parabola | next four high/low times |
| sea temperature | `sea_surface_temperature` from the same call | shown on the tide card |
| swell | `wave_height`, `wave_period` | the existing fish loot mood |

The bite multiplier is bounded to `0.85 – 1.45`. A rising tide over a big range is the best water;
slack water is the worst. A degraded tide feed never nerfs a player - it returns `×1.00`.

The moon is computed, not fetched. `src/lib/moon.js` anchors on a known new moon
(2000-01-06 18:14 UTC) and uses a 29.530588853-day synodic month. That gives the phase name,
illuminated percentage, waxing/waning flag and the spring/neap factor used by `/tide`, `/almanac` and
the fallback curve.

Daylight comes from the same forecast call as the weather: `sunrise`, `sunset` and
`daylight_duration`. The bot uses it two ways:

- `/work` pays **+15%** after sunset
- `/fish` gives rare fish a **×1.12** weight at night, and a slightly better chance of a coin in the net

If the sun data is missing, a longitude-based solar clock keeps the day/night flag honest instead of
defaulting to daytime.

```
tide fallback: live sea level → 15 min cache → lunar M2 + S2 curve
sun fallback:  live daily forecast → longitude solar clock
```

Extremes are refined with a parabola through the three hourly samples around each turn, so the listed
high water is not rounded to the top of the hour. All times are stored as UTC and rendered with
Discord timestamps, which means every reader sees their own clock.

---

## Harbour contracts

Three jobs per server per UTC day, generated from a seeded hash of `date:guildId`. Everyone in the
guild sees the same board; it changes at midnight UTC. Nothing is stored per guild - the board is a
pure function, so it survives restarts and costs no extra JSON.

```
▤ the harbour board
1. The Cannery · a morning run       Kelp ×6 · Mackerel ×3      ◈ 742 · +18 xp
2. Lighthouse Trust · supplies...    Brine ×5                   ◈ 121 · +15 xp
3. The Fish Market · auction filled  Sea bass ×4 · Pearl ×1     ◈ 1,904 · +32 xp
```

- goods come from the same pool `/sell` uses; quantities scale down as the unit price goes up
- reward is the local board value with a 1.24–1.52× margin, plus a small flat fee
- `take` locks one job to you until the board resets
- `deliver` removes the goods and pays atomically, in a single per-user queue update
- `abandon` clears the job and applies a 10-minute lockout
- expired jobs clear themselves; you never lose goods for missing a window
- achievements: First Contract, Runner, Freighter, Tide Reader

Because the board is deterministic, the test suite asserts that the same guild and day produce the
same three jobs, and that a different guild or day produces a different board.

---

## Live data

All keyless, all public.

| source | endpoint | drives | cache | when it is down |
|---|---|---|---|---|
| CoinGecko | `/api/v3/simple/price` | tide, reef, glow | 2 min | last good quote, then base |
| Frankfurter | `/v1/latest?base=USD` | euro and yen notes | 2 min | last good quote, then base |
| Open-Meteo | `/v1/forecast` current | garden multiplier, work pay, day/night | 10 min | deterministic daily guess, never a fake storm |
| Open-Meteo | `/v1/forecast` daily | six-day outlook, sunrise, sunset, UV | 30 min | deterministic six-day table, no fake storm |
| Open-Meteo Marine | `/v1/marine` waves | fish loot table | 30 min | deterministic daily guess |
| Open-Meteo Marine | `/v1/marine` sea level | tide height, trend, next marks, sea temp | 15 min | lunar M2 + S2 curve |
| Open-Meteo Geocoding | `/v1/search` | `/start` port lookup | 24 h | command asks for another city |
| Open Trivia DB | `/api.php` | `/trivia` | none | 15-question local bank |
| PokeAPI | `/api/v2/pokemon/{id}` | `/catch` | 24 h | 44-entry harbour list |

The moon has no endpoint: it is arithmetic from a known new moon and a synodic month, so it works
with the network unplugged.

Price model: crypto prices track the live ratio to a fixed reference, scaled so a position is
affordable (tide ≈ 4,200, glow ≈ 9.5). Currency notes are priced at 100 shells per USD, so
`1 EUR` costs `100 / EUR-per-USD`. Local goods drift once a day from a seeded hash and the euro
quote, so the board is never fully static and never needs another API.

Rate limits on CoinGecko's free tier are real - the 2 minute cache plus the persisted last-good
snapshot keep a normal server well inside them.

### Seasons

The calendar is real too. `src/lib/season.js` reads the UTC month and returns one of four seasons,
each with its own crop multipliers:

| season | months | kelp | coral | brine |
|---|---|---|---|---|
| winter | Dec-Feb | ×1.10 | ×0.85 | ×0.90 |
| spring | Mar-May | ×1.05 | ×1.00 | ×1.10 |
| summer | Jun-Aug | ×0.90 | ×1.15 | ×1.20 |
| autumn | Sep-Nov | ×1.15 | ×0.95 | ×1.00 |

Weather and season stack. `/garden harvest` prints both multipliers, and `/dock` shows the current
season and the full crop table in its footer, so a player can plan around the real month.

### Server scoping

`/leaderboard` is scoped to the server it is called from. The first successful command a player runs
in a guild records that guild on their save, so one bot can serve several servers without every list
being a global high-score table. Saves created before guild tracking stay visible everywhere.

---

## Architecture

```
Eco bot/
├─ src/
│  ├─ index.js                 bootstrap: client, services, loaders, shutdown
│  ├─ deploy-commands.js       diff-aware slash registration
│  ├─ commands/                26 files: data + run
│  ├─ events/
│  │  ├─ ready.js              presence rotation, market ticker, heartbeat
│  │  └─ interactionCreate.js  gate → defer → run
│  ├─ services/
│  │  ├─ economy.js            players, per-user queue, levels, achievements, guild marks
│  │  ├─ market.js             live board, cache, fallbacks, goods pricing
│  │  ├─ tide.js               sea level series, extremes, trend, bite, lunar fallback
│  │  ├─ weather.js            geocode, forecast, outlook, waves, day/night, crop affinity
│  │  ├─ pokedex.js            roll, rarity, sprite
│  │  ├─ trivia.js             fetch, decode, shuffle, fallback
│  │  └─ settings.js           per-guild ticker config
│  ├─ data/
│  │  ├─ tables.js             crops, fish, slots, jobs, trivia bank
│  │  ├─ instruments.js        the five tradeable things
│  │  ├─ items.js              shop tiers and bank caps
│  │  ├─ goods.js              sellable goods derived from crops + fish
│  │  ├─ achievements.js       predicates over a player record
│  │  └─ fallback-pokemon.js   offline pokedex
│  ├─ lib/
│  │  ├─ boards.js             the market embed, shared by command and ticker
│  │  ├─ components.js         paginator
│  │  ├─ config.js             env parsing
│  │  ├─ contracts.js          deterministic daily jobs, quantities, expiry, manifests
│  │  ├─ emoji.js              curated glyphs + custom emoji resolution
│  │  ├─ flow.js               profile guard, unlock text, level math
│  │  ├─ guard.js              rate bucket, cooldowns, permission gates
│  │  ├─ http.js               one timeout, one cache, one fetch surface
│  │  ├─ loader.js             command discovery + duplicate checks
│  │  ├─ logger.js             leveled console output
│  │  ├─ moon.js               phase, illumination, spring/neap tides, next phase
│  │  ├─ season.js             real-calendar seasons and crop multipliers
│  │  ├─ store.js              atomic JSON persistence
│  │  ├─ theme.js              palette, cards, formatting
│  │  └─ util.js               seeded rng, weighted picks, dates
│  └─ tools/
│     └─ upload-emojis.js      push PNGs to application emojis
├─ test/                       nine suites, no network
├─ assets/emoji/               drop art here, `npm run emojis`
├─ data/                       store.json at runtime
├─ Dockerfile · .dockerignore · ecosystem.config.cjs · .nvmrc
├─ .env.example
└─ package.json
```

---

## Data model

One file, `data/store.json`, three keys:

```
players   { [userId]: player }
guilds    { [guildId]: { marketChannel, ticker } }
market:last  { at, prices }   // last good quote, survives restarts
```

A player record:

```js
{
  id, name,
  port: { name, region, country, lat, lon, timezone },
  wallet, bank, bankCap,
  xp, streak, lastDaily, lastWork,
  holdings: { tide: { qty, cost } },
  garden:   { crop, at } | null,
  goods:    { kelp: 3, pearl: 1 },
  catches:  { 25: { name: 'pikachu', count: 2, rarity: 'common' } },
  guilds:   { '1234567890': 1730000000000 },   // first seen, for server leaderboards
  contract: { id, slot, title, items: [{ key, qty }], reward, xp, expires, takenAt } | null,
  contractLock: 0,
  items:    { rod, net, vault, charm },
  stats:    { work, fish, harvest, trades, triviaRight, contracts, tides, ... },
  achievements: ['first_light', 'dockhand'],
  createdAt
}
```

Writes go through a per-user promise queue, so two commands landing at the same millisecond cannot
double-spend a wallet. The store writes to a temp file and renames it, so a crash mid-write cannot
truncate the save.

The contract board is deliberately not in this file. It is rebuilt from
`hash(dayKey:guildId)`, so there is one source of truth and no stale guild rows to migrate.

---

## Ops

```bash
npm start                        # bare node
npm run dev                      # node --watch
npm run deploy                   # register or update slash commands
npm test                         # node --test, no network required
npm run emojis                   # upload custom emoji art
docker build -t tidewater . && docker run --env-file .env tidewater
pm2 start ecosystem.config.cjs   # pm2 logs tidewater
```

Environment:

| variable | required | what it is |
|---|---|---|
| `DISCORD_TOKEN` | yes | bot token |
| `GUILD_ID` | recommended | register commands in one guild instantly |
| `LOG_CHANNEL_ID` | optional | channel that receives a line per command |
| `RATE_LIMIT` | optional | commands per user per 10s, default 8 |

Operational notes:

- every command defers immediately, so no interaction ever hits the 3 second window
- per-user rate bucket (`RATE_LIMIT` / 10s) plus per-command cooldowns
- market cache is 2 minutes; `/trade` forces a refresh before filling
- tide cache is 15 minutes per rounded coordinate pair; a degraded result is cached for 2 minutes so
  recovery is quick
- contract boards roll over at 00:00 UTC; no cron job, the date is part of the seed
- the ticker posts every 6 hours to the channel set in `/settings`, and skips degraded boards
- keep `data/store.json` out of git - already in `.gitignore`

---

## Custom emoji

The bot never spams default emoji. Every concept has one glyph from `src/lib/emoji.js` - `◈` shell,
`≋` tide, `❖` reef, `✦` glow, `▤` trivia, `▣` vault - and those render everywhere with no setup.

If you want your own art:

1. drop `shell.png`, `tide.png`, ... into `assets/emoji/`
2. `npm run emojis` uploads them as **application emojis** - owned by the bot, usable in every
   server it joins
3. restart. `client.emoji('shell')` resolves to `:shell:` when it exists and falls back to `◈` when
   it does not

Names must match a key in `src/lib/emoji.js`; the upload script skips anything that does not.

---

## Testing

```bash
npm test
```

```
test/economy.test.js   level curve, credit/debit guards, net worth, per-user serialisation, achievements, guild marks
test/market.test.js    live pricing, dead feed fallback, last-good persistence, fee and daily drift
test/season.test.js    month-to-season mapping, crop multipliers, year-round variance
test/moon.test.js      known new/full moons, synodic cycle, illumination, spring/neap, next phase
test/tide.test.js      UTC parsing, extremes, interpolation, range, bite mood, lunar fallback
test/contracts.test.js determinism, guild/day separation, quantities, margin, expiry, manifests
test/commands.test.js  /tide, /almanac and /contracts through a full take → deliver → abandon cycle
test/weather.test.js   WMO buckets, crop affinity, swell buckets, outlook parsing, offline forecasts
test/trivia.test.js    entity decoding, shuffle, remote and local question paths, formatting
```

55 tests across nine suites, all offline.

Everything is injected - services accept `fetchJson`, so the suites run offline and deterministic.

There is also a live check that hits every external feed and prints what came back:

```bash
node scripts/smoke-live.js
```

```
ok   geocode - Lisbon, PT (38.72509, -9.1498)
ok   forecast - rain 19C
ok   marine - 1.72m / 7.1s
ok   market - tide 3012.29, reef 85.43, glow 3.39, euro 110.14, yen 0.63
ok   market live - all feeds up
ok   trivia - opentdb, 4 answers
ok   pokedex - tapu-koko (#785), base xp 257
```

---

## Troubleshooting

| symptom | cause | fix |
|---|---|---|
| slash commands do not appear | `applications.commands` scope missing, or deploy skipped | re-invite with the scope, run `npm run deploy` |
| "The application did not respond" | a command threw before deferring | check console - the router logs the stack |
| `/start` says no such port | geocoding returned nothing | try a larger city |
| prices never change | CoinGecko blocked or rate limited | 2 min cache is working; check `market` warnings in console |
| garden multiplier looks random | it is the live weather in **your port** | `/garden view` shows the condition and multiplier |
| harvest pays less than last month | the real-calendar season changed | `/dock` shows the current season and its crop table |
| tide line barely moves | sea level is hourly and cached for 15 minutes | `/tide` footer says whether it is live or the lunar fallback |
| contract vanished | the board resets at 00:00 UTC | expired jobs clear themselves; take a new one from `/contracts view` |
| work says night shift in daylight | the port is in another timezone or the sun feed is down | the fallback uses longitude, so high latitudes drift |
| `/catch` shows "pokedex offline" | PokeAPI unreachable | it already used the harbour fallback list |
| bank says vault is full | cap is 5,000 at vault level 1 | `/shop item:Vault` |
| ticker silent | no channel set, or board is degraded | `/settings market_channel:#channel ticker:true` |
| nothing works after moving folders | stale process | stop node, `npm start` from the new path |

---

## Adding a command

```js
import { SlashCommandBuilder } from 'discord.js';
import { card, shells, OK } from '../lib/theme.js';
import { requireProfile } from '../lib/flow.js';
import { credit } from '../services/economy.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('round trip'),

  ephemeral: true,
  cooldownMs: 1000,

  async run({ interaction, reply, economy }) {
    const player = economy.get(interaction.user.id);
    if (await requireProfile(reply, player)) return;

    const { result } = await economy.update(interaction.user.id, (p) => {
      credit(p, 1);
      return p.wallet;
    });

    await reply({ embeds: [card({ title: 'pong', description: shells(result), color: OK })] });
  }
};
```

Context handed to `run`:

| key | what it is |
|---|---|
| `client` | discord.js client, with `commands`, `store`, `settings`, `economy`, `market`, `weather`, `dex`, `trivia`, `emoji` |
| `interaction` | the raw `ChatInputCommandInteraction` |
| `options` | `interaction.options` |
| `reply` | edit the deferred reply |
| `follow` | ephemeral follow-up |
| `logger` | scoped logger |
| `store` | atomic JSON store |
| `settings` | per-guild settings |
| `config` | parsed env |
| `economy` | player records, queue, achievements |
| `market` | board, prices, goods pricing |
| `weather` | geocode, forecast, waves |
| `dex` | pokedex rolls |
| `trivia` | question rolls |

Drop the file in `src/commands/`, run `npm run deploy`, restart. The loader rejects duplicate names
at boot.

---

## Roadmap

Four things still worth building:

- solstice and equinox events layered on the existing real-calendar seasons
- a monthly reset for the server leaderboard
- ship routes between real ports, with passage time from great-circle distance and weather delays
- a shipped custom emoji art set in `assets/emoji/`

Not planned: prefix commands, message-content reading, paid API dependencies, privileged intents.

---

## License

MIT.
