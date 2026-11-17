import { getJson } from '../lib/http.js';
import { INSTRUMENTS, BY_KEY, TRADE_FEE } from '../data/instruments.js';
import { GOODS } from '../data/goods.js';
import { dayKey, seeded } from '../lib/util.js';

const CRYPTO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd';

const FX_URLS = [
  'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,JPY',
  'https://api.frankfurter.app/latest?from=USD&to=EUR,JPY'
];

const round2 = (n) => Math.round(n * 100) / 100;

export function priceInstrument(inst, live) {
  if (inst.source === 'crypto') {
    const raw = live?.crypto?.[inst.id];
    const usd = typeof raw === 'number' ? raw : raw?.usd;
    if (!usd) return null;
    return round2(Math.max(0.01, inst.base * (usd / inst.ref)));
  }
  const rate = live?.fx?.[inst.code];
  if (!rate) return null;
  return round2(Math.max(0.01, 100 / rate));
}

export function goodPrice(key, fxFactor = 1, date = new Date()) {
  const good = GOODS[key];
  if (!good) return 0;
  const rng = seeded(`${dayKey(date)}:${key}`);
  const drift = 0.85 + rng() * 0.3;
  return Math.max(1, Math.round(good.base * drift * fxFactor));
}

export function fee(amount) {
  return Math.max(0, Math.round(Number(amount) * TRADE_FEE));
}

export function createMarket({ store, logger, fetchJson = getJson, ttlMs = 120_000 }) {
  let cached = null;
  let inflight = null;

  async function fetchFx() {
    let lastError = null;
    for (const url of FX_URLS) {
      try {
        const data = await fetchJson(url, { ttl: ttlMs });
        return data?.rates ?? null;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new Error('fx unavailable');
  }

  async function refresh() {
    const [crypto, fx] = await Promise.allSettled([
      fetchJson(CRYPTO_URL, { ttl: ttlMs }),
      fetchFx()
    ]);

    const live = {
      crypto: crypto.status === 'fulfilled' ? crypto.value : null,
      fx: fx.status === 'fulfilled' ? fx.value : null
    };

    const rows = [];
    for (const inst of INSTRUMENTS) {
      const price = priceInstrument(inst, live);
      if (price != null) rows.push({ key: inst.key, price });
    }

    if (crypto.status === 'rejected') logger?.warn('market: crypto feed down,', crypto.reason?.message ?? 'unknown');
    if (fx.status === 'rejected') logger?.warn('market: fx feed down,', fx.reason?.message ?? 'unknown');

    return rows;
  }

  async function build(force) {
    const now = Date.now();
    if (!force && cached && now - cached.at < ttlMs) return cached;

    const last = store.get('market:last', null);
    const previous = last?.prices ?? {};

    let fresh = [];
    try {
      fresh = await refresh();
    } catch (err) {
      logger?.warn('market: refresh failed,', err.message);
    }

    const prices = {};
    for (const inst of INSTRUMENTS) {
      const hit = fresh.find((row) => row.key === inst.key);
      if (hit) prices[inst.key] = hit.price;
      else if (previous[inst.key]) prices[inst.key] = previous[inst.key];
      else prices[inst.key] = round2(inst.base);
    }

    if (fresh.length) store.set('market:last', { at: Date.now(), prices });

    const rows = INSTRUMENTS.map((inst) => {
      const price = prices[inst.key];
      const before = previous[inst.key];
      const changePct = before ? round2(((price - before) / before) * 100) : 0;
      return { ...inst, price, changePct };
    });

    cached = {
      at: Date.now(),
      prices,
      rows,
      degraded: fresh.length < INSTRUMENTS.length,
      // the euro quote doubles as a real-world drift factor for local goods
      fxFactor: round2((prices.euro ?? 100) / 100)
    };

    return cached;
  }

  return {
    board(options = {}) {
      if (inflight) return inflight;
      inflight = build(Boolean(options.force)).finally(() => {
        inflight = null;
      });
      return inflight;
    },

    async prices(force = false) {
      return (await this.board({ force })).prices;
    },

    async price(key) {
      const board = await this.board();
      return board.prices[key] ?? null;
    },

    async goods(key) {
      const board = await this.board();
      return goodPrice(key, board.fxFactor);
    },

    instrument(key) {
      return BY_KEY[key] ?? null;
    }
  };
}
