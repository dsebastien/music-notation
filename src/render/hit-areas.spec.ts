import { describe, expect, it } from 'bun:test'
import { renderBlock } from './render-block.js'

/**
 * #69: every playable mark (a `data-midi` element of a chord diagram or a fretboard) has an
 * invisible hit area centered on it, at least 24 px along its string and its string's whole lane
 * across, and no two hit areas overlap (a tap never plays the neighbor string).
 */
interface Area {
    x: number
    y: number
    width: number
    height: number
}

const num = (el: Element, name: string) => Number(el.getAttribute(name))

const areaOf = (mark: Element): Area | null => {
    const hit = mark.closest('.mn-mark')?.querySelector(':scope > .mn-hit')
    if (!hit) return null
    return {
        x: num(hit, 'x'),
        y: num(hit, 'y'),
        width: num(hit, 'width'),
        height: num(hit, 'height')
    }
}

const overlap = (a: Area, b: Area) =>
    a.x < b.x + b.width - 1e-6 &&
    b.x < a.x + a.width - 1e-6 &&
    a.y < b.y + b.height - 1e-6 &&
    b.y < a.y + a.height - 1e-6

const sources = [
    ['chord', 'A x02220 x01230'],
    ['chord', 'F 133211 134211'],
    ['chord', 'D x54232\ncapo: 2\nfrets-from: nut'],
    ['chord', 'Bm7 x24232 x13121'],
    ['fretboard', 'A minor pentatonic\nfrets: 0-12'],
    ['fretboard', 'G major\nposition: 1\nshape: E'],
    ['fretboard', 'E major\ntuning: bass']
] as const

describe('hit areas', () => {
    for (const orientation of ['vertical', 'horizontal'] as const) {
        for (const hand of ['right', 'left'] as const) {
            it(`are centered on their marks, in ${orientation} diagrams, ${hand}-handed`, () => {
                for (const [language, source] of sources) {
                    const host = document.createElement('div')
                    const result = renderBlock(language, source, host, {
                        orientation: { chord: orientation, fretboard: orientation },
                        hand
                    })
                    expect(result.ok).toBe(true)
                    const marks = [...host.querySelectorAll('[data-midi]')]
                    expect(marks.length).toBeGreaterThan(0)
                    const areas: Area[] = []
                    for (const mark of marks) {
                        const where = `${language} ${source} ${mark.getAttribute('data-mn-string')}`
                        const area = areaOf(mark)
                        expect(area, where).not.toBeNull()
                        const { x, y, width, height } = area!
                        expect(x + width / 2, where).toBeCloseTo(num(mark, 'cx'))
                        expect(y + height / 2, where).toBeCloseTo(num(mark, 'cy'))
                        // Larger than the mark, and 24 px or more along the string.
                        const r = num(mark, 'r')
                        expect(Math.min(width, height), where).toBeGreaterThan(2 * r)
                        expect(Math.max(width, height), where).toBeGreaterThanOrEqual(24)
                        areas.push(area!)
                    }
                    for (let i = 0; i < areas.length; i++)
                        for (let j = i + 1; j < areas.length; j++)
                            expect(overlap(areas[i]!, areas[j]!), `${source} ${i} ${j}`).toBe(false)
                }
            })
        }
    }

    it('are invisible and drawn under their mark', () => {
        const host = document.createElement('div')
        renderBlock('chord', 'A x02220', host)
        const group = host.querySelector('.mn-mark')!
        const hit = group.firstElementChild!
        expect(hit.getAttribute('class')).toBe('mn-hit')
        expect(hit.getAttribute('fill')).toBe('transparent')
        expect(hit.nextElementSibling?.hasAttribute('data-midi')).toBe(true)
    })

    it('are only drawn for marks that play', () => {
        const host = document.createElement('div')
        // An unknown tuning of 7 strings: nothing to play, no hit area.
        renderBlock('chord', 'x022200', host)
        expect(host.querySelector('.mn-hit')).toBeNull()
        expect(host.querySelectorAll('.mn-dot').length).toBeGreaterThan(0)
    })
})

describe('touch screens (#73)', () => {
    it('draw chord diagrams and fretboards larger, so a string lane is at least 24 px', async () => {
        const { STYLES } = await import('../styles.js')
        const media = /@media \(pointer: coarse\)\s*{([\s\S]*?)\n}/.exec(STYLES)
        expect(media).not.toBeNull()
        const body = media![1]!
        const zoomOf = (cls: string) => {
            const rule = new RegExp(`[^{}]*\\.mn-svg\\.${cls}[^{}]*{([^}]*)}`).exec(body)
            const zoom = rule && /zoom:\s*([\d.]+)/.exec(rule[1]!)
            return zoom ? Number(zoom[1]) : 1
        }
        // A chord diagram's lane is one string spacing (18 units), a fretboard's 20 (#69).
        expect(18 * zoomOf('mn-guitar-chord')).toBeGreaterThanOrEqual(24)
        expect(20 * zoomOf('mn-fretboard')).toBeGreaterThanOrEqual(24)
    })
})
