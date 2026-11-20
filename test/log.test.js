import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOG_STATS,
  LOG_TASKS,
  logTasksFor,
  logProgress,
  statSnapshot,
  taskReward,
  bonusReward,
  nextUtcMidnight
} from '../src/data/log.js';

test('the daily log is deterministic per player and day', () => {
  const day = '2026-11-20';
  const a = logTasksFor('u1', day);
  const b = logTasksFor('u1', day);

  assert.deepEqual(a, b);
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((task) => task.id)).size, 3, 'three different jobs');
  assert.ok(a.some((task) => task.quick), 'one job is always quick to reach');
  assert.ok(a.every((task) => LOG_TASKS.some((known) => known.id === task.id)));

  const other = logTasksFor('u2', day);
  const otherDays = ['2026-11-21', '2026-11-22', '2026-11-23'].map((d) => logTasksFor('u1', d));
  assert.ok(
    [...otherDays, other].some(
      (list) => list.map((task) => task.id).join() !== a.map((task) => task.id).join()
    ),
    'the page changes by player and day'
  );
});

test('progress is measured from the morning baseline and never negative', () => {
  const task = { stat: 'fish', target: 2 };
  const base = statSnapshot({ fish: 10 });
  assert.equal(logProgress(task, { fish: 10 }, base), 0);
  assert.equal(logProgress(task, { fish: 12 }, base), 2);
  assert.equal(logProgress(task, { fish: 3 }, base), 0, 'a reset counter cannot go backwards');

  const snap = statSnapshot({ fish: 4, work: 2, unknown: 99 });
  assert.deepEqual(Object.keys(snap).sort(), [...LOG_STATS].sort());
  assert.equal(snap.fish, 4);
  assert.equal(snap.unknown, undefined);
});

test('rewards scale with level but stay predictable', () => {
  assert.equal(taskReward(1), 60);
  assert.equal(taskReward(10), 114);
  assert.equal(bonusReward(1), 150);
  assert.equal(bonusReward(10), 240);
  assert.ok(taskReward(20) > taskReward(1));
  assert.ok(bonusReward(20) > bonusReward(1));
});

test('the log resets at the next UTC midnight', () => {
  const at = new Date('2026-11-20T23:00:00Z');
  assert.equal(nextUtcMidnight(at), Date.UTC(2026, 10, 21));
  assert.equal(nextUtcMidnight(new Date('2026-11-20T00:01:00Z')), Date.UTC(2026, 10, 21));
});
