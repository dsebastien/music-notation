---
title: Obsidian Publish
nav_order: 5
---

# Obsidian Publish

Obsidian Publish shows code blocks as code. To draw them, add this to your site's `publish.js` (create the file at the root of your vault and publish it):

```js
;(() => {
    const VERSION = '0.3.0'
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

- The bundle is only downloaded on pages with notation blocks.
- Defaults for the whole site go in `window.musicNotationOptions`, set before the bundle loads (at the top of `publish.js`). A block's own `orientation` and `hand` still win.

```js
window.musicNotationOptions = {
    hand: 'left',
    orientation: { chord: 'vertical', fretboard: 'vertical', keyboard: 'horizontal' }
}
```

- Empty blocks can draw from the page's properties ([from a note's properties](blocks.md#from-a-notes-properties)): give the library a function that returns them. On Obsidian Publish, they're in the site's cache:

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
