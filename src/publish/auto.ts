/**
 * The browser bundle (`music-notation.publish.min.js`): injects the styles and renders every
 * notation block on the page, now and as it changes. Exposes the API as `window.MusicNotation`.
 */
import * as api from '../index'
import { lookupGuitarVoicing } from '../voicings'
import { injectStyles } from '../styles'
import { autoRender } from './index'

declare global {
    interface Window {
        MusicNotation?: typeof api & {
            lookupGuitarVoicing: typeof lookupGuitarVoicing
            stop: () => void
        }
    }
}

if (!window.MusicNotation) {
    const start = () => {
        injectStyles(document)
        const stop = autoRender(document, { voicings: lookupGuitarVoicing })
        window.MusicNotation = { ...api, lookupGuitarVoicing, stop }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
}
