/**
 * The tab bundle for web pages (`music-notation.tab.min.js`): draws ```tab and ```score blocks,
 * now and as the page changes (Obsidian Publish swaps content as you navigate). Loads alphaTab, its
 * music font and soundfont from jsDelivr the first time a page has such a block, renders on the
 * main thread (web workers can't start from another origin), and gives the diagrams a soundfont
 * player of their own.
 */
import {
    alphaTabCdn,
    createSoundfontPlayer,
    renderTab,
    type AlphaTabModule,
    type TabResult
} from './index.js'
import { injectStyles } from '../styles.js'
import { lightPlayer, type NotePlayer } from '../playback/player.js'

declare global {
    interface Window {
        alphaTab?: AlphaTabModule
        musicNotationTabLoaded?: boolean
        musicNotationSoundfontPlayer?: NotePlayer
    }
}

const SELECTOR = 'pre > code.language-tab, pre > code.language-score'

/** What each block drew, and from what source, to redraw an edited block and free a removed one. */
const drawn = new Map<HTMLElement, { result: TabResult; source: string; holder: HTMLElement }>()

let loading: Promise<AlphaTabModule> | null = null

/** alphaTab, from the page or jsDelivr. */
function alphaTabOf(doc: Document): Promise<AlphaTabModule> {
    const win = doc.defaultView!
    if (win.alphaTab) return Promise.resolve(win.alphaTab)
    loading ??= new Promise<AlphaTabModule>((resolve, reject) => {
        const script = doc.createElement('script')
        script.src = alphaTabCdn().script
        script.onload = () => (win.alphaTab ? resolve(win.alphaTab) : reject(new Error('alphaTab')))
        script.onerror = () => {
            loading = null
            reject(new Error("Couldn't load alphaTab"))
        }
        doc.head.appendChild(script)
    })
    return loading
}

function renderAllTabs(doc: Document): void {
    // Blocks gone from the page (Publish navigated away): free them.
    for (const [pre, { result, holder }] of drawn) {
        if (!pre.isConnected || !result.el.isConnected) {
            result.destroy()
            holder.remove()
            drawn.delete(pre)
            if (pre.isConnected) pre.style.removeProperty('display')
        }
    }
    const blocks = [...doc.querySelectorAll(SELECTOR)].filter((code) => {
        const pre = code.parentElement!
        const previous = drawn.get(pre)
        if (!previous) return pre.dataset['mpRendered'] !== 'pending'
        // Edited in place: drawn again.
        if (previous.source === (code.textContent ?? '')) return false
        previous.result.destroy()
        previous.holder.remove()
        drawn.delete(pre)
        return true
    })
    if (!blocks.length) return
    for (const code of blocks) code.parentElement!.dataset['mpRendered'] = 'pending'
    void alphaTabOf(doc)
        .then((alphaTab) => {
            const cdn = alphaTabCdn()
            const assets = { scriptFile: null, font: cdn.font, soundFont: cdn.soundFont }
            const win = doc.defaultView!
            win.musicNotationSoundfontPlayer ??= createSoundfontPlayer(
                alphaTab,
                assets,
                doc,
                lightPlayer(win)
            )
            for (const code of blocks) {
                const pre = code.parentElement!
                if (!pre.parentElement) continue
                const language = code.classList.contains('language-score') ? 'score' : 'tab'
                const source = code.textContent ?? ''
                // On the page before drawing: the music takes the page's text color.
                const holder = doc.createElement('div')
                holder.className = 'mn-tab-holder'
                pre.insertAdjacentElement('afterend', holder)
                const result = renderTab(language, source, holder, { alphaTab, assets })
                drawn.set(pre, { result, source, holder })
                void result.ready.then(({ ok }) => {
                    pre.dataset['mpRendered'] = ok ? 'done' : 'error'
                    if (ok && result.el.isConnected) pre.style.display = 'none'
                })
            }
        })
        .catch(() => {
            // No network or a blocked script: the source stays visible.
            for (const code of blocks) code.parentElement!.dataset['mpRendered'] = 'error'
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
        }).observe(document.body, { childList: true, subtree: true, characterData: true })
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
}
