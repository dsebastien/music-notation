/**
 * Loads alphaTab's script for the tab bundle (#38). alphaTab's UMD build registers with an AMD
 * loader instead of setting `window.alphaTab` when one is on the page, so an AMD `define` is hidden
 * while the script runs. A load that fails (a network error, or a script that sets no
 * `window.alphaTab`: a blocked or partial download) is forgotten, so the next page change tries
 * again; before, only a network error was.
 */
import { alphaTabCdn, type AlphaTabModule } from './index.js'

type Page = Window & { alphaTab?: AlphaTabModule; define?: { amd?: unknown } }

/** alphaTab from the page, else from `src` (jsDelivr by default), one load at a time. */
export function alphaTabLoader(
    src: () => string = () => alphaTabCdn().script
): (doc: Document) => Promise<AlphaTabModule> {
    let loading: Promise<AlphaTabModule> | null = null
    return (doc) => {
        const win = doc.defaultView as Page
        if (win.alphaTab) return Promise.resolve(win.alphaTab)
        loading ??= new Promise<AlphaTabModule>((resolve, reject) => {
            const script = doc.createElement('script')
            script.src = src()
            const define = win.define?.amd ? win.define : undefined
            if (define) win.define = undefined
            const done = (failure: string | null) => {
                if (define && win.define === undefined) win.define = define
                if (failure === null && win.alphaTab) {
                    resolve(win.alphaTab)
                    return
                }
                loading = null
                script.remove()
                reject(new Error(failure ?? "alphaTab's script didn't define alphaTab"))
            }
            script.onload = () => done(null)
            script.onerror = () => done("Couldn't load alphaTab")
            doc.head.appendChild(script)
        })
        return loading
    }
}
