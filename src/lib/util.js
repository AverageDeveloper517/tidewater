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

export const relative = (ms) => {
  const abs = Math.abs(ms);
  if (abs < 60_000) return `${Math.max(1, Math.round(abs / 1000))}s`;
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m`;
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h`;
  return `${Math.round(abs / 86_400_000)}d`;
};
