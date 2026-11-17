import { card, money, num, ACCENT } from './theme.js';
import { GLYPH } from './emoji.js';

export const arrowFor = (pct) => (pct > 0.01 ? GLYPH.up : pct < -0.01 ? GLYPH.down : GLYPH.flat);

export function boardEmbed(board, { compact = false } = {}) {
  const lines = board.rows.map((row) => {
    const sign = row.changePct > 0 ? '+' : '';
    return `${row.glyph} **${row.name}** — ${money(row.price)}  ${arrowFor(row.changePct)} ${sign}${row.changePct.toFixed(2)}%`;
  });

  const age = Math.max(0, Math.round((Date.now() - board.at) / 1000));
  const note = board.degraded
    ? 'one feed is quiet - prices are the last good quote'
    : 'priced from live crypto and currency feeds';

  if (compact) {
    return card({
      title: 'market close',
      description: lines.join('\n'),
      color: ACCENT,
      footer: note,
      timestamp: true
    });
  }

  return card({
    title: 'the exchange',
    description: lines.join('\n'),
    color: ACCENT,
    fields: [
      { name: 'buy', value: '`/trade action:buy instrument:<name> quantity:<n>`', inline: false },
      { name: 'sell', value: '`/trade action:sell instrument:<name> quantity:all`', inline: false },
      { name: 'board', value: `${num(board.rows.length)} instruments · updated ${age}s ago`, inline: true },
      { name: 'fee', value: '0.5% each way', inline: true }
    ],
    footer: note,
    timestamp: true
  });
}
