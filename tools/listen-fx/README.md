# Listening pages for the effects (#103)

Two pages to hear the room, the limiter and the electric guitars' amplifier in a real browser, and the steps that check them in headless Chrome. They are copies of the files of the Linux check harness (`~/wks/tmp/mn-harness`), kept here so that another machine has them.

- `serve.ts <port>`: serves the library's `dist/` under `/dist/` and this folder. Its `dist` path is the Linux clone's: change it on another machine. Run `bun run build` in the repo first.
- `listen-fx.html`: pages without a tab (the sample player and the light synthesizer).
- `listen-fx-tab.html`: with a tab, so alphaTab plays everything, as in Obsidian.
- `fx-controls.js`: the yellow bar (Dry, Room, Cabinet, Drive). A change applies at the next Play.
- `fx.html` with `steps-fx.ts`: measures the chain with an offline audio context (it needs `fx-effects.js`: `bun build src/playback/effects.ts --outfile tools/listen-fx/fx-effects.js --format esm`).
- `steps-fx-live.ts`, `steps-listen-fx.ts`, `fx-log.js`: log every Web Audio connection on a live page.
- `cdp.ts <url> <steps file>`: the headless Chrome driver.

Remove this folder when the effects are merged and the guide's Sounds page has its own before and after.
