# Changelog

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
