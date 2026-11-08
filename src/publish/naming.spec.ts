import { describe, expect, it } from 'bun:test'
import { renderAll } from './index.js'

/** #12 on Obsidian Publish: `window.musicNotationOptions.naming` is the site's default. */
describe('Publish: note names', () => {
    it('reads the naming of the page options, letters for anything else', async () => {
        // Imported without starting: the page is already marked as loaded.
        ;(window as { musicNotationLoaded?: boolean }).musicNotationLoaded = true
        const { pageNaming } = await import('./auto.js')
        expect(pageNaming({ naming: 'solfege' })).toBe('solfege')
        expect(pageNaming({ naming: 'Solfège' })).toBe('solfege')
        expect(pageNaming({ naming: 'klingon' })).toBeUndefined()
        expect(pageNaming(null)).toBeUndefined()
        expect(pageNaming('german')).toBeUndefined()
    })

    it('draws the page blocks in that naming', () => {
        document.body.innerHTML = ''
        const pre = document.createElement('pre')
        const code = document.createElement('code')
        code.className = 'language-keyboard'
        code.textContent = 'C major'
        pre.appendChild(code)
        document.body.append(pre)
        renderAll(document, { naming: 'solfege' })
        const labels = [...document.querySelectorAll('.mn-key-label')].map((e) => e.textContent)
        expect(labels).toContain('Do')
        document.body.innerHTML = ''
    })
})
