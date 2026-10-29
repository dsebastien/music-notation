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

declare global {
    interface Window {
        musicNotationLoaded?: boolean
        musicNotationOptions?: unknown
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

// Loaded twice (two scripts, a cached copy): only the first one starts.
if (!window.musicNotationLoaded) {
    window.musicNotationLoaded = true
    const start = () => {
        injectStyles(document)
        const stop = autoRender(document, {
            ...layoutDefaults(window.musicNotationOptions),
            properties: pageProperties(window.musicNotationOptions),
            voicings: lookupGuitarVoicing
        })
        window.MusicNotation = { ...api, lookupGuitarVoicing, stop }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
}
