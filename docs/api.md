---
title: JavaScript API
nav_order: 6
---

# JavaScript API

```bash
npm install @dsebastien/music-notation
```

## Render a block

```ts
import { renderBlock, injectStyles, isNotationLanguage } from '@dsebastien/music-notation'
import { lookupGuitarVoicing } from '@dsebastien/music-notation/voicings'

injectStyles(document)
const result = renderBlock('chord', 'Am', container, { voicings: lookupGuitarVoicing })
```

`renderBlock(language, source, host, options)` appends a `div.mn-block` to `host`, never throws, and returns:

| Field       | Meaning                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ok`        | Whether it rendered.                                                                                                     |
| `el`        | The block's container.                                                                                                   |
| `error`     | The message shown when `ok` is false; for several diagrams, each failing one's (`diagram 2: …`), the others still drawn. |
| `destroy()` | Removes the container.                                                                                                   |

Options:

- `voicings`: finds guitar voicings for chord blocks that only give a symbol. Pass `lookupGuitarVoicing` from `@dsebastien/music-notation/voicings` (about 1,800 voicings by symbol, ~230 KB), or your own `(symbol, index) => FrettedVoicing | null`.
- `transpose`: semitones added to `chords` blocks.
- `orientation`: the default per block language, `{ chord, keyboard, fretboard }`, each `'vertical'` or `'horizontal'`. Piano chords follow `keyboard`. A block's own `orientation` wins.
- `hand`: `'left'` mirrors guitar chords and fretboards unless a block says `hand: right`.

- `properties`: the note's properties, or a function of the block's element returning them (read at each render): an empty `chord`, `fretboard` or `keyboard` block draws from them. `propertyNames` renames them; `instrument` (`'guitar'` or `'piano'`) overrides the one read from the tags.

`layoutDefaults(value)` keeps only valid `orientation` and `hand` values from untrusted input (a page's settings). `MAX_DIAGRAMS` is the most diagrams one block may hold (32).

Everything is created in `host.ownerDocument`, so popout windows work.

## Renderers and theory

- `renderGuitarDiagram(doc, voicing, options)`, `renderKeyboard(doc, noteSet, options)`, `renderFretboard(doc, noteSet, options)`, `renderChart(doc, song, options)`. The diagram renderers take `orientation`, and guitar diagrams and fretboards take `hand`.
- `parseOrientation(text)`, `parseHand(text)`: read a block's value or throw a message for the user.
- `parseChordName(text)`: a chord name in words (`F Sharp Minor 7`) as a parsed chord; `readChord(text)` takes a symbol or words; `suggestChords(text)` says what to write instead.
- `generateVoicings(symbol, options)`: every playable voicing of a chord, easiest first: `{ frets, fingers, baseFret, bassString, inversion, shape, difficulty, reasons }`. Options: `tuning`, `area` (`[5, 9]` or `'open'`), `bassString` and `strings` (1 = the highest string), `inversion` (the chord's note in the bass, 0–3, or `'any'`; any by default on re-entrant tunings), `maxSpan` (4, at most 6), `allowOpen`, `minStrings`, `gaps`, `maxFret` (15). Up to `MAX_GENERATED_STRINGS` (8) strings.
- `fingerVoicing(frets)`: the easiest fingers for frets (any finger may barre a few strings on one fret, only the index across strings fretted higher, at most four), null when a hand can't play them. `voicingShape(frets, symbol, tuning?)`: `Open`, `E-shape barre`, `A-shape barre`, `CAGED C`… `CAGED D`, `Power chord`, `Triad`, `Shell`, `Other barre`, or null.
- `triadVoicings(chord, { strings, inversion, tuning })`: close triads on a string set, up the neck, with their `inversion` and `top` note (R, 3, 5); `keyTriads(key, { strings, inversion })`: a key's seven triads with their numerals; `parseKey(text)`, `inversionName(n)`.
- `transition(fromFrets, toChord, { tuning, fromFingers })`: the next chord's voicings, easiest to reach first, with `anchors`, `guides` (string indexes), `shift`, `movement` and `tips` in plain words; `smoothProgression(chords, { tuning })`: the voicings that make a progression easiest.
- Playback: `sequenceOf(kind, pitches, { bpm, strum })` (the notes a chord or scale plays, timed), `lightPlayer(window)` (the light synthesizer: `pluckedString`, `pianoTone`), `attachPlayback(el, options)` (the bar). The `play` render option (`true`, or `{ player, sound, volume, bpm, strum }`) adds the bar to every diagram; `player` is a `NotePlayer` or a function returning one at each play, given the diagram's window (popouts have their own).
- `detectChordFromFrets(frets, tuning?)`, `detectChordFromPitches(midis)`: the chord played, `{ symbol, readings }`.
- `scaleName(text)` (the usual names as tonal knows them), `modesOf(scale)`, `scaleTypes()`, `characteristicIntervals(type)`.
- `scalePosition(noteSet, tuning, 'box' | 'caged' | '3nps', n, { within, numbering })`: the notes of one position, `{ string, fret }[]`, in its lowest octave (or the lowest one inside the `within` frets). `numbering: 'minor'` counts a major pentatonic's positions from its relative minor. `neckPositions(noteSet, tuning, system, numbering?)`: every position in neck order. Also `positionCount(noteSet, system)` and `MAX_FRET` (36, the highest fret a fretboard draws).
- `blockFromProperties(language, properties, { names, instrument })`: a block's source from a note's properties; `DEFAULT_PROPERTY_NAMES`, `instrumentOf(properties, names)`.
- `parseChordPro(text)`, `parseFrets(text)`, `parseFingers(text)`, `parseTuning(text)`, `parseKeyRange(text)`.
- `parseChord(symbol)`: root, quality, bass and an ASCII name (`F Sharp Minor 7`).
- `transposeChord(symbol, semitones, preferFlats?)`, `transposeKey(key, semitones)`.
- `chordNoteSet(symbol)`, `scaleNoteSet(name)`, `listNoteSet(text, root?)`: the notes, root, degrees and intervals that keyboards and fretboards draw (a list's intervals count from `root`).
- `findScales(notesOrChords, { as, maxOutside, limit })`: the scales that hold some notes or the notes of some chords, best first, each `{ name, tonic, type, notes, missing, outside }` (`missing`: scale notes not played; `outside`: notes played that aren't in the scale). `as` is `'notes'` or `'chords'`; by default a list of plain note names is notes, anything else chords. Up to `maxOutside` (1) outside notes, `limit` (20) scales.
- `findKey(chords)`: the likeliest key of a progression, `{ tonic, mode, name, score, outside, candidates, clear }`; `clear` is false when another key scores about as well (`candidates` lists them). `inKey(chord, key)`: whether every note of a chord is in a key (a minor key's V and vii° count).
- `scalesForChord(symbol)`: the scales on a chord's root that hold all its notes, best first (`Cmaj7`: C major, C lydian…; `Dm7`: D minor, D dorian, D phrygian…). `chordsInScale(scale)`: each note's triad and seventh chord stacked in thirds (seven-note scales) with the triad's numeral, and every common chord whose notes are all in the scale.
- `progressionChords(numerals, key)`: roman numerals (`I V vi IV`, `ii7 V7 Imaj7`, `bVII`, `V/V`, `I/3`), Nashville numbers (`1 5 6m 4`) or chord names in a key, each `{ written, symbol, numeral, nashville, function }`; null when the key or a chord doesn't read. `readNumeral(numeral, key)`: one numeral's chord symbol. `numeralOf(symbol, key, 'roman' | 'nashville')`: a chord's numeral (`D7` in C is `V7/V`). `harmonicFunction(symbol, key)`: `tonic`, `subdominant`, `dominant`, `secondary dominant`, `borrowed` or `chromatic`.
- `voiceLead(symbols)`: piano pitches for each chord, each in the inversion closest to the one before.
- `readKey(text)`: `G`, `Em`, `F# minor`, `D dorian` as `{ tonic, mode, name }`; `keyNotes(key)`, `keySignature(key)` (`{ count, accidentals }`: F# major is 6, F# C# G# D# A# E#), `keyChords(key, sevenths?)` (the seven chords with their numerals), `parentMajor(key)`, `signatureText(count)`, `MODES`.

## Styles

`injectStyles(document)` adds the stylesheet once; or ship `@dsebastien/music-notation/music-notation.css`. Colors use CSS variables (`--mn-accent`, `--mn-root`, `--mn-fg`, `--mn-muted`…) that default to Obsidian's theme variables, with fallbacks elsewhere. Override them on `.mn-block`.

## Browser bundle

`dist/music-notation.publish.min.js` renders every notation block on the page and exposes the API (plus `lookupGuitarVoicing` and `stop()`) as `window.MusicNotation`. It reads `window.musicNotationOptions` (`orientation`, `hand`) when the page sets it before loading. See [Obsidian Publish](publish.md).

## Tabs and scores

`@dsebastien/music-notation/tab` draws `tab` and `score` blocks with [alphaTab](https://alphatab.net) (MPL-2.0). alphaTab isn't bundled: pass its module (the UMD build, `window.alphaTab`), the music font and the soundfont.

```ts
import { renderTab } from '@dsebastien/music-notation/tab'

const result = renderTab('tab', source, container, {
    alphaTab: window.alphaTab,
    assets: {
        scriptFile: null,
        font: 'https://…/Bravura.woff2',
        soundFont: 'https://…/sonivox.sf3'
    },
    resolveFile: async (link) => bytesOf(link) // for file: [[Song.gp]]
})
const { ok, error } = await result.ready
```

- `scriptFile`: a same-origin URL of alphaTab's script to render and play in workers; `null` works on the main thread. `soundFont` may be bytes. Pass the module of the window the block is in: objects alphaTab checks with `instanceof` are made there, so popout windows work.
- `renderTab` never throws. `ready` settles once and never rejects: `{ ok, error }` when drawn or failed (the message is also shown in the block), `{ ok: false, error: null }` when destroyed first. `result.api` is alphaTab's API once made (`onApi` is called then); `result.destroy()` frees alphaTab, its player and the element.
- `player: false` leaves out the player bar. With the bar, the player (audio, synthesizer, soundfont) starts at the first Play; when it can't, the score stays and Play is disabled with the reason.
- `printTab(result)`: prints a drawn score in black on white, whatever the theme (throws when it isn't drawn yet).
- `parseTabSource(language, source)`: the block's `staves`, `file`, `tracks` and alphaTex.
- `soundfontPlayer(alphaTab, () => api)`, `createSoundfontPlayer(alphaTab, assets, document, fallback)`: a `NotePlayer` for the diagrams' playback through alphaTab's soundfont. alphaTab only loads the instruments its loaded song uses, so the api you give `soundfontPlayer` needs a song with guitar (program 25) and piano (program 0) tracks; `createSoundfontPlayer` loads one itself. `createSoundfontPlayer` makes its own hidden alphaTab instance at the first play (the first notes wait for the soundfont), plays through `fallback` (for example `lightPlayer(window)`) when the soundfont can't load, and has `destroy()`.
- `scoreToAlphaTex(alphaTab, bytes)` (Guitar Pro 3–8, MusicXML, Capella), `exportGp7(alphaTab, music)`, `exportMidi(alphaTab, music)` (alphaTex or file bytes); `textTabToAlphaTex(text)` (null when the text has no tab; reads bar lines, repeat signs, two-digit frets, and bass, 5- and 7-string tunings) and `chordSheetToChordPro(text)` (chords over lyrics, labeled chord lines such as `Intro: G D Em C`, repeat marks and N.C.) for pasted text (also in the main entry's converters).
- `alphaTabCdn(version)`: jsDelivr URLs of alphaTab's script, font and soundfont; `ALPHATAB_VERSION`.
