import { CROPS, FISH } from './tables.js';

export const GOODS = {
  ...Object.fromEntries(Object.entries(CROPS).map(([key, crop]) => [key, { name: crop.name, base: crop.base }])),
  ...Object.fromEntries(Object.entries(FISH).map(([key, fish]) => [key, { name: fish.name, base: fish.base }]))
};

export const SELLABLE = Object.keys(GOODS);

export function goodName(key) {
  return GOODS[key]?.name ?? key;
}

export function formatGoods(goods = {}) {
  const rows = Object.entries(goods).filter(([, qty]) => qty > 0);
  if (!rows.length) return 'nothing in the hold';
  return rows.map(([key, qty]) => `${goodName(key)} ×${qty}`).join('\n');
}
