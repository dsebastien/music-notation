---
title: Obsidian Publish
nav_order: 5
---

# Obsidian Publish

Obsidian Publish shows code blocks as code. To draw them, add this to your site's `publish.js` (create the file at the root of your vault and publish it):

```js
;(() => {
    const VERSION = '0.14.0'
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
- Defaults for the whole site go in `window.musicNotationOptions`, set before the bundle loads (at the top of `publish.js`). A block's own `orientation`, `hand` and `naming` still win.

```js
window.musicNotationOptions = {
    hand: 'left',
    orientation: { chord: 'vertical', fretboard: 'vertical', keyboard: 'horizontal' },
    // Note names on the whole site: 'letters' (default), 'solfege' (Do Ré Mi) or 'german' (H for B).
    naming: 'solfege'
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
