/** The page's language reaches the blocks the Publish bundle draws (#136). */
import { afterEach, describe, expect, it } from 'bun:test'
import { renderAll } from './index.js'
import { pageLanguage } from '../i18n/page.js'

afterEach(() => {
    document.body.replaceChildren()
    document.documentElement.lang = ''
})

const page = () => {
    document.body.innerHTML = '<pre><code class="language-keyboard">chord: Xyz</code></pre>'
}
const message = () => document.querySelector('.mn-error-message')?.textContent ?? ''

describe('the language of drawn blocks', () => {
    it('follows <html lang> through the page options of the bundle', () => {
        document.documentElement.lang = 'fr-FR'
        page()
        // What src/publish/auto.ts passes: a getter, read at each draw.
        renderAll(document, {
            get language() {
                return pageLanguage(undefined, document)
            }
        })
        expect(message()).toBe('keyboard: Accord "Xyz" inconnu')
    })

    it('is English without a lang, and a block drawn again takes the new language', () => {
        page()
        const options = {
            get language() {
                return pageLanguage(undefined, document)
            }
        }
        renderAll(document, options)
        expect(message()).toBe('keyboard: Unknown chord "Xyz"')
        document.documentElement.lang = 'fr'
        document.querySelector('code')!.textContent = 'chord: Xyzz'
        renderAll(document, options)
        expect(message()).toBe('keyboard: Accord "Xyzz" inconnu')
    })
})
