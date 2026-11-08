import { describe, expect, it } from 'bun:test'
import { renderBlock } from './render-block.js'
import { accessibleName } from './dom.js'
import type { NotationLanguage, RenderOptions } from '../blocks/renderers.js'

/** #12: blocks drawn with their names in solfège or German. */
const block = (language: NotationLanguage, source: string, options: RenderOptions = {}) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    return renderBlock(language, source, host, options)
}
const texts = (el: Element, selector: string) =>
    [...el.querySelectorAll(selector)].map((e) => e.textContent ?? '')

describe('naming in blocks', () => {
    it('changes nothing without it', () => {
        const r = block('fretboard', 'A minor pentatonic\nfrets: 5-8')
        expect(r.ok).toBe(true)
        expect(texts(r.el, '.mn-string-name')).toEqual(['E', 'B', 'G', 'D', 'A', 'E'])
        expect(texts(r.el, '.mn-dot-text')).toContain('A')
    })

    it('shows a fretboard in solfège: labels, string names, the name', () => {
        const r = block('fretboard', 'La mineur pentatonic\nfrets: 5-8\nnaming: solfege')
        expect(r.ok).toBe(true)
        const svg = r.el.querySelector('svg.mn-fretboard')!
        expect(texts(svg, '.mn-string-name')).toEqual(['Mi', 'Si', 'Sol', 'Ré', 'La', 'Mi'])
        const labels = texts(svg, '.mn-dot-text')
        expect(labels).toContain('La')
        expect(labels).toContain('Do')
        expect(labels).not.toContain('A')
        expect(accessibleName(svg)).toBe('Fretboard: La minor pentatonic')
        // What apps and playback read stays in letters.
        expect(svg.getAttribute('data-mn-set')).toBe('A minor pentatonic')
        expect(svg.querySelector('.mn-dot[data-mn-note="A"]')).not.toBeNull()
    })

    it('takes the naming from the app, and the block key wins', () => {
        const app = block('keyboard', 'C major', { naming: 'solfege' })
        expect(texts(app.el, '.mn-key-label')).toContain('Do')
        const own = block('keyboard', 'C major\nnaming: letters', { naming: 'solfege' })
        expect(texts(own.el, '.mn-key-label')).toContain('C')
        const bad = block('keyboard', 'C major', { naming: 'klingon' as never })
        expect(bad.ok).toBe(true)
        expect(texts(bad.el, '.mn-key-label')).toContain('C')
    })

    it('shows German H and B, and reads a bare B as B flat in a german block', () => {
        const r = block('keyboard', 'chord: B7\nnaming: german')
        const svg = r.el.querySelector('svg')!
        // B7 in German is B flat 7: drawn as Bb7, shown as B7.
        expect(svg.getAttribute('data-mn-set')).toBe('Bb7')
        expect(accessibleName(svg)).toBe('Keyboard: B7')
        const h = block('keyboard', 'H major\nnaming: german')
        expect(h.ok).toBe(true)
        expect(texts(h.el, '.mn-key-label')).toContain('H')
        expect(h.el.querySelector('svg')!.getAttribute('data-mn-set')).toBe('B major')
    })

    it('shows a chord diagram title in solfège, and reads solfège input', () => {
        const r = block('chord', 'Rém x00231\nnaming: solfege')
        expect(r.ok).toBe(true)
        expect(texts(r.el, '.mn-title')).toEqual(['Ré m'])
        const letters = block('chord', 'Rém x00231')
        expect(letters.ok).toBe(true)
        expect(texts(letters.el, '.mn-title')).toEqual(['Dm'])
    })

    it('shows chart chords and progression names, and the play bar names follow', () => {
        const chart = block('chords', '{naming: solfege}\n[Sol]Hello [Rém]world [Solo]', {
            play: true
        })
        expect(chart.ok).toBe(true)
        expect(texts(chart.el, '.mn-chord')).toEqual(['Sol', 'Ré m', 'Solo'])
        const progression = block('progression', 'key: Do\nI vi IV V\nnaming: solfege')
        expect(progression.ok).toBe(true)
        expect(texts(progression.el, '.mn-title')).toEqual(['Do', 'La m', 'Fa', 'Sol'])
        expect(texts(progression.el, '.mn-progression-key')).toEqual(['Key: Do major'])
        const german = block('progression', 'key: F\nI IV V\nnaming: german')
        expect(texts(german.el, '.mn-title')).toEqual(['F', 'B', 'C'])
    })

    it('shows the circle of fifths in solfège', () => {
        const r = block('circle', 'key: Sol\nnaming: solfege')
        expect(r.ok).toBe(true)
        expect(r.el.textContent).toContain('Sol')
        expect(r.el.textContent).not.toMatch(/\bG major\b/)
    })

    it('keeps user titles with an English article', () => {
        const r = block('fretboard', 'C major\ntitle: A long way\nnaming: solfege')
        expect(texts(r.el, '.mn-title').join('')).toBe('A long way')
    })

    it("keeps a German title's B as B flat and its H as B natural", () => {
        const r = block('fretboard', 'Bb major\ntitle: B major, H major\nnaming: german')
        expect(texts(r.el, '.mn-title').join('')).toBe('B major, H major')
    })

    it('says what to write for a wrong naming', () => {
        const r = block('chord', 'C\nnaming: french')
        expect(r.ok).toBe(false)
        expect(r.error).toContain('naming: write letters, solfege or german')
    })

    it('never rewrites a hand-written title, in solfège or German', () => {
        const fr = block('fretboard', 'C major\ntitle: Gamme de Do majeur\nnaming: solfege')
        expect(texts(fr.el, '.mn-title').join('')).toBe('Gamme de Do majeur')
        expect(accessibleName(fr.el.querySelector('svg')!)).toBe('Gamme de Do majeur')
        const de = block('keyboard', 'Bb major\ntitle: Blues in B\nnaming: german')
        expect(texts(de.el, '.mn-title')).toEqual(['Blues in B'])
    })

    it('reads B as B flat only with the block line, never from the app default', () => {
        const app = block('keyboard', 'B major', { naming: 'german' })
        expect(app.el.querySelector('svg')!.getAttribute('data-mn-set')).toBe('B major')
        // Shown in German: B natural is H.
        expect(accessibleName(app.el.querySelector('svg')!)).toBe('Keyboard: H major')
    })

    it('quotes what the user wrote in its messages', () => {
        const r = block('keyboard', 'scale: H xyz\nnaming: german')
        expect(r.error).toContain('"H xyz"')
    })

    it('keeps pattern strokes in names, and shows strum chords in the naming', () => {
        const r = block('strum', 'chord: Rém\nD DU UDU\nnaming: solfege')
        const svg = r.el.querySelector('svg')!
        expect(accessibleName(svg)).toContain('D - D U')
        expect(texts(svg, '.mn-strum-chord')).toEqual(['Ré m'])
    })

    it('shows the capo caption, the chart key and the progression note in the naming', () => {
        const capo = block('chord', 'C x32010\ncapo: 2\nsounds: D\nnaming: solfege')
        expect(texts(capo.el, '.mn-caption')).toEqual(['Capo 2, sounds Ré'])
        const chart = block('chords', '{naming: solfege}\n{key: Sol}\n[Sol]x')
        expect(texts(chart.el, '.mn-chart-meta').join('')).toContain('Key Sol')
        const note = block('progression', 'key: D dorian\nharmonize: sus\nnaming: solfege')
        expect(texts(note.el, '.mn-progression-note').join('')).toContain('(Si)')
    })

    it('redraws for the other instrument in the naming, never showing a title twice', () => {
        const r = block('chord', 'B x13331\nnaming: german', { play: { sound: 'piano' } })
        // B flat in German is B: the keyboard drawn for it keeps "B", not "H".
        expect(texts(r.el, '.mn-title')).toEqual(['B'])
    })

    it('draws a chart around a wrong naming directive, and says what to write', () => {
        const r = block('chords', '{naming: french}\n[G]Hello')
        expect(r.ok).toBe(false)
        expect(r.error).toContain('{naming: solfege}')
        expect(texts(r.el, '.mn-chord')).toEqual(['G'])
    })

    it('changes nothing for letter content: Do is D diminished, [sim.] and [Six] stay text', () => {
        const chord = block('keyboard', 'chord: Do7')
        expect(chord.el.querySelector('svg')!.getAttribute('data-mn-set')).toBe('Do7')
        expect(chord.el.querySelector('svg')!.getAttribute('data-mn-pitches')).toBe('62 65 68 71')
        const chart = block('chords', '[sim.]a [Six]b [Do7]c [la]d')
        expect(texts(chart.el, '.mn-chord')).toEqual(['sim.', 'Six', 'Do7', 'la'])
    })

    it('names the play bar in the naming', () => {
        const r = block('chord', 'Rém x00231\n---\nSol7 320001\nnaming: solfege', { play: true })
        expect(r.el.querySelector('.mn-play-name')?.textContent).toContain('Ré m')
    })
})
