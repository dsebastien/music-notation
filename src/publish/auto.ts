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
import { autoRender } from './index.js'
import type { PlayOptions } from '../playback/controls.js'
import type { NotePlayer } from '../playback/player.js'

declare global {
    interface Window {
        musicNotationLoaded?: boolean
        musicNotationOptions?: unknown
        /** Set by the tab bundle once its soundfont is loaded: diagrams play through it. */
        musicNotationSoundfontPlayer?: NotePlayer
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
 * defaults. Diagrams use the light synthesizer, or the tab bundle's soundfont once a page with tab
 * blocks has loaded it (`window.musicNotationSoundfontPlayer`).
 */
function pagePlay(options: unknown): false | PlayOptions {
    const given = (options as { play?: unknown } | null | undefined)?.play
    if (given === false) return false
    const out: PlayOptions = { player: () => window.musicNotationSoundfontPlayer ?? null }
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
        const sound = (given as Record<string, unknown>)['sound']
        if (sound === 'guitar' || sound === 'piano') out.sound = sound
    }
    return out
}

// Loaded twice (two scripts, a cached copy): only the first one starts.
if (!window.musicNotationLoaded) {
    window.musicNotationLoaded = true
    const start = () => {
        injectStyles(document)
        const stop = autoRender(document, {
            ...layoutDefaults(window.musicNotationOptions),
            properties: pageProperties(window.musicNotationOptions),
            voicings: lookupGuitarVoicing,
            play: pagePlay(window.musicNotationOptions)
        })
        window.MusicNotation = { ...api, lookupGuitarVoicing, stop }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
}
