import { describe, expect, test } from 'bun:test'
import { parseMarkdown } from './markdown.js'

const blocks = (text: string) =>
    parseMarkdown(text).blocks.map(({ language, line, source }) => [language, line, source])

describe('parseMarkdown', () => {
    test('finds ``` and ~~~ fences of any length, with their opening line', () => {
        const text = [
            '# Title',
            '```chord',
            'Am',
            '```',
            '~~~~fretboard',
            'A minor pentatonic',
            '~~~~',
            '`````keyboard extra words',
            'C major',
            '`````'
        ].join('\n')
        expect(blocks(text)).toEqual([
            ['chord', 2, 'Am'],
            ['fretboard', 5, 'A minor pentatonic'],
            ['keyboard', 8, 'C major']
        ])
    })

    test('a fence closes only with the same character, at least as long', () => {
        const text = [
            '````markdown',
            '```chord',
            'Hm7',
            '```',
            '~~~~',
            '````',
            '```chord',
            'C',
            '```'
        ].join('\n')
        expect(blocks(text)).toEqual([
            ['markdown', 1, '```chord\nHm7\n```\n~~~~'],
            ['chord', 7, 'C']
        ])
    })

    test('blocks in callouts and nested quotes lose their quote markers', () => {
        const text = [
            '> [!tip] Chords',
            '> ```chord',
            '> Am',
            '>',
            '> ```',
            '> > ~~~keyboard',
            '> > C major',
            '> > ~~~'
        ].join('\n')
        expect(blocks(text)).toEqual([
            ['chord', 2, 'Am\n'],
            ['keyboard', 6, 'C major']
        ])
    })

    test('a quote that ends closes its block', () => {
        expect(blocks('> ```chord\n> Am\nnot quoted\n```chord\nC\n```')).toEqual([
            ['chord', 1, 'Am'],
            ['chord', 4, 'C']
        ])
    })

    test('blocks in list items lose their indentation', () => {
        const text = [
            '- Item',
            '    ```chord',
            '    C x32010',
            '      indented',
            '    ```',
            '1. ```keyboard',
            '   C major',
            '   ```'
        ].join('\n')
        expect(blocks(text)).toEqual([
            ['chord', 2, 'C x32010\n  indented'],
            ['keyboard', 6, 'C major']
        ])
    })

    test('CRLF and LF notes give the same blocks and lines', () => {
        const lf = '---\na: 1\n---\n\n```chord\nAm\n```\n\n```keyboard\nC major\n```\n'
        expect(blocks(lf.replace(/\n/g, '\r\n'))).toEqual(blocks(lf))
        expect(blocks(lf)).toEqual([
            ['chord', 5, 'Am'],
            ['keyboard', 9, 'C major']
        ])
    })

    test('the front matter is skipped and kept apart', () => {
        const note = parseMarkdown('\uFEFF---\nchord_symbol: Am\n---\n```chord\n```')
        expect(note.frontMatter).toBe('chord_symbol: Am')
        expect(note.blocks).toEqual([{ language: 'chord', line: 4, source: '' }])
        // No closing line: not front matter.
        expect(parseMarkdown('---\n```chord\nC\n```').frontMatter).toBeNull()
        expect(parseMarkdown('# Note').frontMatter).toBeNull()
    })

    test('inline code is not a fence; an unclosed fence runs to the end', () => {
        expect(blocks('```chord` inline\n```chord\nAm\nC')).toEqual([['chord', 2, 'Am\nC']])
    })

    test('skips indented code outside lists, and blocks inside comments (review of #35)', () => {
        const text = [
            'Para',
            '',
            '    ```chord',
            '    Am',
            '    ```',
            '',
            '- item',
            '',
            '    ```chord',
            '    C',
            '    ```',
            '',
            '%%',
            '```chord',
            'Hm',
            '```',
            '%%',
            '<!--',
            '```chord',
            'Xm',
            '```',
            '-->',
            '```chord',
            'G',
            '```'
        ].join('\n')
        expect(parseMarkdown(text).blocks.map((b) => b.source)).toEqual(['C', 'G'])
    })
})
