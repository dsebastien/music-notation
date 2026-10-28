/**
 * The browser bundle (`music-notation.publish.min.js`): injects the styles and renders every
 * notation block on the page, now and as it changes. Exposes the API as `window.MusicNotation`.
 * A page sets defaults (orientation, left-handed) in `window.musicNotationOptions` before loading it.
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

// Loaded twice (two scripts, a cached copy): only the first one starts.
if (!window.musicNotationLoaded) {
    window.musicNotationLoaded = true
    const start = () => {
        injectStyles(document)
        const stop = autoRender(document, {
            ...layoutDefaults(window.musicNotationOptions),
            voicings: lookupGuitarVoicing
        })
        window.MusicNotation = { ...api, lookupGuitarVoicing, stop }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
}
