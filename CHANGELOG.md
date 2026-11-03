# Changelog

## 0.5.3 (2026-11-03)

- Chord symbols written the way chord sheets on the web write them now work: alterations in parentheses (`C7(b9)`, `C7(b5,#9)`, and `C(#5)` for C augmented) and spellings like `Cmaj7b5`, `C-5`, `Cm6/9` and `Csus2sus4` (#40).
- A sharp or flat at the start of a group in parentheses never changes the chord's root: `C(b9)` is not a chord, and the block says what to write instead. Only whole groups are read, so `C,` and `C()` are not chords either, and a lyric line with commas (`G, D, Em, C`) stays lyrics in the chord-sheet import (#40).
- A `chord` block with only a symbol no longer shows an error when the built-in voicing database doesn't have the chord. It draws the 4 easiest voicings the library finds instead (#40). `C7alt` now gets the database's own voicings, and `Cmaj7b5` and `Cmmaj9` keep theirs.
- Diagrams that the app moves to another window (Obsidian popout windows) now play through that window. When you press play, the play bar asks for the player of the window the diagram is in, not the one it was drawn in.

## 0.5.2 (2026-11-02)

- Keyboard scale fingering (`fingering:`) no longer disappears when you add `labels:`. The labels stay on the keys, and the finger numbers get their own row under them (#28).
- With a `range:` that leaves out middle C's octave, the fingering is now drawn. It starts on the first root inside the range, and every octave in the range stays lit (#28).
- Chords named from their frets: maj7 and m7 shell voicings without a fifth now get a name (`3x44xx` is Gmaj7, `x313xx` is Cm7) (#29).
- 13th grips that leave out the 5th, 9th and 11th are named too (`020120` is E13, `3x3455` is G13) (#30).
- A slash chord's bass is spelled the way the chord spells it: `x12010` is C7/Bb, not C7/A# (#31).
- The altered scale is spelled without double sharps: G# altered is G# A B C D E F# (R b2 b3 b4 b5 b6 b7), not G# A A## B# C## E F# (#32).
- The options of the playback bar's sound dropdown are readable in dark themes (#36).
- The speed and volume knobs of the playback bar sit on the middle of their slider on every page, light pages and Obsidian Publish included. 0.5.1 fixed them in Obsidian but put them below the track on light pages (#39).

## 0.5.1 (2026-11-02)

- The volume and speed knobs of the playback bar now sit on their slider in Obsidian, whose own styles had moved them up.
- After a click on a slider, its knob no longer keeps Obsidian's focus ring (keyboard focus still shows it).
- For apps: the `player` function of the `play` option gets the diagram's window, so a player can belong to the window the diagram is in (Obsidian popouts).

## 0.5.0 (2026-11-02)

- **Triads**: `triads: 1-3` in a `chord` block draws a chord's close triads on three strings, up the neck, with their inversion; `key: G major` with `triads: 1-3` draws the seven triads of a key. `labels: intervals` writes R, 3, 5 in the dots. Fretboards take `strings: 1-3` to show only those strings.
- **Chord transitions**: `from: C x32010` and `to: Am` draw the chord you hold and the next chord's voicings your hand reaches most easily. Fingers that stay down have a ring, and fingers that slide (3 frets at most) a dashed one. The library also says what to do in plain words. `progression: G D Em C` picks the voicings that make a whole progression easiest.
- **Hear the diagrams**: the `play` option adds a bar at the bottom of each chord, keyboard and fretboard diagram (on hover, or a tap on phones), with play, loop, speed, volume and a guitar or piano sound. Chords strum, scales go up and down from root to root, and a click on a dot or a key plays that note. The sound is a small synthesizer computed in the browser, or a soundfont the app passes in.
- **Tabs and scores**: `@dsebastien/music-notation/tab` draws `tab` and `score` blocks in alphaTex, or Guitar Pro and MusicXML files, with [alphaTab](https://alphatab.net), which the app passes in. It shows tablature, notation or both, in the page's colors, with a player (play, loop, metronome, count-in, speed, volume) whose sound loads at the first Play. `printTab` prints a score in black on white. It works in Obsidian popout windows.
- **Imports and exports**: converts score files to alphaTex, text tabs to alphaTex (bar lines, repeat signs, two-digit frets, bass and 7-string tunings), and chord sheets to ChordPro (chords over lyrics, `Intro: G D Em C`, repeat marks). Exports to Guitar Pro 7 and MIDI.
- **Obsidian Publish**: a second bundle, `music-notation.tab.min.js`, draws tab and score blocks. `publish.js` loads it only on pages that have them (see the guide's Publish page). Diagrams get the playback bar there too (`play: false` turns it off).

## 0.4.0 (2026-10-29)

- **Every way to play a chord**: `voicings: all` (or `voicings: 6`) in a `chord` block draws every playable voicing of the chord in a row, the easiest first: the open chords you learn first, then E- and A-shape barres, the CAGED shapes and the rest. Each one is fingered and titled with its shape.
- **Narrow them down**: `area: 5-9` (or `open`), `root-string: 5`, `strings: 1-3` (triads on the top strings), `inversion: 1` (or `any`), `stretch: yes`, `open: no`, `gaps: yes`. Works on any tuning up to 8 strings: `tuning: ukulele` gives the usual ukulele shapes.
- For apps: `generateVoicings(chord, options)`, `fingerVoicing(frets)` (fingers for any voicing) and `voicingShape(frets, chord)`.
- `C7alt` (and `Calt`) are read as altered dominant chords.

## 0.3.0 (2026-10-29)

- **Chords in words**: `A Major`, `F Sharp Minor 7`, `C Major over G` work wherever a chord symbol does, and stay the title. A chord the library doesn't recognize says what to write instead.
- **Chords recognized from their notes**: `frets: x02220` alone (or `pitches:`) draws an A chord, named and with its root marked.
- **Scales and modes**: the usual names (`Natural minor`, `Blues`, `Major pentatonic`), the notes that define a mode in their own color, `compare: major` to see what changes, `modes: C major` for every mode of a key.
- **Positions on the neck**: pentatonic boxes, CAGED shapes and three notes per string, one at a time (`position: 2`, `shape: E`, `shape: 3nps`) or all in a row (`positions: all`).
- **Scale fingering** on keyboards: `fingering: 1 2 3 1 2 3 4 5`.
- **Blocks from a note's properties**: an empty block draws what the note's properties say (chord symbol, frets, fingers; scale root, type and shape), in apps and on Obsidian Publish (`window.musicNotationOptions.properties`).
- **Changes to existing blocks**: modes and blues scales now mark their characteristic notes (`highlight: none` turns it off); chord blocks with only frets or pitches now get a title and root marks.

## 0.2.0 (2026-10-28)

- Several diagrams in one block: separate them with `---` to draw a song's chords, a progression or a scale's positions side by side. Settings shared by every diagram go first; `columns: 3` draws a grid. A mistake in one diagram no longer hides the others.
- `orientation: horizontal` turns guitar chords sideways (high string on top, as in tabs); `orientation: vertical` stands fretboards up (nut on top) and draws keyboards with their low notes at the bottom.
- `hand: left` mirrors guitar chords and fretboards for left-handed players.
- Apps can set the default orientation and hand (`orientation`, `hand` render options); Obsidian Publish sites through `window.musicNotationOptions`.
- Long titles no longer get cut off on narrow diagrams.
- The 12th-fret double dot shows as two dots on 4-string fretboards (bass, ukulele).

## 0.1.3 (2026-10-28)

- Fixes the ES module build of 0.1.2: `import … from '@dsebastien/music-notation'` failed (the entry exported names it didn't define). The browser bundle for Obsidian Publish was not affected.

## 0.1.2 (2026-10-28)

- Every common way to write a chord now draws: `CΔ7`, `Cmin6`, `CM9`, `Cø7`, `Cm(maj7)`, `C7b9`, `Cm11`… on piano, and as guitar voicings when the database has one.
- An empty block (a template's placeholder) draws nothing instead of an error.
- The guide has live examples, an examples gallery and a playground: https://dsebastien.github.io/music-notation/

## 0.1.1 (2026-10-28)

- `chord` blocks that name their chord with `name: A` (instead of `symbol: A`) now mark the chord's root notes too.

## 0.1.0 (2026-10-28)

First release: music notation from small text blocks, as SVG and HTML.

- `chord`: guitar chord diagrams (frets, fingers, barres, position, root marks, any tuning), about 2,000 voicings to pick from by symbol, and piano chords from a symbol or pitches, with fingering.
- `keyboard`: a piano keyboard with the notes of a scale, a chord or a list; labels as notes, degrees or intervals.
- `fretboard`: a guitar neck with the notes of a scale, a chord or a list, in any tuning.
- `chords`: ChordPro charts (chords over lyrics, sections, comments), transposable.
- A browser bundle for Obsidian Publish that draws every block on the page.
