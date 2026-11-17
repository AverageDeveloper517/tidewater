import { EmbedBuilder } from 'discord.js';
import { GLYPH } from './emoji.js';

export const BRAND = 'Tidewater';
export const ACCENT = 0x2ec4b6;
export const DEEP = 0x0b3c49;
export const GOLD = 0xe9c46a;
export const OK = 0x52b788;
export const WARN = 0xf4a261;
export const DANGER = 0xe76f51;

export function card({
  title,
  description,
  color = ACCENT,
  fields = [],
  footer = BRAND,
  timestamp = false,
  thumbnail = null
}) {
  const embed = new EmbedBuilder().setColor(color).setFooter({ text: String(footer).slice(0, 2048) });
  if (title) embed.setTitle(String(title).slice(0, 256));
  if (description) embed.setDescription(String(description).slice(0, 4000));
  if (fields.length) embed.addFields(fields.slice(0, 25));
  if (timestamp) embed.setTimestamp(new Date());
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
}

export const errorCard = (message, hint = null) =>
  card({
    title: 'that did not hold',
    description: `\`\`\`${String(message).slice(0, 1200)}\`\`\`${hint ? `\n${hint}` : ''}`,
    color: DANGER
  });

export const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

export const shells = (n) => `${GLYPH.shell} ${num(n)}`;

export const signed = (n) => `${n >= 0 ? '+' : '-'}${GLYPH.shell} ${num(Math.abs(n))}`;

export const money = (n) => {
  const value = Number(n) || 0;
  return Math.abs(value) >= 1000 ? num(value) : value.toFixed(2).replace(/\.00$/, '');
};

export function duration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, (!d && !h) && `${sec}s`].filter(Boolean).join(' ');
}

export function bar(done, total, size = 10) {
  if (!total) return '▱'.repeat(size);
  const filled = Math.max(0, Math.min(size, Math.round((done / total) * size)));
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

export const pct = (done, total) => (total ? Math.min(100, Math.round((done / total) * 100)) : 0);
