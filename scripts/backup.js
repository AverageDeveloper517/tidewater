import { resolve } from 'node:path';
import { createStore } from '../src/lib/store.js';

const store = await createStore(resolve('data/store.json'));
const file = await store.backupNow({ force: true });
await store.close();

console.log(file ? `wrote ${file}` : 'backups are disabled');
