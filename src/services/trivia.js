import { getJson } from '../lib/http.js';
import { TRIVIA_FALLBACK } from '../data/tables.js';
import { pick } from '../lib/util.js';

const URL = 'https://opentdb.com/api.php?amount=1&type=multiple';

const NAMED = {
  '&quot;': '"',
  '&#039;': "'",
  '&apos;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&eacute;': 'é',
  '&egrave;': 'è',
  '&oacute;': 'ó',
  '&aacute;': 'á',
  '&iacute;': 'í',
  '&ntilde;': 'ñ',
  '&uuml;': 'ü',
  '&ouml;': 'ö',
  '&auml;': 'ä',
  '&ccedil;': 'ç',
  '&hellip;': '…',
  '&shy;': '',
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&lsquo;': "'",
  '&rsquo;': "'"
};

export function decodeEntities(text = '') {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&[a-z]+;|&#\d+;/gi, (match) => NAMED[match.toLowerCase()] ?? NAMED[match] ?? match);
}

export function shuffle(list, random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createTrivia({ fetchJson = getJson, logger } = {}) {
  return {
    async roll() {
      try {
        const data = await fetchJson(URL, { ttl: 0, timeoutMs: 6000 });
        const q = data?.results?.[0];
        if (!q) throw new Error('empty trivia response');

        const correct = decodeEntities(q.correct_answer);
        return {
          question: decodeEntities(q.question),
          correct,
          answers: shuffle([correct, ...(q.incorrect_answers ?? []).map((a) => decodeEntities(a))]),
          difficulty: q.difficulty ?? 'medium',
          category: decodeEntities(q.category ?? 'general'),
          source: 'opentdb'
        };
      } catch (err) {
        logger?.warn('trivia: local bank,', err.message);
        const local = pick(TRIVIA_FALLBACK);
        return {
          question: local.q,
          correct: local.correct,
          answers: shuffle([local.correct, ...local.wrong]),
          difficulty: local.difficulty,
          category: 'the harbour',
          source: 'local'
        };
      }
    }
  };
}
