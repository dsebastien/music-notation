import { afterEach, describe, expect, it } from 'bun:test'
import { renderBlock } from '../render/render-block.js'
import { sequenceOf, type NoteEvent, type NotePlayer } from '../playback/player.js'
import { noteTargets } from '../playback/follow.js'
import { chordPitches, pretty } from './circle.js'
import { describeBlock } from '../cli/describe.js'

const host = () => document.body.appendChild(document.createElement('div'))

afterEach(() => {
    document.body.innerHTML = ''
})

const cell = (h: HTMLElement, ring: string, chord: string) =>
    h.querySelector(`.mn-circle-cell.mn-circle-${ring}[data-mn-chord="${chord}"]`)

describe('circle block', () => {
    it('draws the 12 keys, their relative minors and diminished chords', () => {
        const h = host()
        const result = renderBlock('circle', '', h)
        // An empty block draws nothing, like the other blocks.
        expect(result.ok).toBe(true)
        expect(h.querySelector('svg')).toBeNull()
        renderBlock('circle', 'key: C', h)
        expect(h.querySelectorAll('.mn-circle-cell.mn-circle-major')).toHaveLength(12)
        expect(h.querySelectorAll('.mn-circle-cell.mn-circle-minor')).toHaveLength(12)
        expect(h.querySelectorAll('.mn-circle-cell.mn-circle-dim')).toHaveLength(12)
        const labels = [...h.querySelectorAll('.mn-circle-label-major')].map((t) => t.textContent)
        expect(labels.slice(0, 3)).toEqual(['C', 'I', 'G'])
        expect(labels).toContain('F♯')
        expect(labels).toContain('G♭')
    })

    it('marks a major key’s chords, its tonic and its IV and V', () => {
        const h = host()
        renderBlock('circle', 'G', h)
        expect(cell(h, 'major', 'G')!.getAttribute('class')).toContain('mn-circle-tonic')
        expect(cell(h, 'major', 'C')!.getAttribute('class')).toContain('mn-circle-neighbour')
        expect(cell(h, 'major', 'D')!.getAttribute('class')).toContain('mn-circle-neighbour')
        for (const minor of ['Am', 'Bm', 'Em'])
            expect(cell(h, 'minor', minor)!.getAttribute('class')).toContain('mn-circle-diatonic')
        expect(cell(h, 'dim', 'F#dim')!.getAttribute('class')).toContain('mn-circle-diatonic')
        expect(
            h.querySelectorAll(
                '.mn-circle-cell[class*="mn-circle-"][class*="tonic"], .mn-circle-cell.mn-circle-neighbour, .mn-circle-cell.mn-circle-diatonic'
            )
        ).toHaveLength(7)
        expect(h.querySelector('svg')!.getAttribute('aria-label')).toBe(
            'Circle of fifths, G major: 1♯ (F#); chords: I G, ii Am, iii Bm, IV C, V D, vi Em, vii° F#dim'
        )
        expect(
            [...h.querySelectorAll('.mn-circle-key, .mn-circle-key-sig, .mn-circle-key-notes')].map(
                (t) => t.textContent
            )
        ).toEqual(['G major', '1♯', 'F♯'])
    })

    it('spells the key’s chords as the key does', () => {
        const h = host()
        renderBlock('circle', 'key: F#', h)
        expect(cell(h, 'dim', 'E#dim')).not.toBeNull()
        expect(cell(h, 'major', 'F#')!.getAttribute('class')).toContain('mn-circle-tonic')
        expect([...h.querySelectorAll('.mn-circle-sig-key')].map((t) => t.textContent)).toEqual([
            '5♯',
            '6♯',
            '7♯'
        ])
        const flat = host()
        renderBlock('circle', 'key: Gb', flat)
        expect(cell(flat, 'major', 'Cb')!.getAttribute('class')).toContain('mn-circle-neighbour')
        expect(cell(flat, 'minor', 'Abm')).not.toBeNull()
    })

    it('marks a minor key: i on the inner ring, iv and v its neighbours', () => {
        const h = host()
        renderBlock('circle', 'key: E\nmode: minor', h)
        expect(cell(h, 'minor', 'Em')!.getAttribute('class')).toContain('mn-circle-tonic')
        expect(cell(h, 'minor', 'Am')!.getAttribute('class')).toContain('mn-circle-neighbour')
        expect(cell(h, 'minor', 'Bm')!.getAttribute('class')).toContain('mn-circle-neighbour')
        expect(cell(h, 'major', 'G')!.getAttribute('class')).toContain('mn-circle-diatonic')
        const chips = [...h.querySelectorAll('.mn-circle-chip')].map((c) =>
            c.getAttribute('data-mn-chord')
        )
        expect(chips).toEqual(['Em', 'F#dim', 'G', 'Am', 'Bm', 'C', 'D'])
    })

    it('marks modes, sevenths, and can leave the neighbours plain', () => {
        const h = host()
        renderBlock('circle', 'D dorian\nchords: sevenths\nneighbours: no', h)
        expect(cell(h, 'minor', 'Dm7')!.getAttribute('class')).toContain('mn-circle-tonic')
        expect(cell(h, 'major', 'G7')!.getAttribute('class')).toContain('mn-circle-diatonic')
        expect(h.querySelector('.mn-circle-neighbour')).toBeNull()
        expect(h.querySelectorAll('.mn-circle-sig-key')).toHaveLength(3)
        expect(
            [...h.querySelectorAll('.mn-circle-chip')].map((c) => c.getAttribute('data-mn-chord'))
        ).toEqual(['Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5', 'Cmaj7'])
    })

    it('plays a clicked key or chord through the playback bar, and keeps the wheel when the sound changes', () => {
        const calls: NoteEvent[][] = []
        const player: NotePlayer = {
            play(events) {
                calls.push(events)
                return { stop() {} }
            }
        }
        const h = host()
        renderBlock('circle', 'key: C', h, { play: { player } })
        expect(h.querySelectorAll('.mn-playable')).toHaveLength(1)
        cell(h, 'major', 'G')!.dispatchEvent(new Event('click', { bubbles: true }))
        expect(calls[0]!.map((e) => e.midi)).toEqual([55, 59, 62])
        h.querySelector('.mn-circle-chip[data-mn-chord="Am"]')!.dispatchEvent(
            new Event('click', { bubbles: true })
        )
        expect(calls[1]!.map((e) => e.midi)).toEqual([57, 60, 64])
        // The chord still rings (this player never ends): the first click stops it.
        const toggle = h.querySelector('.mn-play-toggle') as HTMLButtonElement
        toggle.click()
        toggle.click()
        expect(calls[2]!.map((e) => e.midi).slice(0, 8)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
        const sound = h.querySelector('.mn-play-sound') as HTMLSelectElement
        sound.value = 'guitar'
        sound.dispatchEvent(new Event('change'))
        expect(h.querySelector('svg.mn-circle')).not.toBeNull()
        expect(h.querySelector('.mn-fretboard')).toBeNull()
    })

    it('is described by the check command', () => {
        const h = host()
        const { el } = renderBlock('circle', 'key: F', h)
        expect(describeBlock(el)).toEqual([
            {
                type: 'circle',
                key: 'F major',
                chords: ['I F', 'ii Gm', 'iii Am', 'IV B♭', 'V C', 'vi Dm', 'vii° E°']
            }
        ])
    })

    it('says what to write instead', () => {
        const error = (source: string) => renderBlock('circle', source, host()).error
        expect(error('key: H')).toContain('Unknown key "H"')
        expect(error('key: C\nmode: blues')).toContain('Unknown mode "blues"')
        expect(error('key: Am\nmode: major')).toContain('already says minor')
        expect(error('key: C\nchords: ninths')).toContain('chords: use triads or sevenths')
        expect(error('key: C\nneighbours: maybe')).toContain('yes or no')
    })
})

describe('circle helpers', () => {
    it('write names with ♯, ♭, ° and ø', () => {
        expect(pretty('F#')).toBe('F♯')
        expect(pretty('Bbm7b5')).toBe('B♭ø7')
        expect(pretty('E#dim')).toBe('E♯°')
        expect(pretty('Cdim7')).toBe('C°7')
    })

    it('voice chords around middle C', () => {
        expect(chordPitches('C')).toEqual([60, 64, 67])
        expect(chordPitches('F#')).toEqual([66, 70, 73])
        expect(chordPitches('G7')).toEqual([55, 59, 62, 65])
        expect(chordPitches('nope')).toEqual([])
    })
})

describe('following the scale on the circle', () => {
    // The bar plays the key's scale: each note lights its chord's cell and chip (the root's pitch
    // class), never a chord outside the key or of another quality on the same root.
    const lit = (key: string) => {
        const h = host()
        renderBlock('circle', `key: ${key}`, h)
        const svg = h.querySelector('svg[data-mn-pitches]')!
        const pitches = svg.getAttribute('data-mn-pitches')!.split(' ').map(Number)
        const events = sequenceOf('scale', pitches)
        return noteTargets(svg, events, 'scale').map((targets, i) => [
            events[i]!.midi,
            targets
                .map(
                    (el) =>
                        `${el.getAttribute('class')!.split(' ')[0]}:${el.getAttribute('data-mn-chord')}`
                )
                .sort()
                .join(' ')
        ])
    }

    it('lights the key chord on each scale note', () => {
        const c = lit('C')
        expect(c.slice(0, 8)).toEqual([
            [60, 'mn-circle-cell:C mn-circle-chip:C'],
            [62, 'mn-circle-cell:Dm mn-circle-chip:Dm'],
            [64, 'mn-circle-cell:Em mn-circle-chip:Em'],
            [65, 'mn-circle-cell:F mn-circle-chip:F'],
            [67, 'mn-circle-cell:G mn-circle-chip:G'],
            [69, 'mn-circle-cell:Am mn-circle-chip:Am'],
            [71, 'mn-circle-cell:Bdim mn-circle-chip:Bdim'],
            [72, 'mn-circle-cell:C mn-circle-chip:C']
        ])
        // Down again, the same chords.
        expect(c[14]).toEqual(c[0])
    })

    it('lights every note in other keys and modes', () => {
        for (const key of ['G', 'F#', 'Bb', 'A minor', 'D dorian']) {
            const notes = lit(key)
            for (const [midi, targets] of notes) {
                expect(`${key} ${midi}: ${(targets as string).split(' ').length}`).toBe(
                    `${key} ${midi}: 2`
                )
            }
        }
        expect(lit('A minor')[0]).toEqual([69, 'mn-circle-cell:Am mn-circle-chip:Am'])
    })

    it('still plays a clicked cell outside the key', () => {
        const h = host()
        renderBlock('circle', 'key: C', h)
        const ab = cell(h, 'major', 'Ab')!
        expect(ab.getAttribute('data-midi')).toBe('56')
        expect(ab.hasAttribute('data-mn-chroma')).toBe(false)
        expect(cell(h, 'major', 'C')!.getAttribute('data-mn-chroma')).toBe('0')
    })
})
