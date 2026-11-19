// Harbour contracts: three small delivery jobs. Goods, clients and quantities
// are deterministic for a guild and a UTC day; the payout is marked to the local
// goods board, so it drifts slightly with the euro quote. Reset at midnight UTC.

import { GOODS } from '../data/goods.js';
import { dayKey, hash, roll, seeded } from './util.js';

export const CONTRACT_POOL = ['kelp', 'brine', 'mackerel', 'bass', 'eel', 'coral', 'pearl'];

const CLIENTS = [
  { name: 'The Cannery', want: 'a morning run' },
  { name: 'North Pier Chandlery', want: 'stock for the weekend' },
  { name: 'The Ice House', want: 'a cold delivery' },
  { name: 'Salvage & Sons', want: 'the yard sorted' },
  { name: 'The Ferry Office', want: 'provisions for the crossing' },
  { name: "Harbourmaster's Office", want: 'an inspection sample' },
  { name: 'Lighthouse Trust', want: 'supplies for the rock' },
  { name: 'The Fish Market', want: 'the auction filled' },
  { name: 'Old Rope Co.', want: 'raw stock' },
  { name: 'The Customs Shed', want: 'a sealed manifest' }
];

const BRIEFS = [
  'the line starts at six and the crates are not there.',
  'the shelf is thin and the ferry crowd is coming.',
  'the hold is warmer than it should be.',
  'a wreck came in overnight and the yard is short-handed.',
  'the morning sailing cannot leave on an empty galley.',
  'the annual count is due and the paperwork needs a number.',
  'the relief boat leaves with or without the list.',
  'the buyers are here and the ice is melting.',
  'the braiding bench has been idle since Tuesday.',
  'a container is short and the stamp is waiting.'
];

export function nextUtcMidnight(date = new Date()) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

function quantityFor(base, rng) {
  if (base < 15) return roll(rng, 4, 8);
  if (base < 60) return roll(rng, 2, 5);
  if (base < 150) return roll(rng, 2, 3);
  return roll(rng, 1, 2);
}

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * @param {object} options
 * @param {string} [options.guildId]
 * @param {Date}   [options.date]
 * @param {(key: string) => number} [options.priceOf] current local price per unit
 */
export function buildContracts({ guildId = 'global', date = new Date(), priceOf } = {}) {
  const seed = `${dayKey(date)}:${guildId}:contracts`;
  const rng = seeded(seed);
  const price = priceOf ?? ((key) => GOODS[key]?.base ?? 0);
  const pool = shuffle(CONTRACT_POOL, rng);
  const clients = shuffle(CLIENTS, rng).slice(0, 3);
  const briefs = shuffle(BRIEFS, rng).slice(0, 3);
  const expires = nextUtcMidnight(date);

  return [0, 1, 2].map((slot) => {
    const keys = [pool[slot]];
    if (rng() < 0.42 && pool[slot + 3]) keys.push(pool[slot + 3]);

    const items = keys.map((key) => ({
      key,
      name: GOODS[key]?.name ?? key,
      qty: quantityFor(GOODS[key]?.base ?? 10, rng)
    }));

    const value = items.reduce((sum, item) => sum + price(item.key) * item.qty, 0);
    const margin = 1.24 + rng() * 0.28;
    const reward = Math.max(25, Math.round(value * margin) + 15 + Math.round(rng() * 25));
    const xp = Math.min(40, 15 + Math.round(value / 90));

    return {
      id: hash(`${seed}:${slot}`).toString(36).slice(0, 4),
      slot: slot + 1,
      title: `${clients[slot].name} · ${clients[slot].want}`,
      brief: briefs[slot],
      items,
      reward,
      xp,
      expires
    };
  });
}

/** What is missing from a hold for a contract, if anything. */
export function missingFor(contract, goods = {}) {
  return (contract?.items ?? [])
    .map((item) => ({
      key: item.key,
      name: item.name ?? GOODS[item.key]?.name ?? item.key,
      need: item.qty,
      have: goods[item.key] ?? 0
    }))
    .filter((item) => item.have < item.need);
}

export function isExpired(contract, now = Date.now()) {
  return Boolean(contract) && contract.expires <= now;
}

export function contractValue(contract) {
  return (contract?.items ?? []).reduce(
    (sum, item) => sum + (GOODS[item.key]?.base ?? 0) * item.qty,
    0
  );
}
