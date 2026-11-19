import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createStore } from '../src/lib/store.js';

const tempDir = () => mkdtemp(join(tmpdir(), 'tidewater-store-'));

const backupsIn = async (dir) =>
  (await readdir(join(dir, 'backups')).catch(() => [])).filter((name) => /^store-.*\.json$/.test(name)).sort();

test('set is debounced into one atomic file and close flushes it', async (t) => {
  const dir = await tempDir();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const store = await createStore(join(dir, 'store.json'), { backupEveryMs: 0 });
  store.set('players', { u1: { wallet: 10 } });
  store.set('guilds', { g1: { ticker: true } });
  await store.close();

  const raw = await readFile(join(dir, 'store.json'), 'utf8');
  assert.deepEqual(JSON.parse(raw), { players: { u1: { wallet: 10 } }, guilds: { g1: { ticker: true } } });
  assert.deepEqual(
    (await readdir(dir)).filter((name) => name.endsWith('.tmp')),
    [],
    'the temp file is renamed away'
  );
});

test('snapshots are written atomically and the newest are kept', async (t) => {
  const dir = await tempDir();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const store = await createStore(join(dir, 'store.json'), { backupEveryMs: 0, backupKeep: 3 });
  for (let i = 1; i <= 5; i += 1) {
    store.set('players', { u1: { wallet: i } });
    await store.backupNow({ force: true });
  }
  await store.close();

  const names = await backupsIn(dir);
  assert.equal(names.length, 3, 'rotation keeps only the newest three');
  const newest = JSON.parse(await readFile(join(dir, 'backups', names.at(-1)), 'utf8'));
  assert.equal(newest.players.u1.wallet, 5, 'the newest snapshot holds the newest save');
  assert.deepEqual((await readdir(join(dir, 'backups'))).filter((name) => name.endsWith('.tmp')), []);
});

test('a clean store is not snapshotted unless forced', async (t) => {
  const dir = await tempDir();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const store = await createStore(join(dir, 'store.json'), { backupEveryMs: 0 });
  assert.equal(await store.backupNow(), null, 'nothing changed, nothing written');
  assert.ok(await store.backupNow({ force: true }), 'a manual backup always writes');
  assert.equal((await backupsIn(dir)).length, 1);
  await store.close();
});

test('the timer snapshots after a change', async (t) => {
  const dir = await tempDir();
  t.after(() => rm(dir, { recursive: true, force: true }));

  const store = await createStore(join(dir, 'store.json'), { backupEveryMs: 20 });
  store.set('players', { u1: { wallet: 7 } });
  await new Promise((done) => setTimeout(done, 120));

  const names = await backupsIn(dir);
  assert.ok(names.length >= 1, 'a changed save is backed up on the timer');
  const snap = JSON.parse(await readFile(join(dir, 'backups', names.at(-1)), 'utf8'));
  assert.equal(snap.players.u1.wallet, 7);
  await store.close();
});

test('a damaged save refuses to boot and points at the restore path', async (t) => {
  const dir = await tempDir();
  t.after(() => rm(dir, { recursive: true, force: true }));

  await writeFile(join(dir, 'store.json'), '{ not json', 'utf8');
  await assert.rejects(createStore(join(dir, 'store.json')), (err) => {
    assert.match(err.message, /not readable JSON/);
    assert.match(err.message, /npm run restore/);
    return true;
  });
});
