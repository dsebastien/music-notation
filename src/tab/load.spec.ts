import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { alphaTabLoader } from './load.js'
import type { AlphaTabModule } from './index.js'

type Page = Window & { alphaTab?: AlphaTabModule; define?: { amd?: unknown } }
const page = window as Page

describe('alphaTabLoader (#38)', () => {
    const appendChild = document.head.appendChild.bind(document.head)
    let scripts: HTMLScriptElement[] = []
    const load = (script: HTMLScriptElement): void => {
        script.onload?.call(script, new Event('load'))
    }
    /** The message a load rejected with, or null when it resolved. */
    const failureOf = (loading: Promise<AlphaTabModule>) =>
        loading.then(
            () => null,
            (e: unknown) => (e instanceof Error ? e.message : String(e))
        )

    beforeEach(() => {
        scripts = []
        document.head.appendChild = <T extends Node>(node: T): T => {
            scripts.push(node as HTMLScriptElement & T)
            return node
        }
    })

    afterEach(() => {
        document.head.appendChild = appendChild
        delete page.alphaTab
        delete page.define
    })

    it("tries again after alphaTab's script loads without defining alphaTab", async () => {
        const alphaTabOf = alphaTabLoader(() => 'alphaTab.js')
        const first = alphaTabOf(document)
        load(scripts[0]!)
        expect(await failureOf(first)).toBe("alphaTab's script didn't define alphaTab")
        // Before, the rejected load was kept: every later page change failed at once.
        const module = {} as AlphaTabModule
        const second = alphaTabOf(document)
        expect(scripts).toHaveLength(2)
        page.alphaTab = module
        load(scripts[1]!)
        expect(await second).toBe(module)
    })

    it('tries again after a network error', async () => {
        const alphaTabOf = alphaTabLoader(() => 'alphaTab.js')
        const first = alphaTabOf(document)
        scripts[0]!.onerror?.call(scripts[0]!, new Event('error'))
        expect(await failureOf(first)).toBe("Couldn't load alphaTab")
        void alphaTabOf(document).catch(() => undefined)
        expect(scripts).toHaveLength(2)
    })

    it('hides an AMD loader while the script runs, so alphaTab sets its global', async () => {
        const define = Object.assign(() => undefined, { amd: {} })
        page.define = define
        const alphaTabOf = alphaTabLoader(() => 'alphaTab.js')
        const loading = alphaTabOf(document)
        expect(page.define).toBeUndefined()
        page.alphaTab = {} as AlphaTabModule
        load(scripts[0]!)
        await loading
        expect(page.define).toBe(define)
    })
})
