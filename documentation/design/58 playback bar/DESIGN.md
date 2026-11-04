# #58: a new playback UI for diagrams

Prototype: http://127.0.0.1:8770/ (tabs Today, A, B, C, D; a Dark toggle). It loads the released bundle (0.13.0) with `play: false` and adds each design's controls in `designs.js`, playing through the public API (`sequenceOf`, `lightPlayer`, `noteTargets`, `followNotes`), so the sound and the lit notes are the real ones. The redraw for the other instrument, the soundfont and Obsidian popouts are not prototyped.

## Today's problems (from the code)

- `.mn-play` is `position: absolute; bottom: 2px; left: 2px; right: 2px` inside `.mn-playable` (`src/styles.css` 89–122), over the drawing itself. It shows on `:hover`, `:focus-within` or a tap (`mn-play-open`), so whenever the pointer is on a diagram it covers its lower part. On a chord diagram the bar takes two lines (play, loop, strum, volume, sound), so it hides the lower frets (`today-hover-bar.png`). Notes under it can't be read or clicked, and moving the pointer to them keeps the bar open.
- One bar per diagram (`barFor` in `controls.ts`): a row of 12 voicings has 12 bars, each with its own loop, speed, volume and sound.
- Touch: the bar opens on a tap anywhere on the diagram (`pointerdown`), so the first tap on a dot opens the bar instead of only playing.
- Volume, BPM and strum are already settings in Music Practice (`PlaybackSettings`: enabled, engine, volume, bpm, strum); the bar repeats them on each diagram.
- Progressions, strums, picking and tabs already have their own bar (`progression-bar.ts`, `strum-bar.ts`, `picking-bar.ts`, the alphaTab bar). These sit above the drawing, in the flow, and never cover it. Only the diagram bar floats.
- #81: the hand cursor is set on notes only inside `.mn-playable`, and Obsidian's `app.css` gives buttons `cursor: var(--cursor)` (the arrow). The real implementation must set `cursor: pointer` with selectors that are more specific than Obsidian's (for example `.mn-block .mn-play button`), never `!important`. The prototype sets the hand on notes, hit areas, buttons, selects, sliders and clickable diagrams, and the default cursor elsewhere.

## The designs

**A · A strip under each diagram** (`a-strip-top.png`, `a-strip-dense.png`). Play/stop and loop under each diagram, outside the drawing, plus the speed when the diagram is wide enough. Faint until hover or focus, full on touch screens. Volume and sound go to the settings.

- Where: under each diagram. Per diagram.
- On the page: play, loop, speed. Settings: volume, sound.
- Discovery: the visible ▶; the hand cursor on dots and keys.
- Cost: every diagram is about 30 px taller. On dense rows the strip is wider than the diagram, so it is cut to play and loop. A page with 20+ diagrams has 20+ strips.

**B · A play button in a title row** (`b-title-row-top-drawer-open.png`, `b-title-row-dense.png`). A small ▶ in a row above each diagram, with ⋯ on the right. ⋯ opens loop, speed, volume and sound inline: the drawer pushes the diagram down and never covers it.

- Where: a header row above each diagram. Per diagram.
- On the page: play. Behind ⋯: the rest.
- Discovery: the ▶ next to each title; the hand cursor.
- Cost: 26 px more height per diagram. Rows show 12 ▶ and 12 ⋯. Opening ⋯ moves the layout.

**C · One bar per block** (`c-block-bar-top-selected.png`, `c-block-bar-dense.png`, `c-block-bar-dark.png`). One bar above the block, in the flow, with the same look and place as the progression, strum and tab bars. A click on a diagram selects it (outline) and plays it; the bar's ▶ plays the selected one, ▶▶ plays every diagram in turn (rows, voicing lists, `positions: all`), and the bar names the selected diagram. Loop, speed, volume and sound are on the bar.

- Where: above the block. Per block.
- On the page: one bar per block. In the settings: the defaults.
- Discovery: the bar itself, the hand cursor on diagrams and notes, the outline on the selected diagram.
- Cost: a block with one diagram gets a bar too. The bar's loop and speed apply to the selected diagram, so a reader must see which one is selected (the outline and the name on the bar).

**D · Click the diagram, settings off the page** (`d-click-diagram-top-settings-open.png`, `d-click-diagram-dense.png`). No controls on the page. A click on a diagram (or Space or Enter on a focused one) plays or stops it, Esc stops; a dot or a key plays one note. The ♪ button stands for the app's place for settings: in Music Practice, a side panel or Settings → Playback; on Publish, a site option.

- Where: nowhere on the page. Global settings.
- On the page: nothing but the hand cursor, a hover outline, a yellow outline on the diagram that plays, and a one-time hint.
- Discovery: the weakest. The hand cursor and the hint, nothing on touch screens until a tap.
- Cost: no loop or speed per diagram; one setting for the whole app.

## Answers to the issue's questions

1. Where do the controls live? A under, B above each diagram, C above each block, D off the page.
2. Per diagram or per block? Per block (C) scales: a row of 12 gets one bar and gains "play all in turn". A and B repeat 12 times.
3. What belongs on the page? Play/stop, loop and the speed: you change them while you practice. Volume and the instrument go to the app's settings (they exist in Music Practice), with C keeping them on the bar for Publish, where there is no settings tab.
4. How does a reader find that notes are clickable? The hand cursor (#81), a note that lights as it plays, and (C) a click on the diagram that plays it; D needs a hint.

## Trade-offs

|                                         | A strip             | B title row                       | C block bar                        | D click                                       |
| --------------------------------------- | ------------------- | --------------------------------- | ---------------------------------- | --------------------------------------------- |
| Never covers the diagram                | yes                 | yes                               | yes                                | yes                                           |
| Noise on a page with 20+ diagrams       | high                | medium                            | low (one bar per block)            | none                                          |
| Rows and voicing lists                  | one strip each      | one ▶ each                        | one bar, play all in turn          | click each                                    |
| Touch (no hover)                        | yes                 | yes                               | yes                                | yes, but hard to discover                     |
| Keyboard                                | Tab to each strip   | Tab to each ▶                     | Tab to the bar and to each diagram | Tab to each diagram                           |
| Same look as progression/strum/tab bars | no                  | no                                | yes                                | no                                            |
| Publish (no app settings)               | needs a site option | drawer has them                   | bar has them                       | needs a site option                           |
| Obsidian popouts                        | fine                | fine                              | fine                               | the ♪ panel must open in the diagram's window |
| Layout change                           | +30 px per diagram  | +26 px per diagram, drawer pushes | +34 px per block                   | none                                          |

## Recommendation

C, one bar per block. It is the only design that is the same as the bars users already know (progressions, strums, picking, tabs), it adds one line per block instead of one per diagram, and it adds something the hover bar can't do: play a row in turn, which is how you drill a voicing list or the positions of a scale. Volume and sound defaults stay in Music Practice's Settings → Playback; the bar keeps them for Publish. From D, keep "a click on the diagram plays it", which makes the bar optional for a quick listen.

## Open decisions

1. Which design: C (recommended), A, B or D?
2. In C, should a block with one diagram get a bar too, or only play on click (D's behavior) to save a line?
3. Do volume and sound stay on the bar (works on Publish) or move to the app's settings only?
4. Does "play all in turn" loop with the loop button, and how long is the pause between diagrams?
5. In C, a click on the diagram plays it at once (prototype) or only selects it?
6. The tab and score bar (alphaTab) keeps its own controls: align its look with C in the same release, or later?

## Decisions (Sébastien, 2026-11-04)

Recorded on #58 (comment of 2026-11-04). These override the recommendation above where they differ.

1. Design C, one bar per block, but the bar sits **below** the block (A's position). Every block with diagrams gets one, a single diagram too.
2. **Volume only in the app's settings** (Music Practice: Settings → Playback; Publish: `window.musicNotationOptions`), never on the bar.
3. The **sound switch** (guitar, piano and the other instruments, with the redraw for the other instrument) stays on the bar.
4. **Play all in turn** follows the loop button, with a pause of one beat between diagrams.
5. A click on a diagram selects it and **plays it at once**. A dot or a key plays its note. Space or Enter on a focused diagram plays it.
6. Hand cursor on everything clickable (#81), winning over Obsidian's `cursor: var(--cursor)` without `!important`.
7. The tab and score (alphaTab) bar keeps its look until #82.
8. The "♩" glyph before the speed slider renders tiny and low, off the bar's center line (Sébastien's screenshot, prototype and released progression bar alike): replace it with an SVG icon drawn like the other bar icons (same size and stroke, vertically centered) or a readable label with the value ("80 BPM"), with an accessible name, in every bar (block, strum, picking, progression, chart). Check at 100% and 200% zoom, light and dark.

`c-decided-light.png` and `c-decided-dark.png` show the decided layout (bar below, no volume, sound switch); the prototype in this folder was not yet updated for point 8.

Findings for the build: new controls must go before the block's hidden source `<pre>` (the Publish bundle redraws a block when something is inserted between its source and its drawing); today the hand cursor on notes depends on the `.mn-playable` wrapper, so with playback off, notes show no hand.
