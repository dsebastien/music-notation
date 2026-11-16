/**
 * The tempo control of the tab and score bar (#114): musicians think in BPM ("play it at 70"), so
 * the bar shows the speed as a tempo, with the other unit next to it: "60 BPM · 70 %". − and +
 * step by 1 BPM (or 5 %), the value can be typed, a button switches the unit, and a click on the
 * other unit goes back to 100 %. The speed stays a factor of the score's own tempo (0.25 to 1.5),
 * as alphaTab's `playbackSpeed` takes it. Nothing here knows alphaTab: `tempo()` gives the tempo
 * where the music is (it changes with the score's tempo changes), or null when it isn't known.
 */
import { html } from '../render/dom.js'
import { translator } from '../i18n/translate.js'

export type TempoUnit = 'bpm' | 'percent'

/** The speeds the bar allows, as before (25 to 150 %). */
export const SPEED_MIN = 0.25
export const SPEED_MAX = 1.5
/** One step of − and + in percent. */
export const PERCENT_STEP = 5

const clamp = (speed: number) => Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed))

/** A tempo change: from `tick` on, `tempo` BPM. */
export interface TempoChange {
    tick: number
    tempo: number
}

/**
 * The tempo at `tick`: the last change at or before it, in the bars of alphaTab's tick lookup
 * (each with its start, end and tempo changes); `fallback` (the score's tempo) before the first.
 */
export function tempoAt(
    bars: readonly { start: number; end: number; tempoChanges: readonly TempoChange[] }[],
    tick: number,
    fallback: number | null
): number | null {
    let tempo = fallback
    for (const bar of bars) {
        if (bar.start > tick) break
        for (const change of bar.tempoChanges) if (change.tick <= tick) tempo = change.tempo
    }
    return tempo !== null && Number.isFinite(tempo) && tempo > 0 ? tempo : fallback
}

/** The speed that plays `bpm` when the score is at `tempo`, within the bar's limits. */
export function speedFor(bpm: number, tempo: number): number {
    return clamp(bpm / tempo)
}

/** The tempo `speed` plays at, rounded as the bar shows it. */
export const bpmOf = (speed: number, tempo: number) => Math.round(speed * tempo)

/** The speed one step slower (-1) or faster (+1): 1 BPM, or 5 % on the 5 % grid. */
export function stepped(
    speed: number,
    direction: 1 | -1,
    unit: TempoUnit,
    tempo: number | null
): number {
    if (unit === 'bpm' && tempo) return speedFor(bpmOf(speed, tempo) + direction, tempo)
    const percent = Math.round(speed * 100)
    const onGrid =
        direction > 0
            ? Math.floor(percent / PERCENT_STEP) * PERCENT_STEP + PERCENT_STEP
            : Math.ceil(percent / PERCENT_STEP) * PERCENT_STEP - PERCENT_STEP
    return clamp(onGrid / 100)
}

/** What the bar writes: the value in the unit shown, and the other one. */
export function written(
    speed: number,
    unit: TempoUnit,
    tempo: number | null
): { value: string; unit: string; other: string } {
    const percent = `${Math.round(speed * 100)} %`
    if (!tempo) return { value: String(Math.round(speed * 100)), unit: '%', other: '' }
    const bpm = `${bpmOf(speed, tempo)} BPM`
    return unit === 'bpm'
        ? { value: String(bpmOf(speed, tempo)), unit: 'BPM', other: percent }
        : { value: String(Math.round(speed * 100)), unit: '%', other: bpm }
}

/** A typed value as a speed, in the unit shown; null when it isn't a number. */
export function typed(text: string, unit: TempoUnit, tempo: number | null): number | null {
    const n = Number(text.replace(',', '.').replace(/[^\d.]/g, ''))
    if (!text.trim() || !Number.isFinite(n) || n <= 0) return null
    return unit === 'bpm' && tempo ? speedFor(n, tempo) : clamp(n / 100)
}

export interface TempoControl {
    /** What goes on the bar. */
    field: HTMLElement
    /** The speed set (0.25 to 1.5). */
    speed(): number
    /** The tempo where the music is changed (a tempo change in the score): written again. */
    refresh(): void
}

export interface TempoOptions {
    /** The unit shown first; BPM by default, percent when the tempo isn't known. */
    unit?: TempoUnit
    /** The tempo where the music is, or null. */
    tempo: () => number | null
    /** A new speed was set. */
    set: (speed: number) => void
    /** The reader switched the unit (an app may remember it). */
    unitChanged?: (unit: TempoUnit) => void
}

export function tempoControl(doc: Document, options: TempoOptions): TempoControl {
    // Kept: the labels are written again at each change, long after the draw.
    const tr = translator()
    let speed = 1
    let unit: TempoUnit = options.unit ?? 'bpm'
    const field = html(doc, 'span', 'mn-tempo')
    field.setAttribute('role', 'group')
    field.setAttribute('aria-label', tr('tab.tempo.group'))
    const button = (cls: string, text: string, label: string) => {
        const b = html(doc, 'button', cls, text)
        b.type = 'button'
        b.setAttribute('aria-label', label)
        b.title = label
        return b
    }
    const down = button('mn-tempo-down', '−', tr('tab.tempo.slower'))
    const up = button('mn-tempo-up', '+', tr('tab.tempo.faster'))
    const input = html(doc, 'input', 'mn-tempo-value')
    input.type = 'text'
    input.inputMode = 'numeric'
    input.size = 3
    input.autocomplete = 'off'
    const unitButton = button('mn-tempo-unit', 'BPM', tr('tab.tempo.toPercent'))
    const other = button('mn-tempo-other', '', tr('tab.tempo.reset'))
    /** Whether the reader is typing a value not committed yet. */
    let editing = false
    input.addEventListener('input', () => (editing = true))
    const shownUnit = (): TempoUnit => (options.tempo() ? unit : 'percent')
    const show = () => {
        const tempo = options.tempo()
        const w = written(speed, shownUnit(), tempo)
        // A value being typed stays until it's committed (a tempo change mustn't overwrite it).
        if (!editing) input.value = w.value
        input.setAttribute(
            'aria-label',
            w.unit === 'BPM' ? tr('tab.tempo.inBpm') : tr('tab.tempo.inPercent')
        )
        unitButton.textContent = w.unit
        unitButton.hidden = !tempo
        const toOther = tr(shownUnit() === 'bpm' ? 'tab.tempo.toPercent' : 'tab.tempo.toBpm')
        unitButton.setAttribute('aria-label', toOther)
        unitButton.title = toOther
        other.textContent = w.other ? `· ${w.other}` : ''
        other.hidden = !w.other
        other.disabled = speed === 1
        field.title = tempo
            ? tr('tab.tempo.title', {
                  bpm: bpmOf(speed, tempo),
                  percent: Math.round(speed * 100),
                  tempo: Math.round(tempo)
              })
            : tr('tab.tempo.speedTitle', { percent: Math.round(speed * 100) })
        down.disabled = speed <= SPEED_MIN
        up.disabled = speed >= SPEED_MAX
    }
    const set = (next: number) => {
        editing = false
        speed = clamp(next)
        options.set(speed)
        show()
    }
    down.addEventListener('click', () => set(stepped(speed, -1, shownUnit(), options.tempo())))
    up.addEventListener('click', () => set(stepped(speed, 1, shownUnit(), options.tempo())))
    other.addEventListener('click', () => set(1))
    unitButton.addEventListener('click', () => {
        unit = shownUnit() === 'bpm' ? 'percent' : 'bpm'
        options.unitChanged?.(unit)
        show()
    })
    const commit = () => {
        const next = typed(input.value, shownUnit(), options.tempo())
        editing = false
        if (next === null) show()
        else set(next)
    }
    input.addEventListener('change', commit)
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault()
            commit()
            input.select()
        } else if (event.key === 'Escape') {
            event.stopPropagation()
            editing = false
            input.blur()
            show()
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            set(stepped(speed, event.key === 'ArrowUp' ? 1 : -1, shownUnit(), options.tempo()))
            input.select()
        }
    })
    input.addEventListener('blur', () => {
        editing = false
        show()
    })
    field.append(down, input, unitButton, up, other)
    show()
    return { field, speed: () => speed, refresh: show }
}
