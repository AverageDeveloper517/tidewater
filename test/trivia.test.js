import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeEntities, shuffle, createTrivia } from '../src/services/trivia.js';
import { num, money, duration } from '../src/lib/theme.js';

test('trivia entities decode to plain text', () => {
  assert.equal(decodeEntities('&quot;quoted&quot;'), '"quoted"');
  assert.equal(decodeEntities('it&#039;s fine'), "it's fine");
  assert.equal(decodeEntities('a &amp; b'), 'a & b');
  assert.equal(decodeEntities('caf&eacute;'), 'café');
  assert.equal(decodeEntities('&#65;&#66;'), 'AB');
});

test('shuffle keeps every element', () => {
  const input = ['a', 'b', 'c', 'd'];
  const out = shuffle(input);
  assert.equal(out.length, 4);
  assert.deepEqual([...out].sort(), [...input].sort());
  assert.deepEqual(input, ['a', 'b', 'c', 'd']);
});

test('offline trivia falls back to the local bank', async () => {
  const trivia = createTrivia({
    logger: { warn() {} },
    fetchJson: async () => {
      throw new Error('down');
    }
  });

  const q = await trivia.roll();
  assert.equal(q.source, 'local');
  assert.equal(q.answers.length, 4);
  assert.ok(q.answers.includes(q.correct));
});

test('remote trivia is decoded and shuffled', async () => {
  const trivia = createTrivia({
    logger: { warn() {} },
    fetchJson: async () => ({
      results: [
        {
          question: 'What&#039;s wet?',
          correct_answer: 'Water &amp; salt',
          incorrect_answers: ['Sand', 'Rock', 'Air'],
          difficulty: 'easy',
          category: 'Science: Nature'
        }
      ]
    })
  });

  const q = await trivia.roll();
  assert.equal(q.source, 'opentdb');
  assert.equal(q.question, "What's wet?");
  assert.equal(q.correct, 'Water & salt');
  assert.ok(q.answers.includes(q.correct));
});

test('number formatting is stable', () => {
  assert.equal(num(1234567), '1,234,567');
  assert.equal(money(9.5), '9.50');
  assert.equal(money(4200), '4,200');
  assert.equal(duration(90_000), '1m 30s');
});
