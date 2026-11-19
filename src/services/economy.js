import { drain } from '../data/achievements.js';
import { capFor } from '../data/items.js';
import { GOODS } from '../data/goods.js';

export const START_WALLET = 250;
export const START_XP = 0;

export const levelFor = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 40));
export const xpForLevel = (level) => 40 * Math.max(0, level - 1) ** 2;

export function blankPlayer({ id, name }) {
  return {
    id,
    name,
    port: null,
    wallet: START_WALLET,
    bank: 0,
    bankCap: capFor(1),
    xp: START_XP,
    streak: 0,
    lastDaily: 0,
    lastWork: 0,
    holdings: {},
    garden: null,
    goods: {},
    catches: {},
    guilds: {},
    items: { rod: 1, net: 1, vault: 1, charm: 0 },
    stats: {
      work: 0,
      fish: 0,
      harvest: 0,
      trades: 0,
      triviaRight: 0,
      triviaWrong: 0,
      caught: 0,
      gambled: 0,
      won: 0,
      spins: 0,
      jackpots: 0,
      contracts: 0,
      tides: 0,
      glassFalls: 0
    },
    achievements: [],
    createdAt: Date.now()
  };
}

export function credit(player, amount) {
  player.wallet = Math.max(0, Math.round(player.wallet + Number(amount || 0)));
  return player.wallet;
}

export function debit(player, amount) {
  const cost = Math.round(Number(amount) || 0);
  if (cost <= 0) return true;
  if (player.wallet < cost) return false;
  player.wallet -= cost;
  return true;
}

export function holding(player, key) {
  const entry = player.holdings[key];
  if (!entry) return { qty: 0, cost: 0 };
  return entry;
}

export function netWorth(player, prices = {}) {
  let total = player.wallet + player.bank;
  for (const [key, entry] of Object.entries(player.holdings ?? {})) {
    const price = prices[key];
    if (price) total += entry.qty * price;
  }
  for (const [key, qty] of Object.entries(player.goods ?? {})) {
    total += qty * (GOODS[key]?.base ?? 0);
  }
  return Math.round(total);
}

export function addXp(player, amount) {
  const before = levelFor(player.xp);
  player.xp += Math.max(0, Math.round(Number(amount) || 0));
  return levelFor(player.xp) - before;
}

export function createEconomy({ store }) {
  const KEY = 'players';
  const queues = new Map();

  const load = () => store.get(KEY, {});
  const save = (all) => store.set(KEY, all);

  function queue(id, fn) {
    const prev = queues.get(id) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    queues.set(id, next.catch(() => {}));
    return next;
  }

  return {
    get(id) {
      const all = load();
      return all[id] ? structuredClone(all[id]) : null;
    },

    list() {
      return Object.values(load()).map((p) => structuredClone(p));
    },

    count() {
      return Object.keys(load()).length;
    },

    async create(id, { name, port }) {
      return queue(id, async () => {
        const all = load();
        if (all[id]) return { created: false, player: structuredClone(all[id]) };
        const player = blankPlayer({ id, name });
        player.port = port;
        all[id] = player;
        const fresh = drain(player);
        save(all);
        return { created: true, player: structuredClone(player), fresh };
      });
    },

    async touch(id, name) {
      return queue(id, async () => {
        const all = load();
        if (!all[id]) return null;
        all[id].name = name;
        save(all);
        return structuredClone(all[id]);
      });
    },

    /**
     * Record that a player has been seen in a guild, once. Used to scope the
     * leaderboard to the server it was asked from instead of the whole bot.
     * Synchronous on purpose: it runs after every command and must not queue.
     */
    markGuild(id, guildId) {
      if (!guildId) return false;
      const all = load();
      const player = all[id];
      if (!player) return false;
      if (player.guilds?.[guildId]) return false;
      player.guilds = { ...(player.guilds ?? {}), [guildId]: Date.now() };
      save(all);
      return true;
    },

    async update(id, fn) {
      return queue(id, async () => {
        const all = load();
        const player = all[id];
        if (!player) return { missing: true, result: null, fresh: [], player: null };
        const result = await fn(player);
        const fresh = drain(player);
        save(all);
        return { missing: false, result, fresh, player: structuredClone(player) };
      });
    }
  };
}
