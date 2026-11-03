# Changelog

## 0.8.0 (2026-11-03)

- **Follow the notes**: while a chord, keyboard or fretboard plays, each note lights up on the drawing when you hear it: the dot, the key or the string's mark. A strummed chord lights its strings from the low one up, and a clicked note lights only what you clicked. Stop or a new sound turns every light off (#41).
- In `tab` and `score` blocks, a line now follows the beat while the music plays, and the notes that sound light up in the player bar's accent color. Before, neither showed: alphaTab ships no style for its cursor and highlight.
- **Strumming patterns**: a new `strum` block draws a pattern on a beat grid, with the counts, an arrow for each strum, accents (`D>`), muted strums (`X`), ghost strums (`(U)`) and chord changes (`[G]`). Write it the way you find it on the web: `D - D U - U D U`, `D DU UDU`, `DDUUDU` and `↓ ↓↑ ↑↓↑` all work, in 4/4, 3/4, 6/8 or 12/8, with 8ths, 16ths or triplets. A chord line above the pattern works too (#8).
- **Hear the strumming**: with playback on, a bar under the pattern plays it over its chords, with loop, a count-in, tempo (20–240 BPM) and volume. Down strums go from the low string up, up strums from the high strings down; accents are louder, ghost strums soft and muted strums short. The slot that plays is lit (#22).
- **Which scale fits**: `scales-for: G D Em C` on a keyboard or a fretboard draws the scale that fits a song's chords (G major here), and `scales-for-notes:` does the same for a list of notes. The title names the scale, and any notes outside it (#42).
- **A chord over a scale**: give both `scale:` and `chord:` and the scale stays drawn, with the chord's notes solid and the other notes hollow: the notes to aim for when you solo over that chord. With `position:` or `positions:`, you get the scale's positions with the chord tones marked (#48).
- **Progressions**: a new `progression` block writes a progression once and shows its chords in any key, each with its numeral and a diagram. It reads roman numerals (`I V vi IV`, `ii7 V7 Imaj7`, `bVII`, `V/V`, `I/3`), Nashville numbers (`1 5 6m 4`) and chord names, and finds the key when you don't give one. `functions: yes` names each chord's function, `transpose:` moves the key, and `---` starts a section in a new key. Guitar diagrams use the voicings that make the whole progression easiest; piano chords are in root position, or follow `voice-leading: yes` or a piano voicing (#9).
- **Circle of fifths**: a new `circle` block draws the 12 major keys, their relative minors and the diminished chords, with each key signature. The chosen key's chords are tinted, with their numerals, in any mode, as triads or sevenths. With playback on, a click plays a key or a chord, and the play button plays the key's scale (#44).
- **Capo**: `capo: 2` on a `chord` or `fretboard` block draws a capo bar and a "Capo 2" caption. Frets count from the capo, the way players read them, so an A shape is still `x02220`; `frets-from: nut` counts them from the nut and draws the real neck. Root marks, note labels and playback use the notes that sound, and `sounds: yes` adds the sounding chord to the caption ("Capo 2, sounds B") (#6).
- **Arpeggios**: `arpeggio: Am7` draws a chord's notes on a fretboard, labeled with intervals. `position:`, `shape:` and `positions: all` draw its CAGED shapes, one at a time or up the neck, with the same rules as scale positions (#20).
- **Piano voicings**: piano chords from a symbol take `inversion` (C in `first` inversion is E4 G4 C5), `octave`, `voicing` (`close`, `open`, `shell`, `rootless A`, `rootless B`), `hands: left+right` (the bass in the left hand, with an L or R under each key) and `fingering: auto`. A `chord` row can share them (#16).
- **Chord diagrams in ChordPro charts**: `{diagrams}` draws every chord the chart uses as a row above the song, in the order they first appear (`{diagrams: bottom}` puts it under). The row is off by default, so existing charts don't change. `{define}` gives a chord's shape in ChordPro 6 syntax (`base-fret`, `frets`, `fingers`, `keys`, `copy`), `{chord: Am}` draws one chord where it is written, and `{instrument: piano}` draws piano diagrams. With `{capo}`, guitar diagrams show the shapes you play and piano diagrams the chords that sound, titled "G (sounds A)". A `{define}` or `{chord}` with a mistake shows a message at the top of the chart, and `check` reports it (#10).
- **More text tabs**: the text tab converter reads drum tabs (`HH|x-x-x-x-|`) as a drum track, strings numbered `1|` to `6|`, one named string or a few, text after the last bar line (`| let ring`, `|x2`) as a note on the last beat, and systems with no blank line between them. Before, numbered strings were read as notes, a tab with only `e B G D` came out an octave too low, drum tabs and single lines weren't read, and text after the last bar line dropped its whole string (#37).
- Transposed chords are spelled for the new key. A ChordPro chart with `{key: G}` moved down a half step now gives F# B C#, and D/F# becomes C#/E#. Before, it gave Gb B Db. Charts without a key are unchanged.
- In `tab` blocks, each staff gets what suits it: tablature for guitars and basses, notation for drums, in alphaTex and in Guitar Pro files. Before, a drum track drew nothing in a `tab` block. Drum staves get the percussion clef; before, drums written in alphaTex without a clef got a treble clef.
- Chord symbols take double sharps and double flats on roots and basses: `F##dim` (or `Fxdim`), `Ebb`.
- Obsidian Publish: `strum`, `progression` and `circle` are new block languages. Add them to the language list in your `publish.js` (see the guide's Publish page), or those blocks stay code.
- For apps: `followNotes`, `noteTargets`, `PLAYING_CLASS` and `START_WAIT` light notes for your own players. A `NotePlayer` gets `onStart` in its play options (call it when the notes really start sounding) and can set `reportsStart: true` so the bar waits for it; a `NoteEvent` can carry a `velocity` (1–127). Strumming: `parseStrum`, `formatStrum`, `renderStrum`, `playStrum`, `strumEvents`, `scoreOf`, `strumVoicing`. Harmony: `findScales`, `findKey`, `inKey`, `scalesForChord`, `chordsInScale`, `readKey`, `keyNotes`, `keySignature`, `keyChords`, `parentMajor`, `keyProblem`, `progressionChords`, `readNumeral`, `numeralOf`, `harmonicFunction`, `voiceLead`, `renderCircle`. Capo: `soundingChord`, `soundsLike`, `fretsFromCapo`, `capoTuning`, `parseCapo`, `parseFretsFrom`, `capoCaption`, `MAX_CAPO`, and the `capo`, `fretsFrom`, `sounds` and `caption` options of `renderGuitarDiagram` and `renderFretboard`. Piano: `pianoVoicing`, `pianoPitches`, `triadFingering`, and `hands` on `renderKeyboard`. Arpeggios: `isArpeggio`. ChordPro: the `chartDiagrams` render option, `renderChart`'s `diagrams` and `instrument` options, `chordsUsed`, `parseDefinition`. `transposeChord` takes `keyMove(key, semitones)` as its third argument to spell chords for the new key.

## 0.7.0 (2026-11-03)

- **The other instrument, drawn**: the play bar's sound menu now redraws the diagram for the instrument you choose, with the same notes. If something is playing, it stops first. A guitar chord or a fretboard becomes a keyboard with those exact keys, and a keyboard becomes a fretboard. The title, the root and the note, degree or interval labels come along. Choose the diagram's own instrument to get its drawing back. A click on a note plays it on either drawing.
- **Piano through the soundfont**: the soundfont player now plays piano, not only guitar. Before, in apps that use it (Music Practice does), keyboards and piano chords played nothing, and choosing Piano on a fretboard changed nothing.
- A scale on a fretboard or a keyboard now plays every note drawn, from the lowest to the highest and back down, with the top note once. Before, it played only from its lowest root to its highest one, so the dots outside the roots stayed silent: A minor pentatonic box 1 dropped its top C5, and boxes 2 to 4 played 6 of their 12 dots.
- **Fingering on note lists**: `fingering:` works on keyboard note lists, one finger per note in the order written, so you can draw five-finger and hand positions. `notes: C D E F G` with `fingering: 1 2 3 4 5` puts fingers 1 to 5 on C4 to G4, and `labels:` works as for scales. Before, the line was ignored (#55).
- `root:` in a `chord` block is now an error that says it only applies to note lists on fretboards and keyboards. Before, it did nothing (#56).
- Five notes or more that only move by steps within an octave are no longer named as a chord: `C4 D4 E4 F4 G4` is a hand position, not Dm11/C, and gets no root marks. Chords with a step in them keep their names, from Cadd9 and Csus2 to four-note jazz clusters such as Cmaj9/B (#57).
- For apps: `sequenceOf` no longer takes a root, and diagrams no longer carry `data-mn-root`.

## 0.6.0 (2026-11-03)

- **A root for note lists**: `root: C` gives a list of notes (`notes: C Eb Gb A`) a root, on fretboards and keyboards. `labels: intervals` and `labels: degrees` then count from it, and the root gets the root color when it is in the list. It doesn't have to be (#33).
- **Positions in neck order**: `positions: all` draws a scale's positions up the neck, each one at or above the one before. A minor pentatonic's boxes 4 and 5 now sit at frets 12–15 and 14–17, not 0–3 and 2–5. A list of positions (`positions: 1 3`) keeps those frets (#34).
- **One position where you want it**: a single `position:` with `frets:` is drawn inside those frets, so `position: 4` with `frets: 10-17` is box 4 at frets 12–15. When no octave of it fits, the block says so (#34).
- **Numbering from the relative minor**: `numbering: minor` counts a major pentatonic's positions from its relative minor, as many courses do. A major pentatonic's position 1 is then box 1 of F# minor pentatonic, and the titles add "(from F#m)" (#34).
- **Check your notes**: `npx @dsebastien/music-notation check notes/` (or `bunx`) draws every notation block of your Markdown files and lists the mistakes, one per line. It exits with 0 when every block draws, 1 when a block has a mistake, and 2 when the command itself is wrong. `--describe` prints what each block draws, and `--json` prints the same as JSON. Like Obsidian, it ignores blocks in comments and in indented code, and it counts empty blocks apart, not as mistakes (#35).
- For apps and tools: diagrams carry data attributes that describe what they draw (`data-mn-string`, `data-mn-fret`, `data-mn-note`, `data-mn-chord`, `data-mn-set`, `data-mn-frets`, `data-mn-key`).

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
