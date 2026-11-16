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
import type { TempoUnit } from './tempo.js'
import { alphaTabLoader } from './load.js'
import { pageInstruments } from './instruments.js'
import { pageEngine } from '../playback/engine.js'
import { namingOf } from '../theory/naming.js'
import { pageLanguage } from '../i18n/page.js'
import { injectStyles } from '../styles.js'
import { lightPlayer, type NotePlayer } from '../playback/player.js'
import { DEFAULT_VOLUME } from '../playback/bar-parts.js'
import { pageFullScreen } from '../playback/full-screen.js'

declare global {
    interface Window {
        alphaTab?: AlphaTabModule
        musicNotationTabLoaded?: boolean
        musicNotationSoundfontPlayer?: NotePlayer
        /** The whole soundfont (sonivox) for the diagrams, when a block or the page asks (#124). */
        musicNotationSonivoxPlayer?: NotePlayer
        musicNotationOptions?: unknown
        /**
         * The tab bundle's API for a page's own scripts (the guide's Sounds page): draw a tab or
         * a score with assets of its choice, make a soundfont player, load alphaTab from jsDelivr.
         */
        MusicNotationTab?: {
            renderTab: typeof renderTab
            createSoundfontPlayer: typeof createSoundfontPlayer
            loadAlphaTab: () => Promise<AlphaTabModule>
            alphaTabCdn: typeof alphaTabCdn
        }
    }
}

/** The page's `play: { volume }` (0 to 1), read at each Play: the tab bar has no volume (#82). */
const pageVolume = (): number | undefined => {
    const options: unknown = window.musicNotationOptions
    if (!options || typeof options !== 'object' || !('play' in options)) return undefined
    const play: unknown = options.play
    if (!play || typeof play !== 'object' || !('volume' in play)) return undefined
    const volume: unknown = play.volume
    return typeof volume === 'number' && Number.isFinite(volume) ? volume : undefined
}

/**
 * The page's `play: { tempoUnit }` (#114): the unit the tab bars' tempo shows first, `'bpm'` or
 * `'percent'`; a reader's switch on a bar is kept for the next tabs drawn on the page.
 */
let tempoUnit: TempoUnit | undefined
const pageTempoUnit = (): TempoUnit | undefined => {
    if (tempoUnit) return tempoUnit
    const options: unknown = window.musicNotationOptions
    if (!options || typeof options !== 'object' || !('play' in options)) return undefined
    const play: unknown = options.play
    if (!play || typeof play !== 'object' || !('tempoUnit' in play)) return undefined
    const unit: unknown = play.tempoUnit
    return unit === 'bpm' || unit === 'percent' ? unit : undefined
}

const SELECTOR = 'pre > code.language-tab, pre > code.language-score'

/** What each block drew, and from what source, to redraw an edited block and free a removed one. */
const drawn = new Map<HTMLElement, { result: TabResult; source: string; holder: HTMLElement }>()

/** alphaTab, from the page or jsDelivr; a failed load is tried again at the next change (#38). */
const alphaTabOf = alphaTabLoader()

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
            // One soundfont per instrument when the page says where its folder is (#108).
            const instruments = pageInstruments(window.musicNotationOptions)
            const assets = {
                scriptFile: null,
                font: cdn.font,
                soundFont: cdn.soundFont,
                ...(instruments ? { instruments } : {})
            }
            const win = doc.defaultView!
            win.musicNotationSoundfontPlayer ??= createSoundfontPlayer(
                alphaTab,
                assets,
                doc,
                lightPlayer(win)
            )
            // The engine choice (#124): sonivox for the diagrams too. With a folder it is a second
            // player (it makes its alphaTab instance at its first play only), else the same one.
            win.musicNotationSonivoxPlayer ??= instruments
                ? createSoundfontPlayer(
                      alphaTab,
                      { scriptFile: null, font: cdn.font, soundFont: cdn.soundFont },
                      doc,
                      lightPlayer(win)
                  )
                : win.musicNotationSoundfontPlayer
            const engine = pageEngine(window.musicNotationOptions)
            // Note names on tabs (#112): the page's naming (as for the diagrams) and its default.
            const page = (window.musicNotationOptions ?? {}) as Record<string, unknown>
            const naming = namingOf(page['naming'])
            const tabs = page['tab']
            // `tab: { names: true }` shows them on every tab that has no `names:` line.
            const names =
                typeof tabs === 'object' &&
                tabs !== null &&
                (tabs as Record<string, unknown>)['names'] === true
            for (const code of blocks) {
                const pre = code.parentElement!
                if (!pre.parentElement) continue
                const language = code.classList.contains('language-score') ? 'score' : 'tab'
                const source = code.textContent ?? ''
                // On the page before drawing: the music takes the page's text color.
                const holder = doc.createElement('div')
                holder.className = 'mn-tab-holder'
                pre.insertAdjacentElement('afterend', holder)
                const result = renderTab(language, source, holder, {
                    alphaTab,
                    assets,
                    volume: () => pageVolume() ?? DEFAULT_VOLUME,
                    language: pageLanguage(window.musicNotationOptions, doc),
                    ...(engine ? { engine } : {}),
                    ...(naming ? { naming } : {}),
                    ...(names ? { names } : {}),
                    fullScreen: pageFullScreen(window.musicNotationOptions),
                    ...(pageTempoUnit() ? { tempoUnit: pageTempoUnit()! } : {}),
                    onTempoUnit: (unit) => (tempoUnit = unit)
                })
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
    window.MusicNotationTab = {
        renderTab,
        createSoundfontPlayer,
        loadAlphaTab: () => alphaTabOf(document),
        alphaTabCdn
    }
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
