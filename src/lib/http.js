// Every outbound call in this bot goes through here: one timeout, one cache,
// one place to swap the fetch implementation in tests.

const cache = new Map();

const UA = 'Tidewater/1.0 (Discord bot; +https://github.com)';

export async function getJson(url, { ttl = 0, timeoutMs = 6000, headers = {} } = {}) {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && hit.expires > now) return hit.value;

  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) throw new Error(`http ${res.status} - ${url}`);

  const value = await res.json();
  if (ttl > 0) cache.set(url, { value, expires: now + ttl });
  return value;
}

export function clearHttpCache() {
  cache.clear();
}
