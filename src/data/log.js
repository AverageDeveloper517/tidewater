import { dayKey, seeded } from '../lib/util.js';

/**
 * The Harbour Log: three small jobs for the day, drawn from the systems the
 * player already has. Progress is measured against a snapshot of cumulative
 * stats taken when the player's day rolls over, so nothing has to be wired into
 * every command and a restart cannot lose progress.
 */

export const LOG_STATS = [
  'work',
  'fish',
  'harvest',
  'trades',
  'triviaRight',
  'caught',
  'contracts',
  'tides',
  'sales',
  'dailies'
];

export const LOG_TASKS = [
  { id: 'work', name: 'take a shift', target: 1, stat: 'work', hint: '/work', quick: true },
  { id: 'fish', name: 'land two casts', target: 2, stat: 'fish', hint: '/fish', quick: true },
  { id: 'harvest', name: 'bring in a harvest', target: 1, stat: 'harvest', hint: '/garden', quick: false },
  { id: 'trade', name: 'fill one trade', target: 1, stat: 'trades', hint: '/trade', quick: false },
  { id: 'contract', name: 'deliver a harbour job', target: 1, stat: 'contracts', hint: '/contracts', quick: false },
  { id: 'trivia', name: 'get one answer right', target: 1, stat: 'triviaRight', hint: '/trivia', quick: true },
  { id: 'catch', name: 'net a pokedex entry', target: 1, stat: 'caught', hint: '/catch', quick: true },
  { id: 'sell', name: 'sell from the hold', target: 1, stat: 'sales', hint: '/sell', quick: false },
  { id: 'tide', name: 'read the tide', target: 1, stat: 'tides', hint: '/tide', quick: true },
  { id: 'daily', name: 'collect the day', target: 1, stat: 'dailies', hint: '/daily', quick: false }
];

export const TASK_XP = 8;
export const BONUS_XP = 20;

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Three deterministic jobs for a player and a UTC day. One is always a quick
 * action (a shift, a cast, a question, a catch or a tide check) so the log is
 * never three long cooldowns at once.
 */
export function logTasksFor(userId, day = dayKey()) {
  const rng = seeded(`log:${day}:${userId}`);
  const quick = shuffle(LOG_TASKS.filter((task) => task.quick), rng)[0];
  const rest = shuffle(LOG_TASKS.filter((task) => task.id !== quick.id), rng).slice(0, 2);
  return [quick, ...rest];
}

export function statSnapshot(stats = {}) {
  return Object.fromEntries(LOG_STATS.map((key) => [key, Number(stats[key]) || 0]));
}

export function logProgress(task, stats = {}, base = {}) {
  const now = Number(stats[task.stat]) || 0;
  const then = Number(base[task.stat]) || 0;
  return Math.max(0, now - then);
}

export const taskReward = (level = 1) => 60 + Math.max(0, level - 1) * 6;
export const bonusReward = (level = 1) => 150 + Math.max(0, level - 1) * 10;

export function nextUtcMidnight(date = new Date()) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}
