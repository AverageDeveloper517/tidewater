export const REJECT = {
  DM: 'dm',
  BOT_PERMS: 'botperms',
  MEMBER_PERMS: 'memberperms',
  RATE: 'rate',
  COOLDOWN: 'cooldown'
};

export function createGuard({ config }) {
  const buckets = new Map();
  const cooldowns = new Map();

  return {
    cooldownLeft(userId, commandName) {
      return Math.max(0, (cooldowns.get(`${userId}:${commandName}`) ?? 0) - Date.now());
    },

    check(interaction, command) {
      if (!interaction.inGuild()) return REJECT.DM;

      if (command.botPermissions?.length) {
        if (!interaction.appPermissions?.has(command.botPermissions)) return REJECT.BOT_PERMS;
      }
      if (command.memberPermissions?.length) {
        if (!interaction.memberPermissions?.has(command.memberPermissions)) return REJECT.MEMBER_PERMS;
      }

      const now = Date.now();
      const cd = command.cooldownMs ?? 0;
      if (cd > 0) {
        const key = `${interaction.user.id}:${command.data.name}`;
        const until = cooldowns.get(key) ?? 0;
        if (until > now) return REJECT.COOLDOWN;
        cooldowns.set(key, now + cd);
      }

      const bucket = buckets.get(interaction.user.id) ?? { count: 0, reset: now + config.rateWindowMs };
      if (now > bucket.reset) {
        bucket.count = 0;
        bucket.reset = now + config.rateWindowMs;
      }
      bucket.count += 1;
      buckets.set(interaction.user.id, bucket);
      if (bucket.count > config.rateLimitMax) return REJECT.RATE;

      return null;
    }
  };
}

export function rejectText(code, command) {
  switch (code) {
    case REJECT.DM:
      return 'guild only - the dock does not take DMs.';
    case REJECT.MEMBER_PERMS:
      return `you need \`${(command.memberPermissions ?? []).join(', ')}\`.`;
    case REJECT.BOT_PERMS:
      return `i need \`${(command.botPermissions ?? []).join(', ')}\` and i do not have it.`;
    case REJECT.RATE:
      return 'slow down - eight commands per ten seconds.';
    case REJECT.COOLDOWN:
      return 'still on cooldown. give it a minute.';
    default:
      return 'refused.';
  }
}
