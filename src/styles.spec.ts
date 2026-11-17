import { describe, expect, it } from 'bun:test'
import { injectStyles, STYLES } from './styles.js'

/** A document of its own, so other specs' styles don't count. */
const page = () => document.implementation.createHTMLDocument('page')

describe('injectStyles', () => {
    it('adds the stylesheet once, as a style element with a known id', () => {
        const doc = page()
        injectStyles(doc)
        injectStyles(doc)
        const added = doc.querySelectorAll('#music-notation-styles')
        expect(added).toHaveLength(1)
        expect(added[0]!.tagName).toBe('STYLE')
        expect(added[0]!.textContent).toBe(STYLES)
    })

    it('adds nothing when the page links the stylesheet itself with that id (a strict style-src)', () => {
        const doc = page()
        const link = doc.createElement('link')
        link.id = 'music-notation-styles'
        // No `rel` here: the test page must not try to load the file. The id is what counts.
        link.href = 'https://example.test/music-notation.css'
        doc.head.appendChild(link)
        injectStyles(doc)
        expect(doc.querySelectorAll('style')).toHaveLength(0)
        expect(doc.getElementById('music-notation-styles')).toBe(link)
    })
})
