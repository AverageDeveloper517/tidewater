export function createSettings(store) {
  const KEY = 'guilds';

  const all = () => store.get(KEY, {});
  const get = (guildId) => ({ marketChannel: null, ticker: false, ...all()[guildId] });

  return {
    get,

    set(guildId, patch) {
      const data = all();
      data[guildId] = { ...get(guildId), ...patch };
      store.set(KEY, data);
      return data[guildId];
    }
  };
}
