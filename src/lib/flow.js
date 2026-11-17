import { card, shells, WARN } from './theme.js';

export const NO_PROFILE = () =>
  card({
    title: 'no dock yet',
    description: 'open one with `/start port:<your city>`.\nweather and wave data come from the port you pick, so use a real place.',
    color: WARN
  });

export async function requireProfile(reply, player) {
  if (player) return false;
  await reply({ embeds: [NO_PROFILE()] });
  return true;
}

export function unlockedText(fresh = []) {
  if (!fresh.length) return '';
  return `\n\n${fresh
    .map((a) => `✷ **${a.name}** unlocked${a.reward ? ` - ${shells(a.reward)}` : ''} · ${a.desc}`)
    .join('\n')}`;
}

export const levelInfo = (player) => {
  const level = 1 + Math.floor(Math.sqrt(Math.max(0, player.xp) / 40));
  const floor = 40 * (level - 1) ** 2;
  const ceiling = 40 * level ** 2;
  return { level, into: player.xp - floor, span: ceiling - floor };
};
