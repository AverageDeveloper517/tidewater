const LEVEL_COLOR = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  ok: '\x1b[32m',
  dim: '\x1b[90m'
};
const RESET = '\x1b[0m';

const stamp = () => new Date().toISOString().slice(11, 19);

export function createLogger(scope = 'core') {
  const write = (level, args) => {
    const line = `${LEVEL_COLOR.dim}${stamp()}${RESET} ${LEVEL_COLOR[level]}${level.padEnd(5)}${RESET} ${LEVEL_COLOR.dim}${scope}${RESET}`;
    console.log(line, ...args);
  };

  return {
    info: (...a) => write('info', a),
    ok: (...a) => write('ok', a),
    warn: (...a) => write('warn', a),
    error: (...a) => write('error', a),
    child: (name) => createLogger(name),

    async mirror(client, text) {
      const id = client.config?.logChannelId;
      if (!id) return;
      try {
        const channel = await client.channels.fetch(id);
        if (channel?.isTextBased()) await channel.send({ content: text.slice(0, 1900) });
      } catch {
        // mirroring is best effort and never blocks a command
      }
    }
  };
}
