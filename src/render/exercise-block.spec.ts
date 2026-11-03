import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from './render-block.js'
import { exerciseTab } from '../fretboard/exercise.js'
import { describeBlock, formatDiagram } from '../cli/describe.js'

const host = () => document.createElement('div')

afterEach(() => {
    document.body.innerHTML = ''
})

/** The alphaTex a fretboard block's exercise shows under its diagram. */
const texOf = (el: Element) =>
    el.querySelector('pre.mn-exercise > code.language-tab')?.textContent ?? null

describe('fretboard exercises (#47)', () => {
    it('shows the tab of a position under its diagram', () => {
        const h = host()
        const result = renderBlock(
            'fretboard',
            'scale: A minor pentatonic\nposition: 1\nexercise: up-down',
            h
        )
        expect(result.ok).toBe(true)
        expect(h.querySelectorAll('svg.mn-fretboard')).toHaveLength(1)
        expect(texOf(h)).toBe(exerciseTab({ scale: 'A minor pentatonic' }, { position: 1 }))
        // The tab comes after the diagram.
        const wrap = h.querySelector('.mn-exercise-block')!
        expect(wrap.firstElementChild!.tagName.toLowerCase()).toBe('svg')
        expect(wrap.lastElementChild!.tagName.toLowerCase()).toBe('pre')
    })

    it('reads the rhythm and the tempo, else takes the app tempo', () => {
        const h = host()
        renderBlock(
            'fretboard',
            'arpeggio: Am7\nshape: E\nexercise: up\nrhythm: 16ths\ntempo: 100',
            h
        )
        expect(texOf(h)).toBe(
            exerciseTab(
                { arpeggio: 'Am7' },
                { shape: 'E', direction: 'up', rhythm: '16ths', tempo: 100 }
            )
        )
        const bpm = host()
        renderBlock('fretboard', 'scale: C major\nposition: 2\nexercise: down\nbpm: 80', bpm)
        expect(texOf(bpm)).toContain('\\tempo 80')
        const app = host()
        renderBlock('fretboard', 'scale: C major\nposition: 2\nexercise: down', app, {
            play: { bpm: 72 }
        })
        expect(texOf(app)).toContain('\\tempo 72')
    })

    it('plays only the strings drawn, and the frets asked for', () => {
        const h = host()
        renderBlock(
            'fretboard',
            'scale: A minor pentatonic\nposition: 1\nstrings: 1-3\nexercise: up',
            h
        )
        expect(texOf(h)).toContain(':8 5.3 7.3 5.2 8.2 5.1 8.1 r r')
        const high = host()
        renderBlock(
            'fretboard',
            'scale: A minor pentatonic\nposition: 1\nfrets: 15-22\nexercise: up',
            high
        )
        expect(texOf(high)).toContain(':8 17.6 20.6')
    })

    it('lets the app draw the tab, and frees it with the block', () => {
        const h = host()
        const calls: { source: string; holder: HTMLElement }[] = []
        let freed = 0
        const result = renderBlock(
            'fretboard',
            'scale: A minor pentatonic\nposition: 1\nexercise: up-down',
            h,
            {
                tab: (source, holder) => {
                    calls.push({ source, holder })
                    return () => freed++
                }
            }
        )
        expect(calls).toHaveLength(1)
        expect(calls[0]!.source).toBe(exerciseTab({ scale: 'A minor pentatonic' }, { position: 1 }))
        expect(calls[0]!.holder.classList.contains('mn-exercise-tab')).toBe(true)
        expect(result.el.contains(calls[0]!.holder)).toBe(true)
        // The app draws it: no source left under the diagram.
        expect(h.querySelector('pre.mn-exercise')).toBeNull()
        result.destroy()
        expect(freed).toBe(1)
    })

    it('says what to write instead', () => {
        const error = (source: string) => renderBlock('fretboard', source, host()).error
        expect(error('scale: A minor\nexercise: up')).toBe(
            'exercise plays one position: add position: 1 (or shape: E)'
        )
        expect(error('scale: A minor pentatonic\nposition: 1\nexercise: sideways')).toBe(
            'exercise: use up, down or up-down, got "sideways"'
        )
        expect(error('scale: A minor pentatonic\nposition: 1\nrhythm: 16ths')).toBe(
            'rhythm goes with exercise: e.g. exercise: up-down'
        )
        expect(error('scale: A minor pentatonic\nposition: 1\nexercise: up\nrhythm: 4ths')).toBe(
            'rhythm: use 8ths, triplets or 16ths, got "4ths"'
        )
        expect(error('scale: A minor pentatonic\nposition: 1\nexercise: up\ntempo: fast')).toBe(
            'Invalid tempo "fast": use beats a minute from 20 to 240, e.g. tempo: 80'
        )
        expect(error('scale: A minor pentatonic\npositions: all\nexercise: up')).toBe(
            'exercise plays one position: write position: 1 (not positions:)'
        )
        expect(error('scale: A minor pentatonic\nposition: 1\ncapo: 2\nexercise: up')).toBe(
            'exercise does not go with capo yet: leave capo out (the shape is the same)'
        )
        expect(
            error(
                'scale: A minor pentatonic\nposition: 1\nexercise: up\n---\nscale: A minor pentatonic\nposition: 2'
            )
        ).toBe('diagram 1: exercise draws a tab under one diagram: use it in a block of its own')
    })

    it('describes the exercise for the check command', () => {
        const h = host()
        renderBlock(
            'fretboard',
            'scale: A minor pentatonic\nposition: 1\nexercise: up-down\nrhythm: triplets',
            h
        )
        const diagrams = describeBlock(h)
        expect(diagrams.map((d) => d.type)).toEqual(['fretboard', 'exercise'])
        expect(formatDiagram(diagrams[1]!, 2)).toEqual([
            '2. exercise, up-down, triplets, tempo 60, 23 notes',
            '   5.6 8.6 5.5 7.5 5.4 7.4 5.3 7.3 5.2 8.2 5.1 8.1 5.1 8.2 5.2 7.3 5.3 7.4 5.4 7.5 5.5 8.6 5.6'
        ])
    })
})
