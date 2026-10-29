---
title: Blocks
nav_order: 2
---

# Blocks

A block is a fenced code block. Its language picks what's drawn: `chord`, `keyboard`, `fretboard` or `chords`. Inside, one `key: value` per line; most blocks also accept a short first line without a key. `chord`, `keyboard` and `fretboard` blocks can hold [several diagrams](#several-diagrams), drawn [vertically or horizontally](#orientation-and-left-handed-diagrams).

## Chord

A guitar diagram, or a piano chord.

````markdown
```chord
A x02220 x01230
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">A x02220 x01230</code></pre></div>

The short form is `chord frets fingers`, the chord as a symbol or in words (`A Major x02220 x01230`). The same chord with keys:

````markdown
```chord
symbol: A
frets: x02220
fingers: x01230
title: A (open)
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">symbol: A
frets: x02220
fingers: x01230
title: A (open)</code></pre></div>

| Key           | Meaning                                                                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `symbol`      | Chord symbol (`A`, `F#m7`, `B♭`, `C/G`, `C6/9`) or name in words (`A Major`, `F Sharp Minor 7`, `C Major over G`). Its root notes are highlighted. Also the title, unless `title` is set. A symbol the library doesn't know still works with `frets`, without root marks. |
| `frets`       | One per string, lowest string first. `x` = muted, `0` = open. Above fret 9, separate them: `x-10-12-12-11-10`.                                                                                                                                                            |
| `fingers`     | One per string: `1`–`4`, `T` (thumb); `0` or `x` = none. The same finger on the same fret draws a barre.                                                                                                                                                                  |
| `voicing`     | With only a symbol, the n-th voicing from the built-in database (1 = the most common).                                                                                                                                                                                    |
| `position`    | The first fret shown; at most the lowest fretted note. Computed when absent.                                                                                                                                                                                              |
| `tuning`      | For other tunings or instruments: `Drop D`, `DADGAD`, `E2 A2 D3 G3`, `ukulele`…                                                                                                                                                                                           |
| `instrument`  | `piano` draws a keyboard.                                                                                                                                                                                                                                                 |
| `pitches`     | Piano: `A3 C#4 E4`, or `A C# E` (stacked upwards from middle C).                                                                                                                                                                                                          |
| `fingering`   | Piano: one finger per key, low to high: `5-3-1`. Shown on the keys (`labels: notes` shows note names instead).                                                                                                                                                            |
| `title`       | The title shown above.                                                                                                                                                                                                                                                    |
| `name`        | Also the title; when it reads as a chord (`name: A`, `name: A Major`), its root notes are highlighted too.                                                                                                                                                                |
| `orientation` | `vertical` (default for guitar) or `horizontal`; piano chords are `horizontal` by default. See [orientation](#orientation-and-left-handed-diagrams).                                                                                                                      |
| `hand`        | `left` mirrors the diagram for left-handed players.                                                                                                                                                                                                                       |

Without a symbol or name, the chord is recognized from its `frets` (in the block's tuning) or `pitches`, and titled with what it found: `frets: x02220` draws an A diagram. Common chords come first, so `E4 G4 C5` reads as C/E. A chord the library doesn't recognize says what to write instead.

A piano chord from its symbol is voiced in root position from middle C; a slash chord's bass goes an octave below.

````markdown
```chord
C/G
instrument: piano
fingering: 5-1-2-4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">C/G
instrument: piano
fingering: 5-1-2-4</code></pre></div>

## All the ways to play a chord

`voicings:` draws every playable way to play a guitar chord, easiest first, in a row. The library finds them from the chord's notes, so it works for any chord, any tuning and up to 8 strings.

````markdown
```chord
A Major
voicings: 6
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">A Major
voicings: 6</code></pre></div>

Narrow them down: C between frets 3 and 9, without open strings, four columns:

````markdown
```chord
C
voicings: all
area: 3-9
open: no
columns: 4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">C
voicings: all
area: 3-9
open: no
columns: 4</code></pre></div>

| Key           | Meaning                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `voicings`    | `all` (at most 32), or how many: the easiest first.                                                                             |
| `area`        | The frets the fretted notes stay within: `5-9` (`0-3` starts at the nut), or `open` (frets 1–4).                                |
| `root-string` | The string the bass note is on, counted the way guitarists do: 1 is the highest string, 6 the lowest. `6` gives E-shape chords. |
| `strings`     | The strings that may sound: `1-3` (the three highest), `2-4`, or a list (`1 2 3`; strings apart, like `1 2 4`, need `gaps`).    |
| `inversion`   | The chord's note in the bass: `0` (root, the default), `1`, `2`, `3` (usually the third, fifth, seventh), or `any`.             |
| `stretch`     | `yes`: the hand may cover five frets instead of four.                                                                           |
| `open`        | `no`: no open strings.                                                                                                          |
| `gaps`        | `yes`: muted strings may sit between sounding ones (jazz shells).                                                               |

`tuning`, `orientation`, `hand`, `labels`, `columns` and `title` work as in any row (`title` replaces the chord in each diagram's title). `frets`, `fingers`, `voicing`, `position` and piano keys can't be used with `voicings:`.

On a re-entrant tuning (a ukulele's high G string), any chord note may be lowest unless `inversion` says otherwise, so the usual shapes (F `2010`, G `0232`) come first. On 7 or 8 strings, use one of `gaps`, `stretch` and a wide `area` at a time, and `inversion: any` with six `strings` or fewer: there are many more combinations to go through.

Each voicing must sound the root, the third (or the sus note), the seventh or sixth, altered notes and the highest extension; the perfect fifth and lower extensions may be left out. A slash chord keeps its bass lowest. Fingers are worked out: any finger can hold a note or barre a few strings on one fret, only the index can lie across strings fretted higher (a full barre), the finger numbers go up with the frets, and at most four fingers in all; the easiest way wins (a small index barre over the top strings, like F `xx3211`, counts as easy). Muted strings between sounding ones are left out unless `gaps: yes`.

Easiest first means: the open chords guitarists learn first (C, A, G, E, D, Am, Em, Dm, their sevenths, sus and add9 shapes), then fewer fingers, a smaller span, no full barre, reach or awkward fingering, the usual shapes (E- and A-shape barres, the CAGED shapes), all strings sounding (a muted high string costs more than a muted low one), no open string ringing inside a shape up the neck, lower on the neck. Each diagram is titled with the chord and its shape when it has a usual one.

`voicing: 3` (singular) still picks the third voicing of the built-in database (see [Examples](examples.html)).

## Keyboard

A piano keyboard with the notes of a scale, a chord or a list.

````markdown
```keyboard
D dorian
labels: degrees
```
````

<div class="mn-live" markdown="0"><pre><code class="language-keyboard">D dorian
labels: degrees</code></pre></div>

| Key                    | Meaning                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `scale`                | `C major`, `A minor pentatonic`, `D dorian`, `E harmonic minor`…                                  |
| `chord`                | `Cmaj7`, `G7`, `F#m7b5`…                                                                          |
| `notes`                | `C E G` (every octave), or `C4 E4 G4` (those keys only).                                          |
| `range`                | Keys shown: `C3-B4`. Two octaves from middle C by default; whole octaves around exact notes.      |
| `labels`               | `notes` (default), `degrees` (a chord's 1 3 5 7, a scale's 1–7), `intervals` (R, b3, 5…), `none`. |
| `title`                | The title shown above.                                                                            |
| `orientation`          | `horizontal` (default) or `vertical`: low notes at the bottom.                                    |
| `highlight`, `compare` | See [scales and modes](#scales-and-modes).                                                        |
| `fingering`            | For a scale: one finger per note of one octave from the root, `1 2 3 1 2 3 4 5`.                  |
| `modes`                | `modes: C major`: every mode of the scale, side by side.                                          |     |

The short first line is tried as a scale, then as notes with octaves (`C4` is that key), then as a chord, then as a list of notes. The root is drawn in a second color.

## Fretboard

A guitar (or any fretted instrument) neck with the notes of a scale, a chord or a list.

````markdown
```fretboard
scale: A minor pentatonic
frets: 5-8
labels: intervals
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">scale: A minor pentatonic
frets: 5-8
labels: intervals</code></pre></div>

| Key                                          | Meaning                                                                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `scale`, `chord`, `notes`                    | As for keyboards.                                                                                                                               |
| `frets`                                      | Frets shown: `5-8`. `0-12` by default; from `0`, open strings are shown left of the nut.                                                        |
| `tuning`                                     | `standard` (default), `Drop D`, `DADGAD`, `open G`, `open D`, `open E`, `half step down`, `bass`, `ukulele`, or notes: `DADGAD`, `E1 A1 D2 G2`. |
| `labels`                                     | `notes` (default), `degrees`, `intervals`, `none`.                                                                                              |
| `title`                                      | The title shown above.                                                                                                                          |
| `orientation`                                | `horizontal` (default, the high string on top, as in tabs) or `vertical` (the nut on top, as a chord diagram).                                  |
| `hand`                                       | `left` mirrors the neck for left-handed players.                                                                                                |
| `position`, `shape`                          | One position of a scale instead of every note. See [scales and modes](#scales-and-modes).                                                       |
| `highlight`, `compare`, `modes`, `positions` | See [scales and modes](#scales-and-modes).                                                                                                      |

## Scales and modes

Scales are written as a root and a name: `A minor pentatonic`, `D dorian`, `E phrygian dominant`. The usual names work as written too: `Natural minor`, `Major pentatonic`, `Blues`, `Whole tone`, in any case. A name without a root says so ("Add a root note: C lydian").

**Characteristic notes.** Modes and blues scales mark the notes that set them apart in a third color: lydian #4, dorian 6, mixolydian b7, phrygian b2, locrian b5, aeolian b6, the blues b5. `highlight: none` turns it off, `highlight: characteristic` turns it on for any scale (harmonic minor 7, melodic minor 6 and 7…), and `highlight: b5 7` marks the intervals you list.

````markdown
```keyboard
C lydian
range: C4-B4
compare: major
```
````

<div class="mn-live" markdown="0"><pre><code class="language-keyboard">C lydian
range: C4-B4
compare: major</code></pre></div>

**Compare.** `compare: major` (or `compare: C major`) outlines the notes that differ from the other scale and draws its notes missing here faint: above, C lydian against C major.

**Positions.** On a fretboard, `position:` draws one place on the neck instead of every note, and the frets shown follow it:

- 5-note scales: the five boxes, `position: 1` to `5` (box 1 starts on the root on the low string).
- 7-note scales: the five CAGED positions, by number (`position: 1` is the E shape) or by shape: `shape: E` (the root on the low string), then up the neck `D`, `C`, `A`, `G`.
- Every position is drawn in the lowest octave where all its notes fit on the neck (box 5 of A minor pentatonic at frets 2–5; E major box 1 at 11–14).
- `shape: 3nps` with `position: 1` to `7`: three notes per string, from that degree. Scales with no pentatonic inside (locrian, harmonic minor…) use it for their CAGED positions too.
- `positions: all` (or a list, `positions: 1 3`) draws the positions side by side; with `shape: 3nps`, the 3NPS ones.

````markdown
```fretboard
labels: intervals
---
A minor pentatonic
position: 1
---
C major
shape: E
---
G major
shape: 3nps
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">labels: intervals
---
A minor pentatonic
position: 1
---
C major
shape: E
---
G major
shape: 3nps</code></pre></div>

**All the modes of a key.** `modes: C major` draws C ionian, D dorian, E phrygian… side by side, each with its characteristic note. Other keys in the block apply to every mode.

````markdown
```keyboard
modes: C major
range: C4-B4
columns: 4
```
````

<div class="mn-live" markdown="0"><pre><code class="language-keyboard">modes: C major
range: C4-B4
columns: 4</code></pre></div>

**Fingering** (keyboards): `fingering: 1 2 3 1 2 3 4 5` puts one finger on each note of one octave, from the root.

Known scales: altered, augmented, bebop (major, minor, locrian), blues (minor, major, composite), chromatic, diminished, dorian (and #4, b2), double harmonic major, egyptian, enigmatic, flamenco, harmonic major, harmonic minor, hirajoshi, hungarian major and minor, in-sen, iwato, kumoijoshi, locrian (and #2, 6, major), lydian (and #9, augmented, dominant, minor), major, major pentatonic, melodic minor, minor, minor pentatonic, mixolydian (and b6), neapolitan major, oriental, pelog, persian, phrygian, phrygian dominant, prometheus, scriabin, spanish heptatonic, ultralocrian, whole tone, and more: every scale [tonal](https://github.com/tonaljs/tonal) knows.

## From a note's properties

An empty `chord`, `fretboard` or `keyboard` block can draw what the note's properties say, so a note doesn't repeat its frets or its scale in the body. Apps pass the note's properties to the library (Music Practice does); on Obsidian Publish, see [Publish](publish.md). A block with content always draws its content.

| Properties                                     | Draws                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `chord_symbol`, `frets`, `fingers`, `position` | A guitar chord (`position` from 1; 0 or empty: computed).                      |
| `chord_symbol`, `pitches`, `fingering`         | A piano chord, when a tag has a `piano` segment (`type/music/piano/chord`).    |
| `scale_root`, `scale_type`, `shape`            | A scale on a fretboard; `shape` `Box 2`, `CAGED E` or `3NPS` picks a position. |
| `scale_root`, `scale_type`, `fingering_rh`     | A scale on a keyboard, with its fingering.                                     |

## Several diagrams

Separate diagrams with a line of three dashes (`---`) to draw them side by side: a song's chords, a progression, the positions of a scale. The row wraps on narrow screens.

````markdown
```chord
G 320003 210003
---
C x32010 x32010
---
D xx0232 xx0132
---
Em 022000 023000
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">G 320003 210003
---
C x32010 x32010
---
D xx0232 xx0132
---
Em 022000 023000</code></pre></div>

Settings for every diagram go in a first part, before the first `---`. It holds only shared keys: `orientation`, `hand` and `labels` for every block; `instrument`, `tuning` and `range` for chords; `range` for keyboards; `tuning` and `frets` for fretboards. A diagram's own keys win over them (an empty key, like `labels:` alone, keeps the shared value). `columns` draws a grid with at most that many columns (1 to 12); on narrow screens it wraps rather than shrinking the diagrams. With `columns`, any other key in that part is refused by name.

````markdown
```fretboard
frets: 5-8
labels: intervals
columns: 2
---
A minor pentatonic
---
title: A blues
scale: A blues
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">frets: 5-8
labels: intervals
columns: 2
---
A minor pentatonic
---
title: A blues
scale: A blues</code></pre></div>

A mistake in one diagram is shown in its place; the others still draw. A block holds at most 32 diagrams, each at most 12 strings or 88 keys. A block with only `---` lines draws nothing, like an empty one. Chord charts (`chords`) don't split: `---` is text there.

## Orientation and left-handed diagrams

`orientation: horizontal` turns a guitar chord sideways: the strings run across with the high string on top, as in tabs, and the nut is on the left.

````markdown
```chord
orientation: horizontal
---
A x02220 x01230
---
Bm x24432 x13421
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">orientation: horizontal
---
A x02220 x01230
---
Bm x24432 x13421</code></pre></div>

`orientation: vertical` stands a fretboard up, with the nut on top and the low string on the left, like a chord diagram, and draws a keyboard with its low notes at the bottom.

````markdown
```fretboard
A minor pentatonic
frets: 0-5
orientation: vertical
```
````

<div class="mn-live" markdown="0"><pre><code class="language-fretboard">A minor pentatonic
frets: 0-5
orientation: vertical</code></pre></div>

`hand: left` mirrors guitar chords and fretboards for left-handed players: the low string on the right, the nut on the right. Keyboards are the same for both hands.

````markdown
```chord
hand: left
---
A x02220 x01230
---
E 022100 023100
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">hand: left
---
A x02220 x01230
---
E 022100 023100</code></pre></div>

Text always stays upright. Apps using the library can set the default orientation per block and the hand (Music Practice has settings for them); on Obsidian Publish, see [Publish](publish.md).

## Chords (ChordPro)

A chord chart: chords above the lyrics, in [ChordPro](https://www.chordpro.org/) format.

````markdown
```chords
{title: Example}
{artist: Someone}
{key: G}
{capo: 2}

[G]Hello [D/F#]little [Em]world

{start_of_chorus}
[C]La la [G]la
{end_of_chorus}
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chords">{title: Example}
{artist: Someone}
{key: G}
{capo: 2}

[G]Hello [D/F#]little [Em]world

{start_of_chorus}
[C]La la [G]la
{end_of_chorus}</code></pre></div>

Supported:

- Song details: `{title}` (`{t}`), `{subtitle}` (`{st}`), `{artist}`, `{key}`, `{capo}`, `{tempo}`, `{time}`.
- Sections: verse, chorus, bridge (`{start_of_verse}`, `{sov}`, `{soc}`, `{sob}`…), with an optional label (`{start_of_verse: Verse 2}`); tab and grid sections are shown as written.
- Comments: `{comment}` (`{c}`), and lines starting with `#` are skipped.
- `{transpose: 2}`: chords and key move by that many semitones, spelled for the new key.
- Long lyric lines wrap on narrow screens.

Other directives are ignored.
