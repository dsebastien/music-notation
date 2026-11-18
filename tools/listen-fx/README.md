# Listening pages for the effects (#103)

Two pages to hear the room, the limiter and the electric guitars' amplifier in a real browser, and the steps that check them in headless Chrome. They are copies of the files of the Linux check harness (`~/wks/tmp/mn-harness`), kept here so that another machine has them.

- `serve.ts <port>`: serves the library's `dist/` under `/dist/` and this folder. Its `dist` path is the Linux clone's: change it on another machine. Run `bun run build` in the repo first.
- `listen-fx.html`: pages without a tab (the sample player and the light synthesizer).
- `listen-fx-tab.html`: with a tab, so alphaTab plays everything, as in Obsidian.
- `fx-controls.js`: the yellow bar (Dry, Room level, Room length, Cabinet, Drive). The Room level moves what sounds at once (the page finds the room's gain); the rest applies at the next Play, or at the next pass of a loop.
- `fx.html` with `steps-fx.ts`: measures the chain with an offline audio context (it needs `fx-effects.js`: `bun build src/playback/effects.ts --outfile tools/listen-fx/fx-effects.js --format esm`).
- `steps-fx-live.ts`, `steps-listen-fx.ts`, `fx-log.js`: log every Web Audio connection on a live page.
- `cdp.ts <url> <steps file>`: the headless Chrome driver.

The second pass (2026-11-18) measures the real sound of the pages, not test tones:

- `cap-lib.ts`: records what reaches the speakers of a page (a tap on every connection to a context's destination) and gives its level, peak, envelope and width; it also logs the connections with their time.
- `steps-cap-list.ts`: the play buttons of a page, numbered. `steps-cap-run.ts`: records plays with several settings of the yellow bar (`MN_PLAYS="1,7,22" MN_SETS="dry;room=0;room=0.25,secs=2;room=0.25,cab,drive=0.5" MN_OUT=<folder>`; `MN_WARM=0` records the first play of a fresh page). It writes a `.wav` and a `.f32` (the exact samples) per take.
- `tune.html` with `steps-wait.ts`: renders dry takes (`takes/pub-<n>-dry.f32`, recorded with `MN_SETS=dry MN_OUT=takes MN_NAME=pub MN_PLAYS="1,5,7,10,16,18"` on `listen-fx.html`; not kept here: 10 MB) through candidate limiters, drives and cabinets in an offline audio context.
- `fx-time.html`: how long the first chain of a context takes, and whether a context takes a `destination` of its own (alphaTab's route).
- `steps-first.ts`: where alphaTab's node connects on the first play of a fresh page. `steps-live.ts`: the live Room level. `steps-loop.ts`: a looping strum takes the amplifier and Dry at its next pass.

Remove this folder when the effects are merged and the guide's Sounds page has its own before and after.
