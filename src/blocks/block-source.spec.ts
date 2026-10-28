import { describe, expect, it } from 'bun:test'
import { parseBlockSource, parseRange, splitParts } from './block-source.js'

describe('parseBlockSource', () => {
    it('reads key: value lines and a shorthand first line', () => {
        const block = parseBlockSource('A x02220\nFingers: x01230\n\ntitle: A open')
        expect(block.head).toBe('A x02220')
        expect(block.fields.get('fingers')).toBe('x01230')
        expect(block.fields.get('title')).toBe('A open')
    })

    it('keeps colons inside values and has no head without a shorthand', () => {
        const block = parseBlockSource('title: Intro: part 1')
        expect(block.head).toBeNull()
        expect(block.fields.get('title')).toBe('Intro: part 1')
    })

    it('refuses stray lines after the first', () => {
        expect(() => parseBlockSource('A\nnonsense')).toThrow('Expected "key: value"')
    })
})

describe('parseRange', () => {
    it('reads single values and ranges', () => {
        expect(parseRange('5-8')).toEqual([5, 8])
        expect(parseRange(' 0 - 12 ')).toEqual([0, 12])
        expect(parseRange('7')).toEqual([7, 7])
        expect(parseRange('8-5')).toBeNull()
        expect(parseRange('a-b')).toBeNull()
    })
})

describe('splitParts', () => {
    it('is null without a separator', () => {
        expect(splitParts('A x02220\ntitle: A')).toBeNull()
        expect(splitParts('title: a -- b')).toBeNull()
    })

    it('splits on lines of three dashes or more, dropping empty parts', () => {
        expect(splitParts('G 320003\n---\nC x32010\r\n  -----  \n\n---\nD xx0232\n---')).toEqual([
            'G 320003',
            'C x32010',
            'D xx0232'
        ])
        expect(splitParts('---\n---')).toEqual([])
    })
})
