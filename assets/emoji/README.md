# custom emoji

The bot ships with a curated set of unicode glyphs, one per concept, defined in
`src/lib/emoji.js`. If you want real art instead, drop images here.

## rules

- one image per glyph key, any of `.png` `.jpg` `.gif`
- name the file exactly the key: `shell.png`, `tide.png`, `reef.png`
- Discord caps application emoji at 256 KB each, 128×128 recommended
- these are **application emojis** - the bot owns them, so they render in every
  server it joins, including DMs

## upload

```bash
npm run emojis
```

The script logs in with `DISCORD_TOKEN`, skips anything already uploaded, and
skips any file whose name is not a key in `src/lib/emoji.js`.

Restart the bot. `client.emoji('shell')` returns `:shell:` when the upload
exists and falls back to `◈` when it does not, so nothing breaks if you never
add art.

## current keys

```
shell tide reef glow euro yen garden fish catch trivia vault chart
up down flat ok no warn dot wave book bolt lock star sun cloud rain storm snow fog
```
