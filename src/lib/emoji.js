// One curated glyph per concept, so the bot reads as a designed board instead of
// a wall of default emoji. Any name here can be overridden by a real custom emoji
// uploaded through `npm run emojis` - see src/tools/upload-emojis.js.

export const GLYPH = {
  shell: '◈',
  tide: '≋',
  reef: '❖',
  glow: '✦',
  euro: '◎',
  yen: '◇',
  garden: '❀',
  fish: '⌁',
  catch: '◉',
  trivia: '▤',
  vault: '▣',
  chart: '▦',
  up: '▲',
  down: '▼',
  flat: '▬',
  ok: '●',
  no: '○',
  warn: '△',
  dot: '·',
  wave: '≈',
  book: '▥',
  bolt: '⟡',
  lock: '▧',
  star: '✷',
  sun: '☀',
  cloud: '☁',
  rain: '☂',
  storm: '⚡',
  snow: '❄',
  fog: '▨'
};

/** Resolve a glyph to a custom application emoji when the bot owns one by that name. */
export function resolveEmoji(client, name) {
  const custom = client?.application?.emojis?.cache?.find((e) => e.name === name);
  return custom ? custom.toString() : (GLYPH[name] ?? '');
}

export const fieldNames = Object.keys(GLYPH);
