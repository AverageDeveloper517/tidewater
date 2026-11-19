import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const root = resolve('data');
const backupDir = join(root, 'backups');
const storePath = join(root, 'store.json');
const arg = process.argv[2];

const list = async () =>
  (await readdir(backupDir).catch(() => []))
    .filter((name) => /^store-.*\.json$/.test(name))
    .sort()
    .reverse();

if (!arg) {
  const names = await list();

  if (!names.length) {
    console.log('no backups yet - start the bot, or run `npm run backup`');
    process.exit(0);
  }

  console.log('available backups, newest first:\n');
  for (const name of names.slice(0, 20)) {
    const info = await stat(join(backupDir, name));
    console.log(`  ${name}  ${(info.size / 1024).toFixed(1)} KB`);
  }
  console.log('\nrestore: npm run restore -- <file>');
  console.log('stop the bot before restoring.');
  process.exit(0);
}

const name = basename(arg);
if (!/^store-.*\.json$/.test(name)) {
  console.error(`not a backup name: ${arg}`);
  console.error('run `npm run restore` with no argument to list snapshots.');
  process.exit(1);
}

const source = join(backupDir, name);

let parsed;
try {
  parsed = JSON.parse(await readFile(source, 'utf8'));
} catch (err) {
  console.error(`cannot read ${source}: ${err.message}`);
  process.exit(1);
}

if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
  console.error(`${source} does not contain a Tidewater save.`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await mkdir(backupDir, { recursive: true });

try {
  await copyFile(storePath, join(backupDir, `store-pre-restore-${stamp}.json`));
  console.log(`kept the current save as data/backups/store-pre-restore-${stamp}.json`);
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

await copyFile(source, storePath);
console.log(`restored ${name} -> data/store.json`);
console.log('start the bot again.');
