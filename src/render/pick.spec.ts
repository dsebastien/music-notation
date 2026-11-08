import { describe, expect, it } from 'bun:test'
import { renderFretboard } from '../fretboard/fretboard.js'
import { renderKeyboard } from '../keyboard/keyboard.js'
import { emptyNoteSet, scaleNoteSet } from '../theory/note-set.js'
import { attachPick, type Pick, type PickLayer } from './pick.js'
import { renderBlock } from './render-block.js'
import { accessibleName } from './dom.js'
import { STYLES } from '../styles.js'
import type { NotationLanguage, RenderOptions } from '../blocks/renderers.js'

/**
 * The pick layer (Music Practice #73): every string × fret of a fretboard and every key of a
 * keyboard is a target a click or the keyboard picks; the app marks picks right or wrong.
 */
const num = (el: Element, name: string) => Number(el.getAttribute(name))
const box = (el: Element) => ({
    x: num(el, 'x'),
    y: num(el, 'y'),
    width: num(el, 'width'),
    height: num(el, 'height')
})
const overlap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
    a.x < b.x + b.width - 1e-6 &&
    b.x < a.x + a.width - 1e-6 &&
    a.y < b.y + b.height - 1e-6 &&
    b.y < a.y + a.height - 1e-6

const targetsOf = (root: Element) => [...root.querySelectorAll('.mn-picks > rect.mn-pick')]
const at = (root: Element, string: number, fret: number) =>
    root.querySelector(`.mn-pick[data-mn-string="${string}"][data-mn-fret="${fret}"]`)!

const mounted = (el: Element) => {
    document.body.appendChild(el)
    return el
}

const key = (el: Element, k: string) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))

const empty = emptyNoteSet()

describe('pick layer: fretboard targets', () => {
    it('is off by default', () => {
        const root = renderFretboard(document, empty)
        expect(root.querySelector('.mn-picks')).toBeNull()
        expect(root.hasAttribute('data-mn-pick')).toBe(false)
    })

    it('has a target on every string at every fret shown, the open strings included', () => {
        const root = renderFretboard(document, empty, { pick: true, frets: [0, 5] })
        expect(root.hasAttribute('data-mn-pick')).toBe(true)
        const targets = targetsOf(root)
        expect(targets).toHaveLength(6 * 6)
        // Standard tuning: string 6 open is E2 (40), string 1 fret 5 is A4 (69).
        expect(at(root, 6, 0).getAttribute('data-mn-pitch')).toBe('40')
        expect(at(root, 6, 0).getAttribute('data-mn-note')).toBe('E')
        expect(at(root, 1, 5).getAttribute('data-mn-pitch')).toBe('69')
        expect(at(root, 5, 3).getAttribute('data-mn-note')).toBe('C')
        expect(at(root, 5, 1).getAttribute('data-mn-note')).toBe('A#')
        // Never data-midi: playback and note following leave the layer alone.
        expect(root.querySelector('.mn-picks [data-midi]')).toBeNull()
        // Painted (it takes clicks) but invisible, without the stylesheet too.
        expect(targets[0]!.getAttribute('fill')).toBe('transparent')
        expect(targets[0]!.getAttribute('pointer-events')).toBe('all')
    })

    it('starts at the first fret shown, without the open column', () => {
        const root = renderFretboard(document, empty, { pick: true, frets: [5, 9] })
        expect(targetsOf(root)).toHaveLength(6 * 5)
        expect(root.querySelector('.mn-pick[data-mn-fret="0"]')).toBeNull()
        expect(root.querySelector('.mn-pick[data-mn-fret="4"]')).toBeNull()
    })

    it('spells notes as the set does', () => {
        const root = renderFretboard(document, scaleNoteSet('F major')!, {
            pick: true,
            frets: [0, 5]
        })
        // Bb is in F major; Eb isn't, but the set prefers flats.
        expect(at(root, 3, 3).getAttribute('data-mn-note')).toBe('Bb')
        expect(at(root, 4, 1).getAttribute('data-mn-note')).toBe('Eb')
    })

    it('is drawn last, above the dots', () => {
        const root = renderFretboard(document, scaleNoteSet('A minor pentatonic')!, {
            pick: true
        })
        const last = [...root.children].filter((c) => c.tagName.toLowerCase() !== 'defs').at(-1)
        expect(last?.classList.contains('mn-picks')).toBe(true)
    })

    it("gives each target the hit area's cell, and no two overlap", () => {
        for (const orientation of ['horizontal', 'vertical'] as const) {
            for (const hand of ['right', 'left'] as const) {
                const root = renderFretboard(document, scaleNoteSet('A minor pentatonic')!, {
                    pick: true,
                    frets: [0, 7],
                    orientation,
                    hand
                })
                const targets = targetsOf(root).map(box)
                for (let i = 0; i < targets.length; i++)
                    for (let j = i + 1; j < targets.length; j++)
                        expect(overlap(targets[i]!, targets[j]!)).toBe(false)
                // A dot's hit area is its target's cell.
                for (const dot of root.querySelectorAll('.mn-dot[data-mn-string]')) {
                    const hit = dot.closest('.mn-mark')!.querySelector('.mn-hit')!
                    const target = at(root, num(dot, 'data-mn-string'), num(dot, 'data-mn-fret'))
                    expect(box(target)).toEqual(box(hit))
                    expect(num(target, 'data-mn-mark-x')).toBe(num(dot, 'cx'))
                    expect(num(target, 'data-mn-mark-y')).toBe(num(dot, 'cy'))
                }
            }
        }
    })

    it('has no target behind a capo drawn from the nut', () => {
        const root = renderFretboard(document, empty, {
            pick: true,
            capo: 2,
            fretsFrom: 'nut',
            frets: [0, 6]
        })
        expect(root.querySelector('.mn-pick[data-mn-fret="0"]')).toBeNull()
        expect(root.querySelector('.mn-pick[data-mn-fret="1"]')).toBeNull()
        expect(at(root, 6, 2).getAttribute('data-mn-pitch')).toBe('42')
    })

    it('counts frets from the capo by default: open strings sound at it', () => {
        const root = renderFretboard(document, empty, { pick: true, capo: 2, frets: [0, 3] })
        expect(at(root, 6, 0).getAttribute('data-mn-pitch')).toBe('42')
    })

    it('puts targets on strings that strings: leaves without dots', () => {
        const root = renderFretboard(document, scaleNoteSet('C major')!, {
            pick: true,
            strings: [3, 4, 5],
            frets: [0, 3]
        })
        expect(targetsOf(root)).toHaveLength(6 * 4)
    })
})

describe('pick layer: keyboard targets', () => {
    it('is off by default', () => {
        expect(
            renderKeyboard(document, empty, { range: [60, 71] }).querySelector('.mn-picks')
        ).toBeNull()
    })

    it('has a target on every key, black keys on top', () => {
        const root = renderKeyboard(document, empty, { pick: true, range: [60, 71] })
        const targets = targetsOf(root)
        expect(targets).toHaveLength(12)
        const pitches = targets.map((t) => num(t, 'data-mn-pitch'))
        // The white keys first, then the black ones (drawn later, so on top).
        expect(pitches).toEqual([60, 62, 64, 65, 67, 69, 71, 61, 63, 66, 68, 70])
        expect(
            targets.find((t) => num(t, 'data-mn-pitch') === 61)!.getAttribute('data-mn-note')
        ).toBe('C#')
        expect(root.querySelector('.mn-pick[data-mn-string]')).toBeNull()
        // Each target is its key's rectangle.
        const keyRect = root.querySelector('rect[data-midi="63"]')!
        expect(box(targets.find((t) => num(t, 'data-mn-pitch') === 63)!)).toEqual(box(keyRect))
    })

    it('works in a vertical keyboard', () => {
        const root = renderKeyboard(document, empty, {
            pick: true,
            range: [60, 71],
            orientation: 'vertical'
        })
        expect(targetsOf(root)).toHaveLength(12)
    })
})

describe('pick layer: attachPick', () => {
    const fretboard = (options = {}) =>
        mounted(renderFretboard(document, empty, { pick: true, frets: [0, 5], ...options }))

    it('names the diagram a group and each target by its place, never its note', () => {
        const root = fretboard()
        expect(root.getAttribute('role')).toBe('img')
        const layer = attachPick(root)
        expect(root.getAttribute('role')).toBe('group')
        const target = at(root, 5, 3)
        expect(target.getAttribute('role')).toBe('button')
        expect(target.hasAttribute('aria-label')).toBe(false)
        expect(accessibleName(target)).toBe('String 5, fret 3')
        expect(accessibleName(at(root, 1, 0))).toBe('String 1, open')
        layer.destroy()
        expect(root.getAttribute('role')).toBe('img')
        expect(target.hasAttribute('role')).toBe(false)
        expect(target.hasAttribute('tabindex')).toBe(false)
    })

    it('names keys by their place from the low end', () => {
        const root = mounted(renderKeyboard(document, empty, { pick: true, range: [60, 71] }))
        attachPick(root)
        const name = (pitch: number) =>
            accessibleName(root.querySelector(`.mn-pick[data-mn-pitch="${pitch}"]`)!)
        expect(name(60)).toBe('White key 1')
        expect(name(64)).toBe('White key 3')
        expect(name(61)).toBe('Black key 1')
        expect(name(70)).toBe('Black key 5')
    })

    it('picks a target on a click, with its string, fret, note and pitch', () => {
        const root = fretboard()
        const picks: Pick[] = []
        let given: PickLayer | null = null
        const layer = attachPick(root, {
            onPick: (pick, l) => {
                picks.push(pick)
                given = l
            }
        })
        at(root, 5, 3).dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(picks).toHaveLength(1)
        expect(picks[0]).toMatchObject({
            string: 5,
            fret: 3,
            note: 'C',
            pitch: 48,
            via: 'pointer'
        })
        expect(picks[0]!.element as Element).toBe(at(root, 5, 3))
        expect(given!).toBe(layer)
    })

    it('ignores a click outside the targets', () => {
        const root = fretboard()
        const picks: Pick[] = []
        attachPick(root, { onPick: (p) => picks.push(p) })
        root.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(picks).toHaveLength(0)
    })

    it('never lets a press on a target reach the host', () => {
        const host = document.createElement('div')
        const root = renderFretboard(document, empty, { pick: true, frets: [0, 5] })
        host.appendChild(root)
        document.body.appendChild(host)
        attachPick(root)
        const reached: string[] = []
        for (const type of ['pointerdown', 'mousedown', 'click'])
            host.addEventListener(type, () => reached.push(type))
        const target = at(root, 4, 2)
        target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(reached).toEqual([])
    })

    it('keeps one target in the tab order: the first at the start, then the last focused', () => {
        const root = fretboard()
        attachPick(root)
        const stops = () => targetsOf(root).filter((t) => t.getAttribute('tabindex') === '0')
        expect(stops()).toEqual([at(root, 1, 0)])
        expect(targetsOf(root).every((t) => t.hasAttribute('tabindex'))).toBe(true)
        ;(at(root, 3, 2) as SVGElement).focus()
        expect(stops()).toEqual([at(root, 3, 2)])
    })

    it('puts no focus listener on the diagram: Chromium makes an SVG element with one a tab stop', () => {
        const root = fretboard()
        const types: string[] = []
        const spy = (el: Element) => {
            const add = el.addEventListener.bind(el)
            ;(el as { addEventListener: unknown }).addEventListener = (
                type: string,
                listener: EventListener,
                options?: boolean
            ) => {
                types.push(type)
                add(type, listener, options)
            }
        }
        spy(root)
        for (const group of root.querySelectorAll('.mn-picks')) spy(group)
        attachPick(root)
        expect(types.filter((t) => /^(focus|blur)/.test(t))).toEqual([])
    })

    it('picks the focused target with Space or Enter', () => {
        const root = fretboard()
        const picks: Pick[] = []
        attachPick(root, { onPick: (p) => picks.push(p) })
        const target = at(root, 2, 1) as SVGElement
        target.focus()
        key(target, 'Enter')
        key(target, ' ')
        expect(picks.map((p) => [p.string, p.fret, p.via])).toEqual([
            [2, 1, 'keyboard'],
            [2, 1, 'keyboard']
        ])
    })

    it('moves with the arrows along the frets and across the strings, as drawn', () => {
        const cases = [
            // Horizontal, right-handed: frets go right, the high string is on top.
            [{}, { ArrowRight: [3, 3], ArrowLeft: [3, 1], ArrowUp: [2, 2], ArrowDown: [4, 2] }],
            // Left-handed: mirrored, the nut on the right.
            [
                { hand: 'left' },
                { ArrowRight: [3, 1], ArrowLeft: [3, 3], ArrowUp: [2, 2], ArrowDown: [4, 2] }
            ],
            // Vertical: the nut on top, the low string on the left.
            [
                { orientation: 'vertical' },
                { ArrowDown: [3, 3], ArrowUp: [3, 1], ArrowLeft: [4, 2], ArrowRight: [2, 2] }
            ]
        ] as const
        for (const [options, moves] of cases) {
            for (const [arrow, [string, fret]] of Object.entries(moves)) {
                const root = fretboard(options)
                attachPick(root)
                const from = at(root, 3, 2) as SVGElement
                from.focus()
                expect(key(from, arrow)).toBe(false) // handled: default prevented
                expect(document.activeElement).toBe(at(root, string, fret))
                root.remove()
            }
        }
    })

    it('stays on the edge, and goes to the ends of the string with Home and End', () => {
        const root = fretboard()
        attachPick(root)
        const edge = at(root, 1, 0) as SVGElement
        edge.focus()
        key(edge, 'ArrowUp')
        expect(document.activeElement).toBe(edge)
        key(edge, 'ArrowLeft')
        expect(document.activeElement).toBe(edge)
        key(edge, 'End')
        expect(document.activeElement).toBe(at(root, 1, 5))
        key(document.activeElement!, 'Home')
        expect(document.activeElement).toBe(at(root, 1, 0))
    })

    it('moves by pitch on keyboards, in both orientations', () => {
        for (const orientation of ['horizontal', 'vertical'] as const) {
            const root = mounted(
                renderKeyboard(document, empty, { pick: true, range: [60, 71], orientation })
            )
            attachPick(root)
            const keyAt = (pitch: number) =>
                root.querySelector(`.mn-pick[data-mn-pitch="${pitch}"]`)!
            ;(keyAt(64) as SVGElement).focus()
            key(keyAt(64), 'ArrowRight')
            expect(document.activeElement).toBe(keyAt(65))
            key(keyAt(65), 'ArrowUp')
            expect(document.activeElement).toBe(keyAt(66))
            key(keyAt(66), 'ArrowLeft')
            key(keyAt(65), 'ArrowDown')
            expect(document.activeElement).toBe(keyAt(64))
            key(keyAt(64), 'End')
            expect(document.activeElement).toBe(keyAt(71))
            key(keyAt(71), 'Home')
            expect(document.activeElement).toBe(keyAt(60))
            root.remove()
        }
    })

    it('lets other keys through to the host', () => {
        const root = fretboard()
        attachPick(root)
        const target = at(root, 1, 0) as SVGElement
        target.focus()
        expect(key(target, 'Tab')).toBe(true)
        expect(key(target, 'a')).toBe(true)
    })

    it('marks picks right or wrong, with a shape and in the name', () => {
        const root = fretboard()
        const layer = attachPick(root)
        expect(layer.mark({ string: 5, fret: 3 }, 'right')).toBe(true)
        expect(layer.mark({ pitch: 45 }, 'wrong')).toBe(true) // string 6 fret 5 and string 5 open
        expect(layer.mark({ string: 7, fret: 0 }, 'right')).toBe(false)
        const marks = [...root.querySelectorAll('.mn-pick-marks > .mn-pick-mark')]
        expect(marks).toHaveLength(3)
        expect(root.querySelectorAll('.mn-pick-mark.mn-pick-right')).toHaveLength(1)
        expect(root.querySelectorAll('.mn-pick-mark.mn-pick-wrong')).toHaveLength(2)
        // A check and a cross: the shape tells them apart, not only the color.
        expect(root.querySelector('.mn-pick-right path.mn-pick-check')).not.toBeNull()
        expect(root.querySelector('.mn-pick-wrong path.mn-pick-cross')).not.toBeNull()
        const target = at(root, 5, 3)
        expect(target.classList.contains('mn-pick-right')).toBe(true)
        expect(accessibleName(target)).toBe('String 5, fret 3, right')
        // Marks are drawn above the layer and ignore the pointer.
        expect(root.lastElementChild?.classList.contains('mn-pick-marks')).toBe(true)
        expect(root.querySelector('.mn-pick-marks')!.getAttribute('pointer-events')).toBe('none')
        const mark = root.querySelector('.mn-pick-right')!
        expect(mark.getAttribute('data-mn-string')).toBe('5')
        expect(mark.getAttribute('data-mn-fret')).toBe('3')
    })

    it('marks only the picked place when given a pick (its place wins over its pitch)', () => {
        const root = fretboard({ frets: [0, 12] })
        const picks: Pick[] = []
        const layer = attachPick(root, { onPick: (p) => picks.push(p) })
        // String 5 fret 10 is G3 (55), as are string 4 fret 5 and string 3 open.
        at(root, 5, 10).dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(layer.mark(picks[0]!, 'right')).toBe(true)
        expect(root.querySelectorAll('.mn-pick-mark')).toHaveLength(1)
        expect(at(root, 4, 5).classList.contains('mn-pick-right')).toBe(false)
        // A key has no string: a keyboard pick marks its key.
        const kb = mounted(renderKeyboard(document, empty, { pick: true, range: [60, 71] }))
        const keys: Pick[] = []
        const keyLayer = attachPick(kb, { onPick: (p) => keys.push(p) })
        kb.querySelector('.mn-pick[data-mn-pitch="62"]')!.dispatchEvent(
            new MouseEvent('click', { bubbles: true })
        )
        expect(keyLayer.mark(keys[0]!, 'wrong')).toBe(true)
        expect(kb.querySelectorAll('.mn-pick-mark')).toHaveLength(1)
    })

    it('replaces a mark, unmarks and clears', () => {
        const root = fretboard()
        const layer = attachPick(root)
        layer.mark({ string: 5, fret: 3 }, 'wrong')
        layer.mark({ string: 5, fret: 3 }, 'right')
        expect(root.querySelectorAll('.mn-pick-mark')).toHaveLength(1)
        expect(at(root, 5, 3).classList.contains('mn-pick-wrong')).toBe(false)
        layer.mark({ string: 4, fret: 2 }, 'wrong')
        expect(layer.unmark({ string: 5, fret: 3 })).toBe(true)
        expect(accessibleName(at(root, 5, 3))).toBe('String 5, fret 3')
        expect(root.querySelectorAll('.mn-pick-mark')).toHaveLength(1)
        layer.clear()
        expect(root.querySelectorAll('.mn-pick-mark')).toHaveLength(0)
        expect(root.querySelector('.mn-pick-wrong')).toBeNull()
    })

    it('focuses a target, and lists every target as a pick', () => {
        const root = fretboard()
        const layer = attachPick(root)
        layer.focus({ string: 4, fret: 4 })
        expect(document.activeElement).toBe(at(root, 4, 4))
        layer.focus()
        expect(document.activeElement).toBe(at(root, 4, 4))
        const all = layer.targets()
        expect(all).toHaveLength(36)
        expect(all[0]).toMatchObject({ string: 1, fret: 0, note: 'E', pitch: 64 })
    })

    it('stops picking once destroyed, and takes its marks away', () => {
        const root = fretboard()
        const picks: Pick[] = []
        const layer = attachPick(root, { onPick: (p) => picks.push(p) })
        layer.mark({ string: 5, fret: 3 }, 'right')
        layer.destroy()
        at(root, 5, 3).dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(picks).toHaveLength(0)
        expect(root.querySelector('.mn-pick-marks')).toBeNull()
        expect(layer.mark({ string: 5, fret: 3 }, 'right')).toBe(false)
    })

    it('gives a layer without targets for a diagram without one', () => {
        const root = mounted(renderFretboard(document, empty))
        const layer = attachPick(root)
        expect(layer.targets()).toEqual([])
        expect(root.getAttribute('role')).toBe('img')
        expect(layer.mark({ pitch: 40 }, 'right')).toBe(false)
    })

    it('a pick handler that throws leaves the layer working', () => {
        const root = fretboard()
        let calls = 0
        attachPick(root, {
            onPick: () => {
                calls++
                throw new Error('app bug')
            }
        })
        at(root, 5, 3).dispatchEvent(new MouseEvent('click', { bubbles: true }))
        at(root, 5, 2).dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(calls).toBe(2)
    })
})

describe('pick layer: renderBlock', () => {
    const block = (language: NotationLanguage, source: string, options: RenderOptions = {}) => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        return renderBlock(language, source, host, options)
    }

    it('draws and attaches the layer on fretboard and keyboard blocks', () => {
        const picks: Pick[] = []
        const fb = block('fretboard', 'A minor pentatonic\nfrets: 0-5', {
            pick: { onPick: (p: Pick) => picks.push(p) }
        })
        expect(fb.ok).toBe(true)
        const svg = fb.el.querySelector('svg.mn-fretboard')!
        expect(svg.getAttribute('role')).toBe('group')
        at(svg, 6, 5).dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(picks[0]).toMatchObject({ string: 6, fret: 5, note: 'A', pitch: 45 })
        const kb = block('keyboard', 'C major', { pick: {} })
        expect(kb.el.querySelectorAll('svg.mn-keyboard .mn-pick').length).toBeGreaterThan(0)
    })

    it('leaves other blocks and the default alone', () => {
        expect(block('fretboard', 'C major').el.querySelector('.mn-picks')).toBeNull()
        expect(block('chord', 'C x32010', { pick: {} }).el.querySelector('.mn-picks')).toBeNull()
    })

    it('makes a diagram with a layer not playable: the layer owns clicks and keys', () => {
        const result = block('fretboard', 'C major\nfrets: 0-5', { pick: {}, play: true })
        expect(result.el.querySelector('.mn-playable')).toBeNull()
        expect(result.el.querySelector('.mn-block-bar')).toBeNull()
        const plain = block('fretboard', 'C major\nfrets: 0-5', { play: true })
        expect(plain.el.querySelector('.mn-playable')).not.toBeNull()
    })

    it('frees the layer with the block', () => {
        const picks: Pick[] = []
        const result = block('fretboard', 'C major\nfrets: 0-5', {
            pick: { onPick: (p: Pick) => picks.push(p) }
        })
        const svg = result.el.querySelector('svg.mn-fretboard')!
        result.destroy()
        at(svg, 5, 3).dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(picks).toHaveLength(0)
    })
})

describe('pick layer: review findings', () => {
    const fretboard = (options = {}) =>
        mounted(renderFretboard(document, empty, { pick: true, frets: [0, 5], ...options }))
    const block = (language: NotationLanguage, source: string, options: RenderOptions = {}) => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        return renderBlock(language, source, host, options)
    }

    it('draws marks where their targets are, in a row whose titles moved the drawing down', () => {
        const result = block(
            'fretboard',
            'C major\ntitle: A\n---\nG major\ntitle: ' + 'A long title '.repeat(8),
            {
                pick: {}
            }
        )
        const svg = result.el.querySelector('svg.mn-fretboard')!
        expect(svg.querySelector('.mn-title-pad .mn-picks')).not.toBeNull()
        const layer = result.picks[0]!
        layer.mark({ string: 1, fret: 1 }, 'right')
        // The marks share the layer's parent, so they move with it.
        const marks = svg.querySelector('.mn-pick-marks')!
        expect(marks.parentElement).toBe(svg.querySelector('.mn-picks')!.parentElement)
        expect(marks.previousElementSibling?.classList.contains('mn-picks')).toBe(true)
    })

    it('works with targets from another window (a popout has its own Element)', () => {
        const root = fretboard()
        const picks: Pick[] = []
        attachPick(root, { onPick: (p) => picks.push(p) })
        const target = at(root, 5, 3)
        const event = new MouseEvent('click', { bubbles: true })
        // What a popout's node looks like here: not an instance of this window's Element.
        Object.defineProperty(event, 'target', {
            value: { closest: (selector: string) => target.closest(selector) }
        })
        root.dispatchEvent(event)
        expect(picks.map((p) => [p.string, p.fret])).toEqual([[5, 3]])
    })

    it('gives the app its layers from renderBlock, one per diagram', () => {
        const result = block('fretboard', 'C major\n---\nG major\n---\nD major', { pick: {} })
        expect(result.picks).toHaveLength(3)
        expect(result.picks.map((l) => l.element)).toEqual([
            ...result.el.querySelectorAll('svg.mn-fretboard')
        ])
        expect(block('fretboard', 'C major').picks).toEqual([])
    })

    it('returns the live layer when attached again, so nothing doubles', () => {
        const root = fretboard()
        const picks: string[] = []
        const first = attachPick(root, { onPick: () => picks.push('first') })
        const second = attachPick(root, { onPick: () => picks.push('second') })
        expect(second).toBe(first)
        expect(root.querySelectorAll('title.mn-pick-name')).toHaveLength(36)
        at(root, 5, 3).dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(picks).toEqual(['first'])
        first.destroy()
        expect(root.getAttribute('role')).toBe('img')
        // Once destroyed, a new layer can be attached.
        const third = attachPick(root)
        expect(third).not.toBe(first)
        expect(root.getAttribute('role')).toBe('group')
    })

    it("hides the drawing's texts from screen readers while the layer is live", () => {
        const root = mounted(
            renderFretboard(document, scaleNoteSet('C major')!, {
                pick: true,
                frets: [0, 3],
                title: 'Find C'
            })
        )
        const layer = attachPick(root)
        for (const child of root.children) {
            const kept =
                child.tagName.toLowerCase() === 'defs' ||
                child.classList.contains('mn-picks') ||
                child.classList.contains('mn-pick-marks')
            expect(child.getAttribute('aria-hidden')).toBe(kept ? null : 'true')
        }
        layer.destroy()
        expect(root.querySelector('[aria-hidden]')).toBeNull()
    })

    it('picks once per press: a held key repeats nothing', () => {
        const root = fretboard()
        const picks: Pick[] = []
        attachPick(root, { onPick: (p) => picks.push(p) })
        const target = at(root, 2, 2) as SVGElement
        target.focus()
        target.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'Enter',
                repeat: true,
                bubbles: true,
                cancelable: true
            })
        )
        expect(picks).toHaveLength(0)
    })

    it('leaves keys with Ctrl, Alt or Meta to the host', () => {
        const root = fretboard()
        const picks: Pick[] = []
        attachPick(root, { onPick: (p) => picks.push(p) })
        const target = at(root, 2, 2) as SVGElement
        target.focus()
        for (const modifier of ['ctrlKey', 'altKey', 'metaKey'])
            for (const k of ['Enter', 'ArrowRight', 'Home']) {
                const handled = !target.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: k,
                        [modifier]: true,
                        bubbles: true,
                        cancelable: true
                    })
                )
                expect(handled).toBe(false)
            }
        expect(picks).toHaveLength(0)
        expect(document.activeElement).toBe(target)
    })

    it('keeps every press on a live diagram from the host, not only those on targets', () => {
        const host = document.createElement('div')
        const root = renderFretboard(document, empty, { pick: true, frets: [0, 5], title: 'T' })
        host.appendChild(root)
        document.body.appendChild(host)
        const layer = attachPick(root)
        const reached: string[] = []
        for (const type of ['pointerdown', 'mousedown', 'click'])
            host.addEventListener(type, () => reached.push(type))
        const title = root.querySelector('.mn-title')!
        title.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        title.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        title.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(reached).toEqual([])
        layer.destroy()
        title.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        expect(reached).toEqual(['mousedown'])
    })

    it('moves with the arrows on a vertical left-handed fretboard', () => {
        // Vertical, left hand: the nut on top, the low string on the right.
        const moves = { ArrowDown: [3, 3], ArrowUp: [3, 1], ArrowLeft: [2, 2], ArrowRight: [4, 2] }
        for (const [arrow, [string, fret]] of Object.entries(moves)) {
            const root = fretboard({ orientation: 'vertical', hand: 'left' })
            attachPick(root)
            const from = at(root, 3, 2) as SVGElement
            from.focus()
            key(from, arrow)
            expect(document.activeElement).toBe(at(root, string!, fret!))
            root.remove()
        }
    })

    it('puts white-key targets under the black keys, so their look never covers a black key', () => {
        const root = renderKeyboard(document, empty, { pick: true, range: [60, 71] })
        const kids = [...root.children]
        const whiteLayer = kids.findIndex(
            (c) => c.classList.contains('mn-picks') && c.querySelector('[data-mn-pitch="60"]')
        )
        const firstBlackKey = kids.findIndex((c) => c.classList.contains('mn-key-black'))
        const blackLayer = kids.findIndex(
            (c) => c.classList.contains('mn-picks') && c.querySelector('[data-mn-pitch="61"]')
        )
        expect(whiteLayer).toBeGreaterThan(-1)
        expect(whiteLayer).toBeLessThan(firstBlackKey)
        expect(blackLayer).toBeGreaterThan(firstBlackKey)
        // Still every key, white keys first, in document order.
        expect(targetsOf(root).map((t) => num(t, 'data-mn-pitch'))).toEqual([
            60, 62, 64, 65, 67, 69, 71, 61, 63, 66, 68, 70
        ])
    })

    it('shows the hand and the hover look only on live targets', () => {
        const rules = STYLES.replace(/\/\*[\s\S]*?\*\//g, '')
        const selectors = [...rules.matchAll(/([^{}]+)\{[^{}]*\}/g)]
            .flatMap(([, selector]) => selector!.split(','))
            .map((s) => s.trim())
            .filter((s) => /\.mn-pick(?![-\w])/.test(s))
        expect(selectors.length).toBeGreaterThan(0)
        for (const selector of selectors) expect(selector).toContain(".mn-pick[role='button']")
    })
})
