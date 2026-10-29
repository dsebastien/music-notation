/**
 * The tab bundle for web pages (`music-notation.tab.min.js`): draws ```tab and ```score blocks,
 * now and as the page changes (Obsidian Publish swaps content). Loads alphaTab, its music font and
 * soundfont from jsDelivr the first time a page has such a block, renders on the main thread (web
 * workers can't start from another origin), and lends its soundfont to the diagrams' playback.
 */
import { alphaTabCdn, renderTab, soundfontPlayer, type AlphaTabModule } from './index.js'
import { injectStyles } from '../styles.js'
import type { NotePlayer } from '../playback/player.js'

declare global {
    interface Window {
        alphaTab?: AlphaTabModule
        musicNotationTabLoaded?: boolean
        musicNotationSoundfontPlayer?: NotePlayer
    }
}

const SELECTOR = 'pre > code.language-tab, pre > code.language-score'
const MARK = 'mpRendered'

let loading: Promise<AlphaTabModule> | null = null

/** alphaTab, from the page or jsDelivr. */
function alphaTabOf(doc: Document): Promise<AlphaTabModule> {
    const win = doc.defaultView!
    if (win.alphaTab) return Promise.resolve(win.alphaTab)
    loading ??= new Promise<AlphaTabModule>((resolve, reject) => {
        const script = doc.createElement('script')
        script.src = alphaTabCdn().script
        script.onload = () => (win.alphaTab ? resolve(win.alphaTab) : reject(new Error('alphaTab')))
        script.onerror = () => reject(new Error("Couldn't load alphaTab"))
        doc.head.appendChild(script)
    })
    return loading
}

function renderAllTabs(doc: Document): void {
    const blocks = [...doc.querySelectorAll(SELECTOR)].filter(
        (code) => !code.parentElement?.dataset[MARK]
    )
    if (!blocks.length) return
    for (const code of blocks) code.parentElement!.dataset[MARK] = 'pending'
    void alphaTabOf(doc)
        .then((alphaTab) => {
            const cdn = alphaTabCdn()
            for (const code of blocks) {
                const pre = code.parentElement!
                if (!pre.parentElement) continue
                const language = code.classList.contains('language-score') ? 'score' : 'tab'
                const holder = doc.createElement('div')
                const result = renderTab(language, code.textContent ?? '', holder, {
                    alphaTab,
                    assets: { scriptFile: null, font: cdn.font, soundFont: cdn.soundFont }
                })
                pre.insertAdjacentElement('afterend', result.el)
                void result.ready.then(({ ok }) => {
                    pre.dataset[MARK] = ok ? 'done' : 'error'
                    if (ok) pre.style.display = 'none'
                    const api = result.api
                    if (ok && api && !doc.defaultView!.musicNotationSoundfontPlayer) {
                        api.soundFontLoaded.on(() => {
                            doc.defaultView!.musicNotationSoundfontPlayer ??= soundfontPlayer(
                                alphaTab,
                                () => api
                            )
                        })
                    }
                })
            }
        })
        .catch(() => {
            // No network or a blocked script: the source stays visible.
            for (const code of blocks) code.parentElement!.dataset[MARK] = 'error'
        })
}

if (!window.musicNotationTabLoaded) {
    window.musicNotationTabLoaded = true
    const start = () => {
        injectStyles(document)
        renderAllTabs(document)
        let scheduled = false
        new MutationObserver(() => {
            if (scheduled) return
            scheduled = true
            requestAnimationFrame(() => {
                scheduled = false
                renderAllTabs(document)
            })
        }).observe(document.body, { childList: true, subtree: true })
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
}
