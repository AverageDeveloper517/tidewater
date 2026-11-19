// Sea-surface temperature is fetched for /tide, and it decides which species
// are actually in the water. Every regional fish carries a real tolerance band
// in °C; the live reading scales its weight and falls off over four degrees on
// either side. No reading means every band stays neutral - the bot never invents
// a sea temperature to make the card look fuller.

import { FISH } from '../data/tables.js';
import { clamp } from './util.js';

export const BAND_EDGE = 4; // degrees of falloff outside a species' band

export function bandFactor(sst, band) {
  if (!band || sst == null || !Number.isFinite(Number(sst))) return 1;
  const sea = Number(sst);
  const [lo, hi] = band;
  if (sea >= lo && sea <= hi) return 1;
  const distance = sea < lo ? lo - sea : sea - hi;
  return clamp(1 - distance / BAND_EDGE, 0.02, 1);
}

export const SEA_BANDS = [
  { max: 5, key: 'freezing', label: 'near-freezing' },
  { max: 10, key: 'cold', label: 'cold' },
  { max: 15, key: 'cool', label: 'cool' },
  { max: 20, key: 'temperate', label: 'temperate' },
  { max: 24, key: 'warm', label: 'warm' },
  { max: Infinity, key: 'tropical', label: 'tropical' }
];

export function seaBand(sst) {
  if (sst == null || !Number.isFinite(Number(sst))) {
    return { key: 'unknown', label: 'no reading', sst: null };
  }
  const value = Number(sst);
  const hit = SEA_BANDS.find((band) => value < band.max) ?? SEA_BANDS[SEA_BANDS.length - 1];
  return { key: hit.key, label: hit.label, sst: value };
}

/** Which regional species are at home in this water, and which are thin. */
export function bandReport(sst) {
  if (sst == null || !Number.isFinite(Number(sst))) return { inBand: [], outBand: [] };
  const inBand = [];
  const outBand = [];
  for (const fish of Object.values(FISH)) {
    if (!fish.temp) continue;
    if (bandFactor(sst, fish.temp) === 1) inBand.push(fish.name);
    else outBand.push(fish.name);
  }
  return { inBand, outBand };
}

/**
 * The catch table, factored out of the command so the weighting can be tested
 * without Discord. Unknown water leaves every weight exactly as it was.
 */
export function catchTable({ sst = null, luck = 1, mood, bite = 1, light = 1, night = false }) {
  return Object.entries(FISH).map(([key, fish]) => {
    let weight = fish.weight * bandFactor(sst, fish.temp);
    if (fish.rarity === 'rare') weight *= luck * mood.rare * bite * light;
    if (fish.rarity === 'uncommon') weight *= (1 + (luck - 1) * 0.5) * (night ? 1.05 : 1);
    if (fish.rarity === 'junk') weight *= mood.junk;
    return { key, weight, fish };
  });
}
