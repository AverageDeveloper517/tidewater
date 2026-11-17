import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function createStore(filePath) {
  let data = {};
  let timer = null;
  let writing = Promise.resolve();

  await mkdir(dirname(filePath), { recursive: true });

  try {
    data = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(`store: ${filePath} is not readable JSON (${err.message})`);
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

  return {
    get(key, fallback = null) {
      return Object.hasOwn(data, key) ? data[key] : fallback;
    },
    set(key, value) {
      data[key] = value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush().catch(() => {}), 250);
      return value;
    },
    all() {
      return data;
    },
    async close() {
      if (timer) clearTimeout(timer);
      await flush();
    }
  };
}
