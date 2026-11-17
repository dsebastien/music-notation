---
title: Websites and apps
nav_order: 7
---

# Websites and apps

The blocks draw without Obsidian, on any web page and in any JavaScript app. On a website, two scripts from jsDelivr find the blocks on the page and draw them. In an app, the npm package draws a block where your code asks for it. This page shows both ways and points to the pages that have the details. For a site on Obsidian Publish, see [Obsidian Publish](publish.md).

## On a website

A blog, a docs site or a static site: any page works. This guide is one of them. It is a Jekyll site, and every page loads the two bundles in its head.

### Load the bundles

The npm package has two browser bundles in its `dist` folder, and jsDelivr serves them:

| Bundle                          | What it draws                                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `music-notation.publish.min.js` | `chord`, `chords`, `keyboard`, `fretboard`, `strum`, `picking`, `progression` and `circle` blocks. It also gives your own scripts the API, as `window.MusicNotation`. |
| `music-notation.tab.min.js`     | `tab` and `score` blocks. On a page that has one, it loads alphaTab from jsDelivr, with its music font and its soundfont.                                             |

Load them from a script that your pages load (a file of your site, or your page template):

```js
;(() => {
    const VERSION = '0.24.0'
    const CDN = `https://cdn.jsdelivr.net/npm/@dsebastien/music-notation@${VERSION}/dist`
    for (const file of ['music-notation.publish.min.js', 'music-notation.tab.min.js']) {
        const script = document.createElement('script')
        script.src = `${CDN}/${file}`
        document.head.appendChild(script)
    }
})()
```

- Each bundle works alone. A site without tabs or scores can leave out the tab bundle.
- Both bundles add the library's stylesheet to the page, as a `<style>` element. You don't have to link a stylesheet, unless your site has a strict Content Security Policy (below).
- The loader of [Obsidian Publish](publish.md) downloads each bundle only on the pages that have its blocks. It works on any site. It watches `document.body`, so load it with `defer` or at the end of the page.
- Pin `VERSION`: a release never changes your site until you change it.
- If your site sets a Content Security Policy, allow `https://cdn.jsdelivr.net`: the bundles come from there, and so do alphaTab and its files for tabs. Also allow inline styles (`style-src 'unsafe-inline'`). When the policy blocks the bundles' `<style>` element, the blocks are drawn without their styles.

To keep inline styles blocked, link the stylesheet file instead: `music-notation.css`, in the same `dist` folder as the bundles. The bundles add no `<style>` element when the page already has an element with the id `music-notation-styles`. Add these lines to the loader, right after the `CDN` line, so they run before the bundles load, and allow `https://cdn.jsdelivr.net` in `style-src`:

```js
const link = document.createElement('link')
link.id = 'music-notation-styles'
link.rel = 'stylesheet'
link.href = `${CDN}/music-notation.css`
document.head.appendChild(link)
```

The stylesheet then comes from the same `VERSION` as the bundles. This covers every block of the main bundle. Tabs and scores still need `'unsafe-inline'`: alphaTab adds styles of its own, its music font among them.

### What the page must have

A block is a `<code>` element directly inside a `<pre>`, with the class `language-` followed by the block's language. Its text is the block's source, as you write it in a note:

```html
<pre><code class="language-chord">A x02220 x01230</code></pre>
<pre><code class="language-keyboard">C major</code></pre>
```

- In raw HTML, write `&` and `<` in a source as `&amp;` and `&lt;`. The bundles read the text, as the browser shows it.
- A CommonMark Markdown renderer writes a fenced code block in this form: a fence with the info string `chord` becomes `<pre><code class="language-chord">`.
- Other renderers write other markup, and then the bundles find nothing. Jekyll's default, kramdown with Rouge, puts the language on a `<div>` around the `<pre>` and gives the `<code>` no class. A syntax highlighter can change the markup too. Look at the HTML of one of your pages.
- The library has no option for other markup. This guide writes each live example as raw HTML in its Markdown, in a `<div markdown="0">`, which kramdown leaves as it is.
- The bundles draw every block that is on the page when it loads, and every block added or changed after that (content loaded later, a single-page app). Each drawing goes right after its `<pre>`.
- The `<pre>` is hidden only once its block is drawn. A block with a mistake keeps its source and shows what to write instead.

### Page options

Set `window.musicNotationOptions` before the bundles load: at the top of the same script, before the loader. A block's own line (`orientation:`, `naming:`, `engine:`) wins over the page's option.

```js
window.musicNotationOptions = {
    language: 'fr',
    naming: 'solfege',
    hand: 'left',
    orientation: { chord: 'vertical', fretboard: 'vertical', keyboard: 'horizontal' },
    play: {
        instruments:
            'https://cdn.jsdelivr.net/npm/@dsebastien/music-notation-sounds@0.1.1/generaluser'
    },
    fullScreen: false
}
```

| Option                             | What it sets                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `language`                         | The language of the bars, the messages and what screen readers read: `'en'` or `'fr'`. Without it, the page's `<html lang>`, else English.                           |
| `naming`                           | How note names show: `'letters'` (the default), `'solfege'` or `'german'`.                                                                                           |
| `rootMark`                         | How diagrams mark the root: `'color'` (the default) or `'shape'`.                                                                                                    |
| `orientation`, `hand`              | The layout of diagrams. `orientation` is `{ chord, keyboard, fretboard }`, each `'vertical'` or `'horizontal'`. `hand: 'left'` mirrors guitar chords and fretboards. |
| `play`                             | `false` turns playback off. `{ volume, bpm, strum, sound, tempoUnit }` sets its defaults.                                                                            |
| `play.instruments`                 | The URL of a folder of instrument files, so GeneralUser GS plays, one small file per instrument.                                                                     |
| `play.engine`                      | The engine to try first: `'generaluser'`, `'sonivox'` or `'light'`.                                                                                                  |
| `copy: false`, `fullScreen: false` | Leave out the **Copy as image** and **Full screen** buttons.                                                                                                         |
| `tab: { names: true }`             | The name of every note on the tabs and scores that have no `names:` line.                                                                                            |
| `properties`                       | A function that returns the page's properties, so empty blocks draw from them.                                                                                       |

These are the same page options as on Obsidian Publish, and [Obsidian Publish](publish.md) explains each one. The sounds and the engines are on [Sounds](sounds.md#which-one-plays-on-your-pages).

### Light and dark

The stylesheet reads Obsidian's theme variables. Other sites don't set them, so the library uses its own colors there:

- Lines and text take the page's text color, so they follow a dark page too.
- Dots and marks are purple (`#8250df`), which can be read on white and on a dark page. The root (orange), the notes that sound (yellow) and the piano keys keep their colors in every theme.
- The background is white (`#fff`): the bars under the blocks, hollow dots, capo rings, the cells of the circle of fifths and the gaps of picking patterns. On a dark page, they stay white, and the text of the bars takes the page's light text color.
- The font is the system's (`system-ui`), not your site's.

Set the variables that Obsidian's themes set, in your site's CSS, and the blocks take your colors. For a site that follows the reader's system theme:

```css
@media (prefers-color-scheme: dark) {
    :root {
        --background-primary: #1e1e1e;
        --background-modifier-border: #444;
    }
}
```

| Variable                       | What it colors                                     | Without it              |
| ------------------------------ | -------------------------------------------------- | ----------------------- |
| `--background-primary`         | The background: bars, hollow dots, rings and cells | `#fff`                  |
| `--text-normal`                | Text and lines                                     | The page's text color   |
| `--text-muted`                 | Strings, frets and other light marks               | `#8a8a8a`               |
| `--background-modifier-border` | Borders and faint marks                            | `#d0d0d0`               |
| `--interactive-accent`         | Dots and marks                                     | `#8250df`               |
| `--text-on-accent`             | Labels on the dots                                 | `#fff`                  |
| `--font-interface`             | The font                                           | `system-ui, sans-serif` |

- Set them on `:root` or `body`. A value set on `.mn-block` doesn't reach the drawings: each drawing sets the library's colors again.
- To change one of the library's own colors (`--mn-accent`, `--mn-root`, `--mn-playing`), set it on `.mn-block, .mn-svg, .mn-chart`, with a selector stronger than the library's, such as `body .mn-block, body .mn-svg, body .mn-chart`.
- A site with a dark mode switch puts the same variables under the selector its dark mode uses.

## In an app

```bash
npm install @dsebastien/music-notation
```

The package is ESM, with types, for bundlers and Node 20 or later. It has no framework and no Obsidian dependency. The [JavaScript API](api.md) has every function and option; this part shows where to start.

### Draw a block

```ts
import { injectStyles, renderBlock } from '@dsebastien/music-notation'
import { lookupGuitarVoicing } from '@dsebastien/music-notation/voicings'

injectStyles(document)
const result = renderBlock('chord', 'Am', container, { voicings: lookupGuitarVoicing, play: true })
if (!result.ok) console.warn(result.error)
// When the view closes:
result.destroy()
```

- `renderBlock` never throws, and draws in the document of `container`, so popout windows work. Its options are in [Render a block](api.md#render-a-block).
- The styles: `injectStyles(document)` adds the stylesheet once to a document. Or import `@dsebastien/music-notation/music-notation.css` with your bundler, or take `STYLES`, the same stylesheet as text, for a host that adds it itself. The colors work as on a website (see [Light and dark](#light-and-dark)).
- `@dsebastien/music-notation/voicings` holds about 1,800 guitar voicings (about 230 KB). Import it only if your chord blocks give a chord symbol without frets.
- An app that turns Markdown into HTML can use the finder of the bundles. `autoRender(document, options)` from `@dsebastien/music-notation/publish` draws every `pre > code.language-…` block of the document, now and as it changes, and returns a function that stops it. It draws the blocks of the main bundle, not `tab` and `score` blocks. It reads no page options and adds no stylesheet: pass the render options, and call `injectStyles`.
- Node has no `document`. Give `renderBlock` a host from a DOM library: the library's `check` command uses linkedom.

### Tabs and scores

`@dsebastien/music-notation/tab` draws `tab` and `score` blocks with alphaTab. The package doesn't bundle alphaTab: install it as your app's own dependency (it is an optional peer dependency, `^1.9.0`), and pass the module, the music font and the soundfont.

```bash
npm install @coderline/alphatab
```

```ts
import * as alphaTab from '@coderline/alphatab'
import { alphaTabCdn, renderTab } from '@dsebastien/music-notation/tab'

const { font, soundFont } = alphaTabCdn()
const result = renderTab('tab', source, container, {
    alphaTab,
    assets: { scriptFile: null, font, soundFont }
})
const { ok, error } = await result.ready
```

- `alphaTabCdn()` gives the jsDelivr URLs of the files of alphaTab 1.9.0. For an app that works offline, serve `dist/font/Bravura.woff2` and `dist/soundfont/sonivox.sf3` of the alphaTab package yourself and pass their URLs. `soundFont` can also be the file's bytes.
- `scriptFile: null` draws and plays on the main thread.
- Every option of `renderTab` is in [Tabs and scores](api.md#tabs-and-scores).

### Sounds

With `play: true`, diagrams play through the light synthesizer, which is part of the library. For better sounds, `@dsebastien/music-notation-sounds` (an optional peer dependency) has GeneralUser GS, one small file per instrument. The library has no address of its own for these files: your app gives them.

```bash
npm install @dsebastien/music-notation-sounds
```

- In the browser, serve the package's `generaluser` folder with your app, and give its URL.
- On Node, Bun or Electron, the package reads its own files from the disk: `import { generaluser } from '@dsebastien/music-notation-sounds/node'`, and give `generaluser`.
- For tabs and scores, give it as `assets.instruments` to `renderTab`. For diagrams, give it to a player (below).

Your app tells the library which engines it has with `play.engines`, and which one it prefers with `play.engine`:

```ts
import { lightPlayer, renderBlock, sampledPlayer } from '@dsebastien/music-notation'
import { generaluser } from '@dsebastien/music-notation-sounds/node'

const light = lightPlayer(window)
renderBlock('chord', 'Am', container, {
    play: {
        engines: { generaluser: sampledPlayer(window, generaluser, light), light },
        engine: 'generaluser'
    }
})
```

| Engine        | The player your app gives                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `generaluser` | `sampledPlayer(window, instruments, fallback)` plays the instrument files without alphaTab. `createSoundfontPlayer(alphaTab, assets, document, fallback)` from `/tab`, with `assets.instruments`, plays them through alphaTab. |
| `sonivox`     | `createSoundfontPlayer` with alphaTab's soundfont and no `instruments`.                                                                                                                                                        |
| `light`       | `lightPlayer(window)`. Leave it out, and the library's own light synthesizer plays.                                                                                                                                            |

- A block plays through the first engine your app has, in this order: the block's `engine:` line, `play.engine`, then `generaluser`, `sonivox` and `light`. See [Sound engine](blocks.md#sound-engine).
- `renderTab` takes `engine` and `assets.instruments` in its options. A score never plays through the light synthesizer.
- The bars have no volume control: the volume is your app's setting, `play.volume`. See [Render a block](api.md#render-a-block) for `volumeChanged()`.
