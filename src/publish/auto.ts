/**
 * The browser bundle (`music-notation.publish.min.js`): injects the styles and renders every
 * notation block on the page, now and as it changes. Exposes the API as `window.MusicNotation`.
 */
import * as api from '../index.js'
import { lookupGuitarVoicing } from '../voicings/index.js'
import { injectStyles } from '../styles.js'
import { autoRender } from './index.js'

declare global {
    interface Window {
        musicNotationLoaded?: boolean
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
        const stop = autoRender(document, { voicings: lookupGuitarVoicing })
        window.MusicNotation = { ...api, lookupGuitarVoicing, stop }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
}
