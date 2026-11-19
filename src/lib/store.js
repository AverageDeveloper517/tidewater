import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export async function createStore(
  filePath,
  { backupDir = join(dirname(filePath), 'backups'), backupEveryMs = 30 * 60_000, backupKeep = 96 } = {}
) {
  let data = {};
  let timer = null;
  let writing = Promise.resolve();
  let backing = Promise.resolve();
  let dirty = false;
  let sequence = 0;

  const backupsOn = Boolean(backupDir);
  const intervalOn = backupsOn && backupEveryMs > 0;

  await mkdir(dirname(filePath), { recursive: true });
  if (backupsOn) await mkdir(backupDir, { recursive: true });

  try {
    data = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(
        `store: ${filePath} is not readable JSON (${err.message}) - ` +
          `stop the bot and restore a snapshot from ${backupDir} (npm run restore)`
      );
    }
  }

  const flush = async () => {
    timer = null;
    const payload = JSON.stringify(data, null, 2);
    const tmp = `${filePath}.tmp`;
    writing = writing.then(async () => {
      await writeFile(tmp, payload, 'utf8');
      await rename(tmp, filePath);
    });
    await writing;
  };

  const prune = async () => {
    const names = (await readdir(backupDir)).filter((name) => /^store-.*\.json$/.test(name)).sort();
    const extra = names.slice(0, Math.max(0, names.length - backupKeep));
    await Promise.all(extra.map((name) => unlink(join(backupDir, name)).catch(() => {})));
  };

  // One snapshot at a time. The write goes to a temp file and is renamed, so a
  // crash can never leave a half-written backup behind.
  const snapshot = async ({ force = false } = {}) => {
    if (!backupsOn || (!dirty && !force)) return null;

    dirty = false;
    const payload = JSON.stringify(data, null, 2);
    sequence += 1;
    const name = `store-${stamp()}-${String(sequence).padStart(3, '0')}.json`;
    const target = join(backupDir, name);

    try {
      await writeFile(`${target}.tmp`, payload, 'utf8');
      await rename(`${target}.tmp`, target);
    } catch (err) {
      dirty = true;
      throw err;
    }

    await prune().catch(() => {});
    return target;
  };

  const backup = (options) => {
    const run = backing.then(() => snapshot(options));
    backing = run.catch(() => {});
    return run;
  };

  const every = intervalOn
    ? setInterval(() => void backup().catch(() => {}), backupEveryMs)
    : null;
  every?.unref?.();

  return {
    get(key, fallback = null) {
      return Object.hasOwn(data, key) ? data[key] : fallback;
    },
    set(key, value) {
      data[key] = value;
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush().catch(() => {}), 250);
      return value;
    },
    all() {
      return data;
    },
    /** Write a snapshot now. Without `force`, only when something changed since the last one. */
    backupNow(options) {
      return backup(options);
    },
    async close() {
      if (timer) clearTimeout(timer);
      if (every) clearInterval(every);
      await flush();
      await backup().catch(() => {});
      await backing;
    }
  };
}
