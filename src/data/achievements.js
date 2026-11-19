// Achievements are plain predicates over a player record. Unlocks are checked
// after every economy update, so new ones apply to existing saves too.

export const ACHIEVEMENTS = [
  { id: 'first_light', name: 'First Light', desc: 'open your dock', reward: 0, test: () => true },
  { id: 'dockhand', name: 'Dockhand', desc: 'work 10 shifts', reward: 150, test: (p) => p.stats.work >= 10 },
  { id: 'night_shift', name: 'Night Shift', desc: 'work 100 shifts', reward: 900, test: (p) => p.stats.work >= 100 },
  { id: 'regular', name: 'Regular', desc: '7 day daily streak', reward: 250, test: (p) => p.streak >= 7 },
  { id: 'devoted', name: 'Devoted', desc: '30 day daily streak', reward: 1_400, test: (p) => p.streak >= 30 },
  { id: 'angler', name: 'Angler', desc: '25 casts', reward: 200, test: (p) => p.stats.fish >= 25 },
  { id: 'deep_water', name: 'Deep Water', desc: '150 casts', reward: 1_200, test: (p) => p.stats.fish >= 150 },
  { id: 'green_thumb', name: 'Green Thumb', desc: '25 harvests', reward: 250, test: (p) => p.stats.harvest >= 25 },
  { id: 'harbour_master', name: 'Harbour Master', desc: '150 harvests', reward: 1_500, test: (p) => p.stats.harvest >= 150 },
  { id: 'collector', name: 'Collector', desc: '25 unique catches', reward: 400, test: (p) => Object.keys(p.catches).length >= 25 },
  { id: 'naturalist', name: 'Naturalist', desc: '100 unique catches', reward: 2_000, test: (p) => Object.keys(p.catches).length >= 100 },
  { id: 'trader', name: 'Trader', desc: '50 trades', reward: 350, test: (p) => p.stats.trades >= 50 },
  { id: 'well_off', name: 'Well Off', desc: '50,000 shells on hand', reward: 500, test: (p) => p.wallet + p.bank >= 50_000 },
  { id: 'merchant_prince', name: 'Merchant Prince', desc: '250,000 shells on hand', reward: 3_000, test: (p) => p.wallet + p.bank >= 250_000 },
  { id: 'scholar', name: 'Scholar', desc: '50 correct answers', reward: 400, test: (p) => p.stats.triviaRight >= 50 },
  { id: 'jackpot', name: 'Jackpot', desc: 'land three shells', reward: 600, test: (p) => p.stats.jackpots >= 1 },
  { id: 'first_contract', name: 'First Contract', desc: 'deliver your first harbour job', reward: 100, test: (p) => (p.stats.contracts ?? 0) >= 1 },
  { id: 'runner', name: 'Runner', desc: 'deliver 5 harbour jobs', reward: 350, test: (p) => (p.stats.contracts ?? 0) >= 5 },
  { id: 'freighter', name: 'Freighter', desc: 'deliver 30 harbour jobs', reward: 2_000, test: (p) => (p.stats.contracts ?? 0) >= 30 },
  { id: 'tidereader', name: 'Tide Reader', desc: 'check the tide 10 times', reward: 250, test: (p) => (p.stats.tides ?? 0) >= 10 },
  { id: 'cold_water', name: 'Cold Water', desc: 'land an Atlantic cod', reward: 300, test: (p) => (p.goods?.cod ?? 0) >= 1 },
  { id: 'warm_water', name: 'Warm Water', desc: 'land a mahi-mahi', reward: 500, test: (p) => (p.goods?.mahi ?? 0) >= 1 },
  { id: 'glass_eye', name: 'Glass Eye', desc: 'fish 10 times with the glass falling', reward: 250, test: (p) => (p.stats.glassFalls ?? 0) >= 10 }
];

export function drain(p) {
  const unlocked = new Set(p.achievements ?? []);
  const fresh = [];
  for (const entry of ACHIEVEMENTS) {
    if (unlocked.has(entry.id)) continue;
    let hit = false;
    try {
      hit = entry.test(p);
    } catch {
      hit = false;
    }
    if (!hit) continue;
    unlocked.add(entry.id);
    p.wallet += entry.reward;
    fresh.push(entry);
  }
  p.achievements = [...unlocked];
  return fresh;
}
