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

| Field       | Meaning                               |
| ----------- | ------------------------------------- |
| `ok`        | Whether it rendered.                  |
| `el`        | The block's container.                |
| `error`     | The message shown when `ok` is false. |
| `destroy()` | Removes the container.                |

Options:

- `voicings`: finds guitar voicings for chord blocks that only give a symbol. Pass `lookupGuitarVoicing` from `@dsebastien/music-notation/voicings` (about 2,000 voicings, ~230 KB), or your own `(symbol, index) => FrettedVoicing | null`.
- `transpose`: semitones added to `chords` blocks.

Everything is created in `host.ownerDocument`, so popout windows work.

## Renderers and theory

- `renderGuitarDiagram(doc, voicing, options)`, `renderKeyboard(doc, noteSet, options)`, `renderFretboard(doc, noteSet, options)`, `renderChart(doc, song, options)`.
- `parseChordPro(text)`, `parseFrets(text)`, `parseFingers(text)`, `parseTuning(text)`, `parseKeyRange(text)`.
- `parseChord(symbol)`: root, quality, bass and an ASCII name (`F Sharp Minor 7`).
- `transposeChord(symbol, semitones, preferFlats?)`, `transposeKey(key, semitones)`.
- `chordNoteSet(symbol)`, `scaleNoteSet(name)`, `listNoteSet(text)`: the notes, root, degrees and intervals that keyboards and fretboards draw.

## Styles

`injectStyles(document)` adds the stylesheet once; or ship `@dsebastien/music-notation/music-notation.css`. Colors use CSS variables (`--mn-accent`, `--mn-root`, `--mn-fg`, `--mn-muted`…) that default to Obsidian's theme variables, with fallbacks elsewhere. Override them on `.mn-block`.

## Browser bundle

`dist/music-notation.publish.min.js` renders every notation block on the page and exposes the API (plus `lookupGuitarVoicing` and `stop()`) as `window.MusicNotation`. See [Obsidian Publish](publish.md).
