import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from './render-block.js'
import { accessibleName } from './dom.js'
import type { NotationLanguage } from '../blocks/renderers.js'

/**
 * Obsidian shows a tooltip for any element with `aria-label` and calls HTMLElement-only methods on
 * it: on an SVG element that throws (`o.isShown is not a function`). Diagrams get their name for
 * screen readers from a hidden `<title>` instead (role="img" + aria-labelledby), which never
 * shows a hover tooltip either.
 */
const BLOCKS: [NotationLanguage, string][] = [
    ['chord', 'A x02220'],
    ['chord', 'C\ninstrument: piano'],
    ['keyboard', 'C major'],
    ['fretboard', 'A minor pentatonic'],
    ['strum', 'D - D U - U D U'],
    ['progression', 'key: C\nI V vi IV'],
    ['circle', 'key: G\ntitle: G major']
]

const host = () => {
    const h = document.createElement('div')
    document.body.appendChild(h)
    return h
}

afterEach(() => {
    document.body.innerHTML = ''
})

describe('accessible names of diagrams', () => {
    for (const [language, source] of BLOCKS) {
        it(`names ${language} diagrams without aria-label on SVG`, () => {
            const h = host()
            const { error } = renderBlock(language, source, h, { play: {} })
            expect(error).toBeNull()
            const svgs = [...h.querySelectorAll('svg.mn-svg')]
            expect(svgs.length).toBeGreaterThan(0)
            // No SVG element anywhere in the block carries aria-label.
            expect(h.querySelectorAll('svg[aria-label], svg [aria-label]').length).toBe(0)
            for (const svg of svgs) {
                expect(svg.getAttribute('role')).toBe('img')
                const id = svg.getAttribute('aria-labelledby')!
                const title = h.ownerDocument.getElementById(id)!
                expect(title.tagName.toLowerCase()).toBe('title')
                expect(title.textContent.length).toBeGreaterThan(0)
                // Not a direct child of anything drawn: no native hover tooltip over the diagram.
                expect(title.parentElement!.tagName.toLowerCase()).toBe('defs')
                expect(accessibleName(svg)).toBe(title.textContent)
            }
        })
    }

    it('gives every diagram of a document its own id', () => {
        const a = host()
        const b = host()
        renderBlock('chord', 'A x02220\n---\nD xx0232', a)
        renderBlock('chord', 'A x02220', b)
        const ids = [...document.querySelectorAll('svg.mn-svg')].map((s) =>
            s.getAttribute('aria-labelledby')
        )
        expect(ids.length).toBe(3)
        expect(new Set(ids).size).toBe(3)
    })

    it('keeps aria-label on the HTML play bar, named after its diagram', () => {
        const h = host()
        renderBlock('chord', 'A x02220', h, { play: {} })
        expect(h.querySelector('.mn-play')!.getAttribute('aria-label')).toBe('Play A chord diagram')
    })
})
