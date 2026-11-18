/**
 * The browser bundle (`music-notation.publish.min.js`): injects the styles and renders every
 * notation block on the page, now and as it changes. Exposes the API as `window.MusicNotation`.
 * A page sets defaults (orientation, left-handed) and `properties` (a function returning the page's
 * properties, so empty blocks draw from them) in `window.musicNotationOptions` before loading it.
 */
import * as api from '../index.js'
import { lookupGuitarVoicing } from '../voicings/index.js'
import { injectStyles } from '../styles.js'
import { layoutDefaults } from '../render/layout.js'
import { namingOf, type Naming } from '../theory/naming.js'
import { rootMarkOf, type RootMark } from '../render/root-mark.js'
import { pageLanguage } from '../i18n/page.js'
import { autoRender } from './index.js'
import type { PlayOptions } from '../playback/controls.js'
import type { NotePlayer } from '../playback/player.js'
import { pageFullScreen } from '../playback/full-screen.js'

declare global {
    interface Window {
        musicNotationLoaded?: boolean
        musicNotationOptions?: unknown
        /** Set by the tab bundle once its soundfont is loaded: diagrams play through it. */
        musicNotationSoundfontPlayer?: NotePlayer
        /** Set by the tab bundle: alphaTab's whole soundfont (sonivox), for the engine choice. */
        musicNotationSonivoxPlayer?: NotePlayer
        MusicNotation?: typeof api & {
            lookupGuitarVoicing: typeof lookupGuitarVoicing
            stop: () => void
        }
    }
}

/** The page's properties function from the page's options (`properties: () => frontmatter`). */
function pageProperties(
    options: unknown
): ((el: Element) => Record<string, unknown> | null) | undefined {
    try {
        const given = (options as { properties?: unknown } | null | undefined)?.properties
        if (typeof given !== 'function') return undefined
        return (el: Element) => {
            const value: unknown = (given as (el: Element) => unknown)(el)
            return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
        }
    } catch {
        return undefined
    }
}

/**
 * Playback on the page: on unless `play: false`; `play: { volume, bpm, strum, sound }` sets the
 * defaults (`strum` a number for guitar, or `{ guitar, piano }`). The engines the page has (#124):
 * GeneralUser GS when it names its instrument files (`play: { instruments }`), through the tab
 * bundle's player once a page with tab blocks has loaded it, else through the sample player;
 * sonivox once the tab bundle is there (it needs alphaTab); the light synthesizer always.
 * `play: { engine }` is the page's choice, a block's `engine:` line its wish; what the page
 * doesn't have falls back, in this order: GeneralUser GS, sonivox, light.
 */
function pagePlay(options: unknown): false | PlayOptions {
    const given = (options as { play?: unknown } | null | undefined)?.play
    if (given === false) return false
    const folder = api.pageInstruments(options)
    const engine = api.pageEngine(options)
    // The page's guitar (#103): `play: { guitar: 'nylon' }`; a block's `guitar:` line comes first.
    const guitar = api.pageGuitar(options)
    let sampled: NotePlayer | null = null
    const out: PlayOptions = {
        engines: {
            // The instrument files (#108, #109): the tab bundle's player once a page with tabs has
            // it, else the sample player, which needs no alphaTab.
            generaluser: () =>
                folder
                    ? (window.musicNotationSoundfontPlayer ??
                      (sampled ??= api.sampledPlayer(window, folder, api.lightPlayer(window))))
                    : null,
            // alphaTab's whole soundfont: there once the tab bundle is. Without a folder, the tab
            // bundle's player is that one.
            sonivox: () =>
                window.musicNotationSonivoxPlayer ??
                (folder ? null : window.musicNotationSoundfontPlayer)
        },
        ...(engine ? { engine } : {}),
        ...(guitar ? { guitar } : {})
    }
    if (given && typeof given === 'object') {
        const read = (key: string) => {
            const value = (given as Record<string, unknown>)[key]
            return typeof value === 'number' && Number.isFinite(value) ? value : undefined
        }
        const volume = read('volume')
        const bpm = read('bpm')
        const strum = read('strum')
        if (volume !== undefined) out.volume = volume
        if (bpm !== undefined) out.bpm = bpm
        if (strum !== undefined) out.strum = strum
        // Or each instrument's: { guitar, piano }.
        const each = (given as Record<string, unknown>)['strum']
        if (each && typeof each === 'object') {
            const of = (key: string) => {
                const value = (each as Record<string, unknown>)[key]
                return typeof value === 'number' && Number.isFinite(value) ? value : undefined
            }
            const guitar = of('guitar')
            const piano = of('piano')
            out.strum = {
                ...(guitar !== undefined ? { guitar } : {}),
                ...(piano !== undefined ? { piano } : {})
            }
        }
        // The room and the amplifier (#103): `play: { reverb: 0.25 }`, `play: { dry: true }`,
        // `play: { amp: { cabinet: true, drive: 0.3 } }`. Read at each play, so a page's script
        // may change them.
        const now = () => api.pageEffects(options)
        out.dry = () => now()?.dry === true
        out.reverb = () => now()?.reverb
        out.amp = () => now()?.amp
        const sound = (given as Record<string, unknown>)['sound']
        if (sound === 'guitar' || sound === 'piano') out.sound = sound
    }
    return out
}

/** Copy as image on the site (#11): on unless the page options say `copy: false`. */
export function pageCopy(options: unknown): boolean {
    if (!options || typeof options !== 'object') return true
    return (options as Record<string, unknown>)['copy'] !== false
}

/** The site's note names (#12): `naming` of the page options when valid, else letters (undefined). */
export function pageNaming(options: unknown): Naming | undefined {
    if (!options || typeof options !== 'object') return undefined
    return namingOf((options as Record<string, unknown>)['naming']) ?? undefined
}

/** The site's root mark (#14): `rootMark` of the page options when valid, else color (undefined). */
export function pageRootMark(options: unknown): RootMark | undefined {
    if (!options || typeof options !== 'object') return undefined
    return rootMarkOf((options as Record<string, unknown>)['rootMark']) ?? undefined
}

// Loaded twice (two scripts, a cached copy): only the first one starts.
if (!window.musicNotationLoaded) {
    window.musicNotationLoaded = true
    const start = () => {
        injectStyles(document)
        const stop = autoRender(document, {
            ...layoutDefaults(window.musicNotationOptions),
            // Note names (#12): letters, solfege or german; anything else is letters.
            naming: pageNaming(window.musicNotationOptions),
            // The root as a shape too (#14): color or shape; anything else is color.
            rootMark: pageRootMark(window.musicNotationOptions),
            properties: pageProperties(window.musicNotationOptions),
            // The language of the texts (#136): the page's option, else <html lang>, else English.
            // A getter: read at each draw, so a page that changes language draws the next blocks in it.
            get language() {
                return pageLanguage(window.musicNotationOptions, document)
            },
            voicings: lookupGuitarVoicing,
            play: pagePlay(window.musicNotationOptions),
            copy: pageCopy(window.musicNotationOptions),
            fullScreen: pageFullScreen(window.musicNotationOptions)
        })
        window.MusicNotation = { ...api, lookupGuitarVoicing, stop }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
}
