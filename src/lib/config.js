import 'dotenv/config';

const clamp = (n, min, max, fallback) => {
  const v = Number.parseInt(n, 10);
  return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : fallback;
};

export function loadConfig() {
  const token = (process.env.DISCORD_TOKEN ?? '').trim();

  if (!token) {
    throw new Error('config: DISCORD_TOKEN is empty - copy .env.example to .env and paste your bot token');
  }

  return {
    token,
    guildId: (process.env.GUILD_ID ?? '').trim() || null,
    logChannelId: (process.env.LOG_CHANNEL_ID ?? '').trim() || null,
    rateLimitMax: clamp(process.env.RATE_LIMIT, 1, 30, 8),
    rateWindowMs: 10_000,
    marketTtlMs: 120_000,
    backupEveryMin: clamp(process.env.BACKUP_EVERY_MIN, 0, 1440, 30),
    backupKeep: clamp(process.env.BACKUP_KEEP, 2, 1000, 96)
  };
}
