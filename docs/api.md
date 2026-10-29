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
- Playback: `sequenceOf(kind, pitches, { bpm, strum })` (the notes a chord or scale plays, timed), `lightPlayer(window)` (the light synthesizer: `pluckedString`, `pianoTone`), `attachPlayback(el, options)` (the bar). The `play` render option (`true`, or `{ player, sound, volume, bpm, strum }`) adds the bar to every diagram; `player` is a `NotePlayer` or a function returning one at each play.
- `detectChordFromFrets(frets, tuning?)`, `detectChordFromPitches(midis)`: the chord played, `{ symbol, readings }`.
- `scaleName(text)` (the usual names as tonal knows them), `modesOf(scale)`, `scaleTypes()`, `characteristicIntervals(type)`.
- `scalePosition(noteSet, tuning, 'box' | 'caged' | '3nps', n)`: the notes of one position, `{ string, fret }[]`; `positionCount(noteSet, system)`.
- `blockFromProperties(language, properties, { names, instrument })`: a block's source from a note's properties; `DEFAULT_PROPERTY_NAMES`, `instrumentOf(properties, names)`.
- `parseChordPro(text)`, `parseFrets(text)`, `parseFingers(text)`, `parseTuning(text)`, `parseKeyRange(text)`.
- `parseChord(symbol)`: root, quality, bass and an ASCII name (`F Sharp Minor 7`).
- `transposeChord(symbol, semitones, preferFlats?)`, `transposeKey(key, semitones)`.
- `chordNoteSet(symbol)`, `scaleNoteSet(name)`, `listNoteSet(text)`: the notes, root, degrees and intervals that keyboards and fretboards draw.

## Styles

`injectStyles(document)` adds the stylesheet once; or ship `@dsebastien/music-notation/music-notation.css`. Colors use CSS variables (`--mn-accent`, `--mn-root`, `--mn-fg`, `--mn-muted`…) that default to Obsidian's theme variables, with fallbacks elsewhere. Override them on `.mn-block`.

## Browser bundle

`dist/music-notation.publish.min.js` renders every notation block on the page and exposes the API (plus `lookupGuitarVoicing` and `stop()`) as `window.MusicNotation`. It reads `window.musicNotationOptions` (`orientation`, `hand`) when the page sets it before loading. See [Obsidian Publish](publish.md).

## Tabs and scores

`@dsebastien/music-notation/tab` draws `tab and `score blocks with [alphaTab](https://alphatab.net) (MPL-2.0). alphaTab isn't bundled: pass its module (the UMD build, `window.alphaTab`), the music font and the soundfont.

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

- `scriptFile`: a same-origin URL of alphaTab's script to render and play in workers; `null` works on the main thread. `soundFont` may be bytes.
- `parseTabSource(language, source)`: the block's `staves`, `file`, `tracks` and alphaTex.
- `soundfontPlayer(alphaTab, () => api)`, `createSoundfontPlayer(alphaTab, assets, document)`: a `NotePlayer` for the diagrams' playback through alphaTab's soundfont.
- `scoreToAlphaTex(alphaTab, bytes)` (Guitar Pro 3–8, MusicXML, Capella), `exportGp7(alphaTab, music)`, `exportMidi(alphaTab, music)` (alphaTex or file bytes); `textTabToAlphaTex(text)` and `chordSheetToChordPro(text)` for pasted text (also in the main entry's converters).
- `alphaTabCdn(version)`: jsDelivr URLs of alphaTab's script, font and soundfont; `ALPHATAB_VERSION`.
