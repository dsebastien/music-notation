# The sound of a plugin build in Obsidian (#103)

Scripts of the check of 2026-11-24: the Music Practice plugin with library 0.26.0 in a vault's Obsidian, measured inside the app (the connections each play makes, Chrome's own dropout count) and after the app (a recording of the output's monitor). Run them on a quiet machine: with a load average of 40 on 12 cores, both builds had gaps of silence and the takes could not be compared.

The sound plays on the real output: tell the owner before. Never change a system volume.

1. Back up the plugin's released `main.js`, `manifest.json` and `styles.css` from the vault's plugin folder, with their hashes (`sha256sum`).
2. Copy `note.md` into the vault as `zz-mn-room-check.md` (a throwaway note: a `chord` block, a `chord` block with `engine: light`, a `tab` block).
3. `obsidian eval code="$(cat open.js)"` opens it in a tab of its own, in reading view. `obsidian eval code="$(cat log.js)"` starts the log of connections.
4. `./take.sh <name> <button> <seconds>` records the default output's monitor (`parec`) while it clicks a Play button of the note (0: the chord, 1: the light synthesizer's chord, 2: the tab), then prints the connections and each audio context's `playbackStats`. Play each button once before the recorded takes: the first play loads the sounds. The vault's path is in `take.sh`.
5. `python3 an.py <name>…` reads the takes: first and last sound, peak, level, how alike left and right are, the share at or above full scale, the gaps of exact silence, and the level of each 100 ms.
6. For the other build: `obsidian eval code="$(cat close.js)"`, copy the build's `main.js` into the plugin folder, `obsidian eval code="$(cat reload.js)"` (disable, `loadManifests`, enable, wait for the commands), then steps 3 to 5 again.
7. At the end: `close.js` (takes the log out, closes the tab), put the released files back and compare the hashes, `reload.js`, wait 2.5 seconds, delete the note, and check that it stays deleted.

What to read in the output: with a build that has the room, a play connects to a `GainNode` (the chain), and a `ConvolverNode` and a `WaveShaperNode` appear at the first play of a context; alphaTab's contexts say `ownDestination: true`. Without the room, a play connects to the speakers.
