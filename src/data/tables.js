// Pure game tables. No imports, no side effects - easy to test and edit.

export const CROPS = {
  brine: {
    name: 'Brine',
    glyph: '✧',
    seed: 15,
    growMs: 45 * 60_000,
    base: 14,
    yield: [4, 8],
    loves: ['clear', 'cloud'],
    hates: ['rain', 'storm'],
    note: 'salt pans want dry air'
  },
  kelp: {
    name: 'Kelp',
    glyph: '≋',
    seed: 35,
    growMs: 2 * 3_600_000,
    base: 26,
    yield: [3, 6],
    loves: ['rain', 'fog', 'cloud'],
    hates: ['clear'],
    note: 'kelp drinks the grey'
  },
  coral: {
    name: 'Coral',
    glyph: '❀',
    seed: 110,
    growMs: 6 * 3_600_000,
    base: 88,
    yield: [2, 4],
    loves: ['clear'],
    hates: ['storm', 'rain'],
    note: 'coral wants light and still water'
  }
};

export const WEATHER_MULT = {
  loves: 1.4,
  neutral: 1,
  hates: 0.55,
  storm: 0.25
};

export const FISH = {
  junk: { name: 'Boot', base: 2, weight: 26, rarity: 'junk' },
  kelp: { name: 'Kelp bundle', base: 9, weight: 24, rarity: 'common' },
  brine: { name: 'Brine sack', base: 12, weight: 16, rarity: 'common' },
  mackerel: { name: 'Mackerel', base: 30, weight: 14, rarity: 'common' },
  bass: { name: 'Sea bass', base: 58, weight: 10, rarity: 'uncommon' },
  eel: { name: 'Silver eel', base: 120, weight: 6, rarity: 'uncommon' },
  pearl: { name: 'Pearl', base: 260, weight: 3.2, rarity: 'rare' },
  abyss: { name: 'Abyssal pearl', base: 780, weight: 0.8, rarity: 'rare' }
};

export const SLOT_SYMBOLS = [
  { key: 'shell', glyph: '◈', weight: 1 },
  { key: 'tide', glyph: '≋', weight: 1 },
  { key: 'reef', glyph: '❖', weight: 1 },
  { key: 'glow', glyph: '✦', weight: 1 },
  { key: 'euro', glyph: '◎', weight: 1 },
  { key: 'yen', glyph: '◇', weight: 1 }
];

export const PAYOUTS = {
  jackpot: 20, // three shells
  triple: 8, // any other three of a kind
  pair: 1.6
};

export const JOBS = [
  'mended nets on the north pier',
  'unloaded a crate of someone else\'s mistakes',
  'swept the fish market before dawn',
  'ferried a notary across the bay',
  'dove for a dropped anchor chain',
  'painted hull numbers in the rain',
  'hauled ice to the cannery',
  'took a shift on the lighthouse stairs',
  'sorted salvage by the kilo',
  'kept the harbourmaster awake'
];

export const TRIVIA_FALLBACK = [
  { q: 'Which ocean is the largest on Earth?', correct: 'Pacific Ocean', wrong: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'], difficulty: 'easy' },
  { q: 'What is the tallest mountain above sea level?', correct: 'Everest', wrong: ['K2', 'Denali', 'Kilimanjaro'], difficulty: 'easy' },
  { q: 'Which planet has the most moons?', correct: 'Saturn', wrong: ['Jupiter', 'Neptune', 'Uranus'], difficulty: 'medium' },
  { q: 'What is the deepest known ocean trench?', correct: 'Mariana Trench', wrong: ['Tonga Trench', 'Java Trench', 'Puerto Rico Trench'], difficulty: 'medium' },
  { q: 'A group of jellyfish is called a what?', correct: 'Bloom', wrong: ['Pod', 'Shoal', 'Murder'], difficulty: 'easy' },
  { q: 'What percentage of the ocean has been mapped in high resolution?', correct: 'About 25%', wrong: ['About 5%', 'About 60%', 'About 90%'], difficulty: 'hard' },
  { q: 'Which animal has three hearts?', correct: 'Octopus', wrong: ['Shark', 'Dolphin', 'Sea turtle'], difficulty: 'easy' },
  { q: 'What causes tides?', correct: 'Gravity of the Moon and Sun', wrong: ['Ocean currents', 'Wind', 'Salinity changes'], difficulty: 'easy' },
  { q: 'What is the saltiest large body of water on Earth?', correct: 'Dead Sea', wrong: ['Red Sea', 'Caspian Sea', 'Baltic Sea'], difficulty: 'medium' },
  { q: 'How fast does sound travel in seawater, roughly?', correct: '1,500 m/s', wrong: ['340 m/s', '3,000 m/s', '150 m/s'], difficulty: 'hard' },
  { q: 'Which fish has a transparent head?', correct: 'Barreleye', wrong: ['Anglerfish', 'Lanternfish', 'Oarfish'], difficulty: 'hard' },
  { q: 'What is the largest animal that has ever lived?', correct: 'Blue whale', wrong: ['Argentinosaurus', 'Sperm whale', 'Megalodon'], difficulty: 'easy' },
  { q: 'Which sea has no coastline?', correct: 'Sargasso Sea', wrong: ['Coral Sea', 'Bering Sea', 'Weddell Sea'], difficulty: 'medium' },
  { q: 'Corals are animals in the same family as what?', correct: 'Jellyfish', wrong: ['Sponges', 'Barnacles', 'Starfish'], difficulty: 'medium' },
  { q: 'What is the name for the zone where ocean meets land?', correct: 'Littoral zone', wrong: ['Pelagic zone', 'Abyssal zone', 'Benthic zone'], difficulty: 'hard' }
];
