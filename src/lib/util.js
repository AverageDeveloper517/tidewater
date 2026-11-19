export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const pick = (list) => list[(Math.random() * list.length) | 0];

export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export const truncate = (value, max = 1024) => {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

export function intArg(value, fallback, min, max) {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n)) return clamp(fallback, min, max);
  return clamp(n, min, max);
}

/** FNV-1a, used for deterministic daily prices. */
export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG seeded from a string - same day, same prices. */
export function seeded(text) {
  let s = hash(text) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export const roll = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

export function weighted(list, random = Math.random) {
  const total = list.reduce((sum, entry) => sum + entry.weight, 0);
  let point = random() * total;
  for (const entry of list) {
    point -= entry.weight;
    if (point <= 0) return entry;
  }
  return list[list.length - 1];
}

export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/** A compact shape for a series - used for the 24h tide curve. */
export function sparkline(values, width = 24) {
  const clean = (values ?? []).filter((n) => Number.isFinite(Number(n))).map(Number);
  if (clean.length < 2) return '';

  const count = Math.min(width, clean.length);
  const sampled = Array.from({ length: count }, (_, i) => {
    const index = count === 1 ? 0 : Math.round((i * (clean.length - 1)) / (count - 1));
    return clean[index];
  });

  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  if (max - min < 0.005) return SPARK[3].repeat(count);

  return sampled
    .map((value) => SPARK[Math.min(7, Math.max(0, Math.floor(((value - min) / (max - min)) * 7.999)))])
    .join('');
}

/** Discord timestamp markup - rendered in the reader's own timezone. */
export const timeTag = (ms, style = 't') => `<t:${Math.floor(Number(ms) / 1000)}:${style}>`;

export const relative = (ms) => {
  const abs = Math.abs(ms);
  if (abs < 60_000) return `${Math.max(1, Math.round(abs / 1000))}s`;
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m`;
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h`;
  return `${Math.round(abs / 86_400_000)}d`;
};
