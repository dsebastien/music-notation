---
title: Obsidian Publish
nav_order: 6
---

# Obsidian Publish

Obsidian Publish shows code blocks as code. To draw them, add this to your site's `publish.js` (create the file at the root of your vault and publish it):

```js
;(() => {
    const VERSION = '0.23.1'
    const CDN = `https://cdn.jsdelivr.net/npm/@dsebastien/music-notation@${VERSION}/dist`
    const selector = (languages) => languages.map((l) => `pre > code.language-${l}`).join(', ')
    const BLOCKS = selector([
        'chord',
        'chords',
        'keyboard',
        'fretboard',
        'strum',
        'picking',
        'progression',
        'circle'
    ])
    const TABS = selector(['tab', 'score'])
    const requested = new Set()
    const load = (file) => {
        if (requested.has(file)) return
        requested.add(file)
        const script = document.createElement('script')
        script.src = `${CDN}/${file}`
        document.head.appendChild(script)
    }
    const check = () => {
        if (document.querySelector(BLOCKS)) load('music-notation.publish.min.js')
        if (document.querySelector(TABS)) load('music-notation.tab.min.js')
    }
    check()
    new MutationObserver(check).observe(document.body, { childList: true, subtree: true })
})()
```

- The bundle is only downloaded on pages with notation blocks. The tab bundle (and alphaTab, its music font and soundfont, from jsDelivr) is only downloaded on pages with `tab` or `score` blocks.
- List `picking` too (0.11.0), so pages with only picking patterns load the bundle. A snippet from an older version doesn't have it.
- A fretboard with [`exercise:`](blocks.md#tab-exercises) puts its tab under the diagram as a `tab` block's source. The snippet then loads the tab bundle, which draws it.
- Diagrams play on a click, and each block gets one playback bar under it. They play with the light synthesizer, or with the soundfont once a page with tabs has loaded it. `play: false` turns playback off, and `play: { volume: 0.6, bpm: 80, strum: 30, sound: 'piano' }` sets the defaults. The bars have no volume control: `volume` (0 to 1, 0.8 by default) is the volume of the whole site (`strum: 30` is the guitar's; `strum: { guitar: 30, piano: 20 }` also spreads piano chords).
- Each block that draws has a **Copy as image** button: on its playback bar, or, with `play: false`, on a small bar of its own (it copies the whole block). `copy: false` leaves it out.
- Each block also has a **Full screen** button, the last one on its bar. `fullScreen: false` leaves it out of every block, tabs and scores included.
- The bar under a tab or a score has a **Follow the music** button, off by default, so the page never scrolls by itself unless the reader asks. There is nothing to set. See [follow the music and one line](blocks.md#follow-the-music-and-one-line).
- The bar under a tab or a score shows its tempo in BPM, with the speed in percent next to it. `play: { tempoUnit: 'percent' }` shows percent first. When a reader switches the unit on a bar, the tabs drawn after it on the page start with that unit.
- `tab: { names: true }` writes the name of every note on every tab and score of the site that has no `names:` line. The block's own `names: on` or `names: off` wins. The names follow `naming` (below), as the diagrams do. See [note names on the notes](blocks.md#note-names-on-the-notes).
- With `play: { instruments }` (next point), diagrams on a page **without** tabs play the same instrument files through a small sample player that is part of this bundle: no alphaTab is loaded. A first chord reads about 115 KB (the folder's index and one guitar); the piano is read at the first piano diagram. When a file can't be read, or the browser can't decode it, the light synthesizer plays.
- Better sounds, one small file per instrument: `play: { instruments: '<folder URL>' }` names a folder of instrument soundfonts (the `generaluser` folder of the npm package `@dsebastien/music-notation-sounds`, or one made by the library's `scripts/sounds/split-soundfont.ts`). Tabs and scores then load only the instruments they play, at the first Play (a guitar is about 110 KB with GeneralUser GS), and diagrams on pages with tabs use them too. The folder can be on your own site or on any host that lets your pages read it (CORS). The sounds package's folder on jsDelivr works as is, the way this guide uses it: `https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@0.1.1/generaluser` (hear it next to the other sounds on [Sounds](sounds.md)). The library has no address of its own for these files: without `instruments`, the soundfont that ships with alphaTab plays, as before. When the folder can't be read or lacks an instrument, that soundfont plays too.
- `play: { engine: 'light' }` (or `'generaluser'`, `'sonivox'`) chooses the engine that plays. The library tries it first, then `generaluser`, `sonivox` and `light`, and skips what the page doesn't have, so a page never goes silent. Tabs and scores never play through the light synthesizer: with `engine: 'light'`, they play the instrument files when the page names them, else sonivox.
- A block can wish for an engine with an `engine:` line (`{engine: light}` in a chord chart). Its wish comes before the page's choice, and falls back the same way when the page can't give it. See [Sounds](sounds.md#which-one-plays-on-your-pages).
- The bars, the texts for screen readers and the messages of the blocks are in the page's language: French when `<html lang>` says so (`fr`, `fr-BE`, `fr-CA` and the like), else English. If your site's pages declare French, the bars are in French with nothing to set. `language: 'fr'` or `language: 'en'` forces one. It doesn't change the note names: that's `naming` (below). See [Language of the texts](blocks.md#language-of-the-texts).
- Defaults for the whole site go in `window.musicNotationOptions`, set before the bundle loads (at the top of `publish.js`). A block's own `orientation`, `hand`, `naming`, `root-mark` and `names` still win.

```js
window.musicNotationOptions = {
    hand: 'left',
    orientation: { chord: 'vertical', fretboard: 'vertical', keyboard: 'horizontal' },
    // How note names show on the whole site: 'letters' (default), 'solfege' (Do Ré Mi) or
    // 'german' (H for B). It never changes how your notes are read.
    naming: 'solfege',
    // The root as a shape too, not only a color: 'color' (default) or 'shape'.
    rootMark: 'shape',
    // The language of the bars and messages: 'en' or 'fr'. Without it, the page's own (<html lang>).
    language: 'fr'
}
```

- Empty blocks can draw from the page's properties ([from a note's properties](blocks.md#from-a-notes-properties)): give the library a function that returns them. This covers chord, scale, arpeggio, strumming pattern and fingerpicking pattern notes. On Obsidian Publish, they're in the site's cache:

```js
window.musicNotationOptions = {
    // The page's properties; nothing for embedded notes and hover previews (they aren't this page).
    properties: (el) =>
        el.closest('.markdown-embed, .popover')
            ? null
            : app.site.cache.cache[app.currentFilepath]?.frontmatter
}
```

The function gets the block's element, so it can tell the page's own blocks from embedded ones. When the properties change (you navigate to another page), the block is drawn again.

- Every block is drawn, including blocks on pages you navigate to later. A block's source is hidden only after it was drawn; a block with a mistake keeps its source and shows what's wrong.
- Pin `VERSION`: a new version never changes your site until you change it.
- Custom domains need jsDelivr allowed if your site sets a Content Security Policy.
