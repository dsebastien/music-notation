# Changelog

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
