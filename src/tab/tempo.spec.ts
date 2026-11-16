import { describe, expect, it } from 'bun:test'
import { speedFor, stepped, tempoAt, tempoControl, typed, written } from './tempo.js'

describe('the tempo where the music is (#114)', () => {
    const bars = [
        { start: 0, end: 3840, tempoChanges: [{ tick: 0, tempo: 85 }] },
        { start: 3840, end: 7680, tempoChanges: [] },
        { start: 7680, end: 11520, tempoChanges: [{ tick: 9600, tempo: 120 }] }
    ]

    it("is the last tempo change at or before the tick, else the score's", () => {
        expect(tempoAt(bars, 0, 90)).toBe(85)
        expect(tempoAt(bars, 5000, 90)).toBe(85)
        expect(tempoAt(bars, 9599, 90)).toBe(85)
        expect(tempoAt(bars, 9600, 90)).toBe(120)
        expect(tempoAt([], 100, 90)).toBe(90)
        expect(tempoAt([], 100, null)).toBeNull()
    })
})

describe('speed and tempo', () => {
    it("a BPM is a speed of the score's tempo, within 25 and 150 %", () => {
        expect(speedFor(60, 85)).toBeCloseTo(60 / 85)
        expect(speedFor(10, 85)).toBe(0.25)
        expect(speedFor(300, 85)).toBe(1.5)
    })

    it('steps by 1 BPM, or by 5 % on the 5 % grid', () => {
        expect(Math.round(stepped(60 / 85, 1, 'bpm', 85) * 85)).toBe(61)
        expect(Math.round(stepped(60 / 85, -1, 'bpm', 85) * 85)).toBe(59)
        expect(stepped(1, 1, 'percent', 85)).toBeCloseTo(1.05)
        expect(stepped(0.72, 1, 'percent', 85)).toBeCloseTo(0.75)
        expect(stepped(0.72, -1, 'percent', 85)).toBeCloseTo(0.7)
        // No tempo known: percent.
        expect(stepped(1, -1, 'bpm', null)).toBeCloseTo(0.95)
        expect(stepped(1.5, 1, 'percent', 85)).toBe(1.5)
    })

    it('writes the unit shown and the other one', () => {
        expect(written(60 / 85, 'bpm', 85)).toEqual({ value: '60', unit: 'BPM', other: '71 %' })
        expect(written(0.8, 'percent', 85)).toEqual({ value: '80', unit: '%', other: '68 BPM' })
        expect(written(0.7, 'bpm', null)).toEqual({ value: '70', unit: '%', other: '' })
    })

    it('reads what the reader types, in the unit shown', () => {
        expect(typed('60', 'bpm', 85)).toBeCloseTo(60 / 85)
        expect(typed('70', 'percent', 85)).toBeCloseTo(0.7)
        expect(typed('70 %', 'percent', 85)).toBeCloseTo(0.7)
        expect(typed('', 'bpm', 85)).toBeNull()
        expect(typed('abc', 'bpm', 85)).toBeNull()
        expect(typed('1000', 'bpm', 85)).toBe(1.5)
    })
})

describe('the tempo control', () => {
    const setup = (tempo: number | null = 85, unit?: 'bpm' | 'percent') => {
        const speeds: number[] = []
        const units: string[] = []
        let now = tempo
        const control = tempoControl(document, {
            ...(unit ? { unit } : {}),
            tempo: () => now,
            set: (s) => speeds.push(s),
            unitChanged: (u) => units.push(u)
        })
        document.body.appendChild(control.field)
        const q = <T extends Element>(cls: string) => control.field.querySelector<T>(cls)!
        return {
            control,
            speeds,
            units,
            input: q<HTMLInputElement>('.mn-tempo-value'),
            unitButton: q<HTMLButtonElement>('.mn-tempo-unit'),
            other: q<HTMLButtonElement>('.mn-tempo-other'),
            down: q<HTMLButtonElement>('.mn-tempo-down'),
            up: q<HTMLButtonElement>('.mn-tempo-up'),
            setTempo: (t: number | null) => {
                now = t
                control.refresh()
            }
        }
    }

    it('a reader sets 60 BPM on a tab written at 85, and sees both values', () => {
        const t = setup()
        expect(t.input.value).toBe('85')
        expect(t.unitButton.textContent).toBe('BPM')
        expect(t.other.textContent).toBe('· 100 %')
        t.input.value = '60'
        t.input.dispatchEvent(new Event('change'))
        expect(t.speeds.at(-1)).toBeCloseTo(60 / 85)
        expect(t.input.value).toBe('60')
        expect(t.other.textContent).toBe('· 71 %')
        expect(t.control.speed()).toBeCloseTo(60 / 85)
    })

    it('− and + step by 1 BPM; the other unit goes back to 100 %', () => {
        const t = setup()
        t.down.click()
        expect(t.input.value).toBe('84')
        t.up.click()
        t.up.click()
        expect(t.input.value).toBe('86')
        t.other.click()
        expect(t.control.speed()).toBe(1)
        expect(t.other.disabled).toBe(true)
    })

    it('switches to percent, says so, and steps by 5 %', () => {
        const t = setup()
        t.unitButton.click()
        expect(t.units).toEqual(['percent'])
        expect(t.input.value).toBe('100')
        expect(t.unitButton.textContent).toBe('%')
        expect(t.other.textContent).toBe('· 85 BPM')
        t.down.click()
        expect(t.input.value).toBe('95')
        expect(t.input.getAttribute('aria-label')).toBe('Speed in percent')
    })

    it('starts in the unit the app gives', () => {
        expect(setup(85, 'percent').input.value).toBe('100')
    })

    it('a tempo change in the score writes the new tempo', () => {
        const t = setup()
        t.setTempo(120)
        expect(t.input.value).toBe('120')
    })

    it('without a tempo: percent only', () => {
        const t = setup(null)
        expect(t.input.value).toBe('100')
        expect(t.unitButton.hidden).toBe(true)
        expect(t.other.hidden).toBe(true)
    })

    it('stops at 25 and 150 %', () => {
        const t = setup()
        t.input.value = '500'
        t.input.dispatchEvent(new Event('change'))
        expect(t.control.speed()).toBe(1.5)
        expect(t.up.disabled).toBe(true)
    })

    it('a value that is not a number is ignored, and the field shows the speed again', () => {
        const t = setup()
        t.input.value = 'fast'
        t.input.dispatchEvent(new Event('change'))
        expect(t.speeds).toEqual([])
        expect(t.input.value).toBe('85')
    })
})

describe('the tempo control while its field has the focus', () => {
    it('− + and the unit switch write the new value; a value being typed is kept', () => {
        let now = 85
        const control = tempoControl(document, { tempo: () => now, set: () => {} })
        document.body.appendChild(control.field)
        const input = control.field.querySelector<HTMLInputElement>('.mn-tempo-value')!
        input.focus()
        control.field.querySelector<HTMLButtonElement>('.mn-tempo-up')!.click()
        expect(input.value).toBe('86')
        control.field.querySelector<HTMLButtonElement>('.mn-tempo-unit')!.click()
        expect(input.value).toBe('101')
        // Typing: a tempo change doesn't overwrite it.
        input.value = '9'
        input.dispatchEvent(new Event('input'))
        now = 120
        control.refresh()
        expect(input.value).toBe('9')
    })
})
