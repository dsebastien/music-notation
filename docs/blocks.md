---
title: Blocks
nav_order: 2
---

# Blocks

A block is a fenced code block. Its language picks what's drawn: `chord`, `keyboard`, `fretboard` or `chords`. Inside, one `key: value` per line; most blocks also accept a short first line without a key.

## Chord

A guitar diagram, or a piano chord.

````markdown
```chord
A x02220 x01230
```
````

<div class="mn-live" markdown="0"><pre><code class="language-chord">A x02220 x01230</code></pre></div>

The short form is `symbol frets fingers`. The same chord with keys:

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

| Key          | Meaning                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `symbol`     | Chord symbol: `A`, `F#m7`, `B♭`, `C/G`, `C6/9`. Its root notes are highlighted. Also the title, unless `title` is set. A symbol the library doesn't know still works with `frets`, without root marks. |
| `frets`      | One per string, lowest string first. `x` = muted, `0` = open. Above fret 9, separate them: `x-10-12-12-11-10`.                                                                                         |
| `fingers`    | One per string: `1`–`4`, `T` (thumb); `0` or `x` = none. The same finger on the same fret draws a barre.                                                                                               |
| `voicing`    | With only a symbol, the n-th voicing from the built-in database (1 = the most common).                                                                                                                 |
| `position`   | The first fret shown; at most the lowest fretted note. Computed when absent.                                                                                                                           |
| `tuning`     | For other tunings or instruments: `Drop D`, `DADGAD`, `E2 A2 D3 G3`, `ukulele`…                                                                                                                        |
| `instrument` | `piano` draws a keyboard.                                                                                                                                                                              |
| `pitches`    | Piano: `A3 C#4 E4`, or `A C# E` (stacked upwards from middle C).                                                                                                                                       |
| `fingering`  | Piano: one finger per key, low to high: `5-3-1`. Shown on the keys (`labels: notes` shows note names instead).                                                                                         |
| `title`      | The title shown above.                                                                                                                                                                                 |
| `name`       | Also the title; when it's a chord symbol (`name: A`), its root notes are highlighted too.                                                                                                              |

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

| Key      | Meaning                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------- |
| `scale`  | `C major`, `A minor pentatonic`, `D dorian`, `E harmonic minor`…                                  |
| `chord`  | `Cmaj7`, `G7`, `F#m7b5`…                                                                          |
| `notes`  | `C E G` (every octave), or `C4 E4 G4` (those keys only).                                          |
| `range`  | Keys shown: `C3-B4`. Two octaves from middle C by default; whole octaves around exact notes.      |
| `labels` | `notes` (default), `degrees` (a chord's 1 3 5 7, a scale's 1–7), `intervals` (R, b3, 5…), `none`. |
| `title`  | The title shown above.                                                                            |

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

| Key                       | Meaning                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `scale`, `chord`, `notes` | As for keyboards.                                                                                                                               |
| `frets`                   | Frets shown: `5-8`. `0-12` by default; from `0`, open strings are shown left of the nut.                                                        |
| `tuning`                  | `standard` (default), `Drop D`, `DADGAD`, `open G`, `open D`, `open E`, `half step down`, `bass`, `ukulele`, or notes: `DADGAD`, `E1 A1 D2 G2`. |
| `labels`                  | `notes` (default), `degrees`, `intervals`, `none`.                                                                                              |
| `title`                   | The title shown above.                                                                                                                          |

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
