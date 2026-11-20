import { SlashCommandBuilder } from 'discord.js';
import { card, ACCENT } from '../lib/theme.js';
import { paginate } from '../lib/components.js';
import { CROPS } from '../data/tables.js';

const PAGES = [
  {
    label: 'start here',
    title: 'start here',
    body:
      '`/start port:<city>` — open the dock and pick the real water you fish\n\n' +
      '1. `/log` — three jobs for today; finish all three for a bonus\n' +
      '2. `/daily` and `/work` — steady shells while you find your feet\n' +
      '3. `/fish`, `/garden`, `/catch` — fill the hold\n' +
      '4. `/sell` or `/contracts` — turn the hold into shells\n' +
      '5. `/shop` — permanent kit: rod, net, vault, charm\n\n' +
      '`/dock` always names the next thing worth doing. `/profile` shows your rank; every five levels adds contract pay.'
  },
  {
    label: 'dock',
    title: 'the dock',
    body:
      '`/start` — open a dock and pick a real port\n' +
      '`/dock` — one card: port, sky, garden, log, net worth\n' +
      '`/profile` — public card: rank, level, streak, collection\n' +
      '`/balance` — wallet, bank, portfolio\n' +
      '`/daily` — streak-based payout, resets after two missed days\n' +
      '`/work` — 30 minute shift, pays more in bad weather and after dark\n' +
      '`/log` — three daily jobs, paid per job and all three\n' +
      '`/pay` — send shells to another dock\n' +
      '`/bank` — deposit or withdraw; the vault caps it\n' +
      '`/contracts` — three daily delivery jobs from the harbour board\n' +
      '`/achievements` — what you have unlocked and what is left'
  },
  {
    label: 'exchange',
    title: 'the exchange',
    body:
      '`/market` — five live instruments, refresh button\n' +
      '`/trade` — buy or sell at the quoted price, 0.5% fee\n' +
      '`/holdings` — cost basis and unrealised profit\n' +
      '`/sell` — sell fish and crops; `all` clears the whole hold\n\n' +
      'prices come from public crypto and currency feeds. no API keys, no accounts.'
  },
  {
    label: 'water',
    title: 'the water',
    body:
      '`/fish` — swell, tide, water temperature and the barometer change what bites\n' +
      '`/tide` — real high and low water, sea temperature, and how the tide changes the bite\n' +
      '`/almanac` — six-day outlook, moon, tide, glass and the best crop to plant\n' +
      '`/garden plant` — crops, real weather at your port\n' +
      '`/garden harvest` — weather and season multiply the yield\n' +
      '`/garden view` — what is growing and the current sky\n' +
      '`/catch` — a random pokedex entry, duplicates pay a bounty\n\n' +
      'the season follows the real calendar, the tide follows the real moon, and night water fishes differently. cold water belongs to cod and herring, warm water to bonito and mahi-mahi, and a falling glass feeds the fish.\n\n' +
      `crops: ${Object.values(CROPS)
        .map((c) => `${c.name} (${Math.round(c.growMs / 60000)}m)`)
        .join(', ')}`
  },
  {
    label: 'games',
    title: 'games',
    body:
      '`/trivia` — four buttons, 15 seconds, streak bonus\n' +
      '`/slots` — three reels. jackpot 20×, triple 8×, pair 1.6×\n\n' +
      'everything is house-favoured, nothing is rigged beyond that.'
  },
  {
    label: 'kit',
    title: 'the chandlery',
    body:
      '`/shop` — rod, net, vault, charm and what each level does\n' +
      '`/shop item:<name>` — buy the next level\n' +
      '`/inventory` — kit, hold and collection\n' +
      '`/leaderboard` — worth, level, streak, collection or log (this server)\n\n' +
      'upgrades are permanent and apply to every future roll.'
  },
  {
    label: 'meta',
    title: 'house rules',
    body:
      '`/settings` — market ticker channel (manage server only)\n' +
      '`/help` — this board\n\n' +
      'no prefix commands. no message content is read. saves live in one atomic json file, with rotating snapshots in data/backups.\n\n' +
      'the market, the weather and the pokedex are all public APIs with no key. if one is down the bot keeps running on the last good value or a local fallback.'
  }
];

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('the command board'),

  ephemeral: true,

  async run({ interaction, client }) {
    const pages = PAGES.map((page) => ({
      label: page.label,
      embed: () =>
        card({
          title: page.title,
          description: page.body,
          color: ACCENT,
          footer: `${client.commands.size} commands · Tidewater`
        })
    }));

    await paginate(interaction, pages, { build: (i) => pages[i].embed() });
  }
};
