/**
 * Following the notes (#41): while a diagram plays, the element of each note that sounds (a dot,
 * a key, a string's mark) gets the `mn-playing` class for the length of its note, so a learner
 * sees which note sounds where.
 */
import type { NoteEvent, PlayKind } from './player.js'

/** The class a sounding note's element gets. */
export const PLAYING_CLASS = 'mn-playing'

/**
 * How long (ms) the bar waits for a player that doesn't say when its notes start (no
 * `reportsStart`) before it lights notes from the play call.
 */
export const START_WAIT = 300

/** A string number as guitarists count them (1 is the highest), or null. */
const stringOf = (el: Element): number | null => {
    const n = Number(el.getAttribute('data-mn-string') ?? NaN)
    return Number.isFinite(n) ? n : null
}

/**
 * The elements each note lights on a drawing: every element of its pitch (a fretboard may show
 * one pitch on two strings). On a strummed chord, strings that share a pitch light one each, low
 * to high, in the order they sound.
 */
export function noteTargets(
    drawing: Element,
    events: readonly NoteEvent[],
    kind: PlayKind
): Element[][] {
    const byPitch = new Map<number, Element[]>()
    for (const el of drawing.querySelectorAll('[data-midi]')) {
        const midi = Number(el.getAttribute('data-midi'))
        if (!Number.isFinite(midi)) continue
        const list = byPitch.get(midi)
        if (list) list.push(el)
        else byPitch.set(midi, [el])
    }
    // Lowest string first: its number is the highest.
    for (const list of byPitch.values())
        list.sort((a, b) => {
            const sa = stringOf(a)
            const sb = stringOf(b)
            return sa === null || sb === null ? 0 : sb - sa
        })
    if (kind !== 'chord') return events.map((e) => byPitch.get(e.midi) ?? [])
    const count = new Map<number, number>()
    for (const e of events) count.set(e.midi, (count.get(e.midi) ?? 0) + 1)
    const seen = new Map<number, number>()
    return events.map((e) => {
        const all = byPitch.get(e.midi) ?? []
        const n = seen.get(e.midi) ?? 0
        seen.set(e.midi, n + 1)
        // One string per note when the chord sounds each of them once.
        return all.length > 1 && count.get(e.midi) === all.length ? [all[n]!] : all
    })
}

export interface Follower {
    /** The notes started sounding now (a player's `onStart`); only the first call counts. */
    heard(): void
    /** Unlights every note and cancels the timers. */
    stop(): void
}

/**
 * Lights `targets[i]` while `events[i]` sounds, from the moment `heard()` is called, or `wait` ms
 * after this call when it isn't (Infinity waits for it). One timer at a time, set for the next
 * note's start or end and read against the clock, so it doesn't drift. Stops by itself after the
 * last note, or once `drawing` has left the page.
 */
export function followNotes(
    win: Window,
    drawing: Element,
    targets: readonly (readonly Element[])[],
    events: readonly NoteEvent[],
    wait: number = START_WAIT
): Follower {
    const now = () =>
        typeof win.performance?.now === 'function' ? win.performance.now() : Date.now()
    const created = now()
    const lit = new Set<Element>()
    let origin: number | null = null
    let heard = false
    let stopped = false
    let timer: ReturnType<typeof win.setTimeout> | undefined
    let fallback: ReturnType<typeof win.setTimeout> | undefined

    const clear = () => {
        for (const el of lit) el.classList.remove(PLAYING_CLASS)
        lit.clear()
    }
    const stop = () => {
        stopped = true
        win.clearTimeout(timer)
        win.clearTimeout(fallback)
        timer = fallback = undefined
        clear()
    }
    const tick = () => {
        timer = undefined
        if (stopped || origin === null) return
        if (!drawing.isConnected) return stop()
        const t = (now() - origin) / 1000
        const on = new Set<Element>()
        let next = Infinity
        events.forEach((e, i) => {
            const end = e.time + e.duration
            if (t >= e.time && t < end) for (const el of targets[i] ?? []) on.add(el)
            if (e.time > t) next = Math.min(next, e.time)
            if (end > t) next = Math.min(next, end)
        })
        for (const el of lit)
            if (!on.has(el)) {
                el.classList.remove(PLAYING_CLASS)
                lit.delete(el)
            }
        for (const el of on)
            if (!lit.has(el)) {
                el.classList.add(PLAYING_CLASS)
                lit.add(el)
            }
        if (next === Infinity) return stop()
        // A millisecond past the boundary, so the next tick lands on the far side of it.
        timer = win.setTimeout(tick, (next - t) * 1000 + 1)
    }
    const begin = (at: number) => {
        origin = at
        win.clearTimeout(timer)
        tick()
    }
    if (Number.isFinite(wait))
        fallback = win.setTimeout(
            () => {
                fallback = undefined
                if (origin === null && !stopped) begin(created)
            },
            Math.max(0, wait)
        )
    return {
        heard() {
            if (heard || stopped) return
            heard = true
            win.clearTimeout(fallback)
            fallback = undefined
            begin(now())
        },
        stop
    }
}
