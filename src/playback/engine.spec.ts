import { describe, expect, test } from 'bun:test'
import { blockEngine, chooseEngine, engineOf, engineOrder, engineWish } from './engine.js'

describe('engineOf', () => {
    test('reads the three names, whatever the case', () => {
        expect(engineOf('generaluser')).toBe('generaluser')
        expect(engineOf(' Sonivox ')).toBe('sonivox')
        expect(engineOf('LIGHT')).toBe('light')
    })
    test('anything else is no engine', () => {
        expect(engineOf('piano')).toBeNull()
        expect(engineOf('')).toBeNull()
        expect(engineOf(undefined)).toBeNull()
        expect(engineOf(3)).toBeNull()
    })
})

describe('engineOrder', () => {
    test('the fallback order without a wish', () => {
        expect(engineOrder()).toEqual(['generaluser', 'sonivox', 'light'])
        expect(engineOrder(null)).toEqual(['generaluser', 'sonivox', 'light'])
    })
    test('the wish first, then the fallback order', () => {
        expect(engineOrder('light')).toEqual(['light', 'generaluser', 'sonivox'])
        expect(engineOrder('sonivox')).toEqual(['sonivox', 'generaluser', 'light'])
        expect(engineOrder('generaluser')).toEqual(['generaluser', 'sonivox', 'light'])
    })
})

describe('chooseEngine', () => {
    const host = (names: string[]) => (engine: string) => (names.includes(engine) ? engine : null)
    test('the wish when the host has it', () => {
        expect(chooseEngine('light', host(['generaluser', 'light']))?.engine).toBe('light')
        expect(chooseEngine('sonivox', host(['sonivox', 'light']))?.engine).toBe('sonivox')
    })
    test('a wish the host cannot give falls back, in order', () => {
        expect(chooseEngine('sonivox', host(['generaluser', 'light']))?.engine).toBe('generaluser')
        expect(chooseEngine('generaluser', host(['light']))?.engine).toBe('light')
        expect(chooseEngine('light', host(['generaluser', 'sonivox']))?.engine).toBe('generaluser')
    })
    test('no wish: the best the host has', () => {
        expect(chooseEngine(null, host(['sonivox', 'light']))?.engine).toBe('sonivox')
        expect(chooseEngine(undefined, host(['light']))?.engine).toBe('light')
    })
    test('null when the host has none', () => {
        expect(chooseEngine('light', () => null)).toBeNull()
        expect(chooseEngine(null, () => false)).toBeNull()
    })
    test('gives what the host returned', () => {
        expect(chooseEngine(null, (engine) => (engine === 'sonivox' ? { n: 1 } : null))).toEqual({
            engine: 'sonivox',
            value: { n: 1 }
        })
    })
})

describe('blockEngine', () => {
    test('no line: the source as it is', () => {
        expect(blockEngine('chord: Am\nlabels: notes')).toEqual({
            engine: null,
            source: 'chord: Am\nlabels: notes'
        })
    })
    test('takes the line out, anywhere in the block', () => {
        expect(blockEngine('engine: light\nAm x02210')).toEqual({
            engine: 'light',
            source: 'Am x02210'
        })
        expect(blockEngine('chord: Am\n  Engine : Sonivox  \nlabels: notes')).toEqual({
            engine: 'sonivox',
            source: 'chord: Am\nlabels: notes'
        })
        expect(blockEngine('chord: Am\r\nengine: generaluser')).toEqual({
            engine: 'generaluser',
            source: 'chord: Am\r\n'
        })
    })
    test('keeps the empty lines of the block', () => {
        expect(blockEngine('a: 1\n\nengine: light\n\nb: 2').source).toBe('a: 1\n\n\nb: 2')
    })
    test('the last line wins', () => {
        expect(blockEngine('engine: light\nAm\nengine: sonivox').engine).toBe('sonivox')
    })
    test('a wrong value is a message for the user', () => {
        expect(() => blockEngine('engine: loud\nAm')).toThrow(
            'engine: use generaluser, sonivox or light, got "loud"'
        )
        expect(() => blockEngine('engine:\nAm')).toThrow('got ""')
    })
    test('a chart reads the directive only: a lyric line stays', () => {
        expect(blockEngine('{engine: light}\n[Am]Engine: running', true)).toEqual({
            engine: 'light',
            source: '[Am]Engine: running'
        })
        expect(blockEngine('engine: running hot\n[Am]la', true)).toEqual({
            engine: null,
            source: 'engine: running hot\n[Am]la'
        })
        expect(() => blockEngine('{engine: loud}', true)).toThrow('got "loud"')
    })
})

describe('engineWish', () => {
    test('reads the block an element is in', () => {
        const block = document.createElement('div')
        block.setAttribute('data-mn-engine', 'light')
        const inner = document.createElement('span')
        block.appendChild(inner)
        expect(engineWish(inner)).toBe('light')
        expect(engineWish(block)).toBe('light')
    })
    test('null without a wish', () => {
        expect(engineWish(document.createElement('div'))).toBeNull()
        expect(engineWish(null)).toBeNull()
    })
})
