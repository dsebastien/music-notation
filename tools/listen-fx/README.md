# Listening pages for the effects (#103)

Two pages to hear the room, the limiter and the electric guitars' amplifier in a real browser, and the steps that check them in headless Chrome. They are copies of the files of the Linux check harness (`~/wks/tmp/mn-harness`), kept here so that another machine has them.

- `serve.ts <port>`: serves the library's `dist/` under `/dist/` and this folder. Its `dist` path is the Linux clone's: change it on another machine. Run `bun run build` in the repo first.
- `listen-fx.html`: pages without a tab (the sample player and the light synthesizer).
- `listen-fx-tab.html`: with a tab, so alphaTab plays everything, as in Obsidian.
- `fx-controls.js`: the yellow bar. Dry, Cabinet and Drive apply at the next Play, or at the next pass of a loop. The room's Level, Length, Tone, Width and Soft start move what sounds at once: the page finds the library's convolver and the gain after it, and gives the convolver a room made with the library's own `roomImpulse` (`fx-effects.js`, built with `bun build src/playback/effects.ts --outfile tools/listen-fx/fx-effects.js --format esm`; build it again after a change of `effects.ts`). Two buttons compare the room of the second pass with the new one.
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

The third pass (2026-11-18, "a noise with the chain on, louder with more room") looks for what the chain adds that is neither the notes nor the room:

- `distort.html`, `distort2.html`, `distort3.html` (with `steps-wait.ts`): the chain's output against an exact linear copy (the dry take plus the room made by hand), on the dry takes; `distort3.html` compares limiters with a loud room, with the level of each 10 ms taken out.
- `live-check.html`: the same for recordings of the live page (`takes/pub3-1-dry.f32`, `pub3-1-room_0.f32`, `pub3-1-room_0_25.f32`, `pub3-1-room_0_5.f32`, made with `steps-cap-run.ts`).
- `probe.js`: the same inside a real browser tab. Load it in the page before the first play (a script element), then `__probe.start()`, a real click on a Play button, `__probe.stop('dry')` with Dry ticked, the same for `'wet'` with a room, and `await __probe.compare('dry', 'wet', level, module)`; `module` is a build of the `effects.ts` the page's bundle was made from.
- `hiss.html`, `hiss2.html`: the room's highs against its mids and against the dry sound's, between the strums and right after an attack.
- `startup.html`: the compressor's first moments (it starts turned down).
- `steps-bar.ts`: the bar's live controls reach what sounds, on both pages.
