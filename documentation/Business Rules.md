# Business Rules

- **Block languages**: `chord`, `chords`, `keyboard`, `fretboard` (0.1); `tab` and its alias `score` (0.2). Fence names are stable API: never rename one.
- **Block syntax**: `key: value` lines, keys case-insensitive, last value wins; an optional first line without a key is the block's shorthand. Any other line without a key is an error.
- **Errors**: a block with a mistake renders an inline message (what's wrong and what to write) and never throws. On Publish its source stays visible.
- **Publish**: blocks are rendered once (`data-mp-rendered` on the `<pre>`: `pending`, `done`, `error`); the source `<pre>` is hidden only after a successful render; the page is watched (MutationObserver, one pass per frame) because Publish swaps content as you navigate.
- **Guitar chords**: frets and fingers are listed lowest string first; `x` = muted, `0` = open; the first fret shown is 1 when every fretted note is within frets 1–4, else the lowest fretted fret, unless `position` is given; a finger on the same fret across 2+ strings is a barre. The chord's root is marked when the tuning is known (6 strings default to standard).
- **Piano chords**: from a symbol, root position stacked upwards from middle C (C4 = MIDI 60); a slash chord's bass an octave below; `fingering` maps to keys low to high.
- **Note sets** (keyboard, fretboard): from a scale, a chord, or a list; a list with octaves highlights those exact keys, otherwise every octave. The root (scales, chords) gets its own color. Interval labels are written the way musicians do (R, b3, 3, #4, b7).
- **Keyboard range**: two octaves from middle C by default; whole octaves around exact pitches; a range never starts or ends on a black key.
- **Fretboard**: high string on top (tab convention); frets 0–12 by default; up to fret 36.
- **Transposition**: chords keep their own spelling (sharps or flats) unless a key decides; keys use their usual spelling (F♯ over G♭, D♭ over C♯, B♭m over A♯m).
- **ChordPro**: unknown directives are ignored; `#` lines are comments; tab and grid sections are shown as written.
- **Licenses**: MIT library; dependencies MIT-compatible, alphaTab (MPL-2.0) unmodified; no GPL.
