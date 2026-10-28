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

The short form is `symbol frets fingers`. The same chord with keys:

````markdown
```chord
symbol: A
frets: x02220
fingers: x01230
title: A (open)
```
````

| Key          | Meaning                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `symbol`     | Chord symbol: `A`, `F#m7`, `C/G`. Its root notes are highlighted. Also the title, unless `title` is set.       |
| `frets`      | One per string, lowest string first. `x` = muted, `0` = open. Above fret 9, separate them: `x-10-12-12-11-10`. |
| `fingers`    | One per string: `1`–`4`, `T` (thumb); `0` or `x` = none. The same finger on the same fret draws a barre.       |
| `voicing`    | With only a symbol, the n-th voicing from the built-in database (1 = the most common).                         |
| `position`   | The first fret shown. Computed when absent.                                                                    |
| `tuning`     | For other tunings or instruments: `Drop D`, `DADGAD`, `E2 A2 D3 G3`, `ukulele`…                                |
| `instrument` | `piano` draws a keyboard.                                                                                      |
| `pitches`    | Piano: `A3 C#4 E4`, or `A C# E` (stacked upwards from middle C).                                               |
| `fingering`  | Piano: one finger per key, low to high: `5-3-1`.                                                               |
| `title`      | The title shown above.                                                                                         |

A piano chord from its symbol is voiced in root position from middle C; a slash chord's bass goes an octave below.

````markdown
```chord
C/G
instrument: piano
fingering: 5-1-2-4
```
````

## Keyboard

A piano keyboard with the notes of a scale, a chord or a list.

````markdown
```keyboard
D dorian
labels: degrees
```
````

| Key      | Meaning                                                                                      |
| -------- | -------------------------------------------------------------------------------------------- |
| `scale`  | `C major`, `A minor pentatonic`, `D dorian`, `E harmonic minor`…                             |
| `chord`  | `Cmaj7`, `G7`, `F#m7b5`…                                                                     |
| `notes`  | `C E G` (every octave), or `C4 E4 G4` (those keys only).                                     |
| `range`  | Keys shown: `C3-B4`. Two octaves from middle C by default; whole octaves around exact notes. |
| `labels` | `notes` (default), `degrees`, `intervals` (R, b3, 5…), `none`.                               |
| `title`  | The title shown above.                                                                       |

The short first line is tried as a scale, then a chord, then a list of notes. The root is drawn in a second color.

## Fretboard

A guitar (or any fretted instrument) neck with the notes of a scale, a chord or a list.

````markdown
```fretboard
scale: A minor pentatonic
frets: 5-8
labels: intervals
```
````

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

Supported:

- Song details: `{title}` (`{t}`), `{subtitle}` (`{st}`), `{artist}`, `{key}`, `{capo}`, `{tempo}`, `{time}`.
- Sections: verse, chorus, bridge (`{start_of_verse}`, `{sov}`, `{soc}`, `{sob}`…), with an optional label (`{start_of_verse: Verse 2}`); tab and grid sections are shown as written.
- Comments: `{comment}` (`{c}`), and lines starting with `#` are skipped.
- `{transpose: 2}`: chords and key move by that many semitones, spelled for the new key.

Other directives are ignored.
