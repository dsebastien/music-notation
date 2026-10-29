# Music Notation

Chord diagrams, piano keyboards, fretboards and ChordPro charts, rendered as SVG and HTML from small text blocks. No framework, no build step for pages that load the browser bundle. Made for [Obsidian](https://obsidian.md) (the [Music Practice](https://github.com/dsebastien/obsidian-music-practice) plugin and Obsidian Publish), usable on any web page.

![Chord diagrams, a piano chord, a keyboard, a fretboard and a chord chart](docs/images/overview.png)

## Blocks

Each block is a fenced code block whose language says what it draws:

````markdown
```chord
A x02220 x01230
```

```chord
C/G
instrument: piano
fingering: 5-1-2-4
```

```keyboard
D dorian
labels: degrees
```

```fretboard
scale: A minor pentatonic
frets: 5-8
labels: intervals
```

```chords
{title: Example}
{key: G}
[G]Hello [D/F#]little [Em]world
```
````

Chords in words or recognized from their frets, every way to play a chord, triads, chord transitions, scale positions and modes:

````markdown
```chord
F Sharp Minor 7
---
frets: x02220
```

```chord
A Major
voicings: 6
```

```chord
G
triads: 1-3
```

```chord
from: C x32010
to: Am
```

```fretboard
A minor pentatonic
positions: all
```

```keyboard
modes: C major
```
````

![A Major's easiest voicings, and G triads on the three highest strings](docs/images/voicings.png)

![G triads on the top strings, and the easiest ways from C to Am](docs/images/triads-transitions.png)

![A tab with its player](docs/images/tab.png)

Several diagrams side by side, separated by `---`, with shared settings first; vertical or horizontal, and left-handed:

````markdown
```chord
orientation: horizontal
hand: left
---
G 320003 210003
---
C x32010 x32010
```
````

The full syntax is in the [guide](https://dsebastien.github.io/music-notation/), with [live examples](https://dsebastien.github.io/music-notation/examples.html) and a [playground](https://dsebastien.github.io/music-notation/playground.html). Mistakes show an inline message and leave the source untouched.

## Install

```bash
npm install @dsebastien/music-notation
```

```ts
import { renderBlock, injectStyles } from '@dsebastien/music-notation'
import { lookupGuitarVoicing } from '@dsebastien/music-notation/voicings'

injectStyles(document)
const result = renderBlock('chord', 'Am', container, { voicings: lookupGuitarVoicing })
if (!result.ok) console.warn(result.error)
```

- `renderBlock(language, source, host, options)` appends the rendering to `host` and never throws. It returns `{ ok, el, error, destroy() }`.
- `@dsebastien/music-notation/voicings` adds about 1,800 guitar voicings, found by chord symbol (`chord` blocks with only a symbol). It's a separate entry point because the data weighs about 230 KB.
- **Hear the diagrams**: with the `play` option, a playback bar on each diagram (on hover): chords strum, scales go up and down, a click plays a note.
- **Tabs and scores**: `@dsebastien/music-notation/tab` draws `tab and `score blocks (alphaTex, or Guitar Pro and MusicXML files) with [alphaTab](https://alphatab.net), with a player; it also converts score files, text tabs and chord sheets, and exports Guitar Pro 7 and MIDI.
- `generateVoicings(symbol, options)` finds every playable voicing of a chord on any tuning, easiest first, with fingers and shape names; `fingerVoicing(frets)` fingers any voicing.
- The renderers (`renderGuitarDiagram`, `renderKeyboard`, `renderFretboard`, `renderChart`), the parsers and the theory helpers (`parseChord`, `transposeChord`, `chordNoteSet`, `scaleNoteSet`…) are exported too.
- Styles: `injectStyles(document)`, or ship `@dsebastien/music-notation/music-notation.css`. Colors follow Obsidian's theme variables, with fallbacks for any page.

## Obsidian Publish

Add this to your site's `publish.js`. It loads the bundle only on pages that have notation blocks:

```js
;(() => {
    const VERSION = '0.4.0'
    const SELECTOR = ['chord', 'chords', 'keyboard', 'fretboard']
        .map((l) => `pre > code.language-${l}`)
        .join(', ')
    let requested = false
    const load = () => {
        if (requested || !document.querySelector(SELECTOR)) return
        requested = true
        const script = document.createElement('script')
        script.src = `https://cdn.jsdelivr.net/npm/@dsebastien/music-notation@${VERSION}/dist/music-notation.publish.min.js`
        document.head.appendChild(script)
    }
    load()
    new MutationObserver(load).observe(document.body, { childList: true, subtree: true })
})()
```

The bundle renders every block, now and as you navigate, and hides a block's source only once it rendered.

## Credits and licenses

MIT. Built on [tonal](https://github.com/tonaljs/tonal) (MIT) for music theory and [chords-db](https://github.com/tombatossals/chords-db) (MIT) for guitar voicings.

## News & support

To stay up to date about this library, Obsidian in general, personal knowledge management and note-taking:

- Subscribe to [my newsletter](https://dsebastien.net/newsletter)
- Subscribe to [my YouTube channel](https://youtube.com/@dsebastien)
- Join the [Knowii community](https://www.store.dsebastien.net/product/knowii-community/)

If this is useful to you:

- [Become a GitHub Sponsor](https://github.com/sponsors/dsebastien)
- [Buy me a coffee](https://www.buymeacoffee.com/dsebastien)
- [Check out my products](https://store.dsebastien.net)
