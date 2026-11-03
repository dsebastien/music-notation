/**
 * The play bar of a progression or a ChordPro chart (#46): play / stop, loop, count-in, click
 * (the metronome), tempo, strum (on the beats, once a bar, arpeggio, or the block's pattern),
 * volume and sound. One chord a bar, read from the drawing (each `data-mn-bar` element's notes),
 * the chord playing lit while it sounds.
 */
import { html, svg } from '../render/dom.js'
import { isCompound, parseStrum, parseTime, type StrumPattern } from '../strum/pattern.js'
import { countedTempoOf, tempoOf } from '../strum/play.js'
import { clamp, icon, type PlayOptions } from './controls.js'
import { followNotes, START_WAIT } from './follow.js'
import type { PlayHandle } from './player.js'
import {
    runProgression,
    PROGRESSION_STRUMS,
    type ProgressionBar,
    type ProgressionSettings,
    type ProgressionStrum
} from './progression.js'
import { barPlayer } from './strum-bar.js'

/** A metronome, for the count-in. */
const COUNT_IN = 'M5.5 14h5L9 2.5H7zM8 11.5l4.5-7'
/** Beats, for the click. */
const CLICK = 'M3 5v6M8 5v6M13 5v6'

const pitchesOf = (text: string | null): number[] =>
    (text ?? '')
        .split(' ')
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n))

/** The bars of a drawn progression or chart, in order, each with the elements that show it. */
export function barsFromDrawing(drawing: Element): { bars: ProgressionBar[]; marks: Element[][] } {
    const byBar = new Map<number, Element[]>()
    for (const el of drawing.querySelectorAll('[data-mn-bar]')) {
        const index = Number(el.getAttribute('data-mn-bar'))
        if (!Number.isInteger(index) || index < 0) continue
        byBar.set(index, [...(byBar.get(index) ?? []), el])
    }
    const order = [...byBar.keys()].sort((a, b) => a - b)
    const bars: ProgressionBar[] = []
    const marks: Element[][] = []
    for (const index of order) {
        const els = byBar.get(index)!
        const pitches = pitchesOf(els[0]!.getAttribute('data-mn-voicing'))
        if (!pitches.length) continue
        bars.push({ chord: els[0]!.getAttribute('data-mn-chord'), pitches })
        marks.push(els)
    }
    return { bars, marks }
}

/** The strum written on the drawing: a plain one, or a pattern (null when it doesn't read). */
function strumOf(
    drawing: Element,
    time: string | null
): { strum: ProgressionStrum; pattern: StrumPattern | null } {
    const written = drawing.getAttribute('data-mn-strum')?.trim() ?? ''
    if (!written) return { strum: 'beats', pattern: null }
    if ((PROGRESSION_STRUMS as readonly string[]).includes(written))
        return { strum: written as ProgressionStrum, pattern: null }
    try {
        return {
            strum: 'beats',
            pattern: parseStrum(`${time ? `time: ${time}\n` : ''}${written}`)
        }
    } catch {
        return { strum: 'beats', pattern: null }
    }
}

const STRUM_LABELS: Record<ProgressionStrum | 'pattern', string> = {
    beats: 'On the beats',
    bar: 'Once a bar',
    arpeggio: 'Arpeggio',
    pattern: 'Pattern'
}

export function progressionBarFor(
    doc: Document,
    win: Window,
    drawing: Element,
    options: PlayOptions
): () => void {
    const { bars, marks } = barsFromDrawing(drawing)
    if (!bars.length) return () => {}
    const time = drawing.getAttribute('data-mn-time')
    let beatsPerBar = 4
    let beatUnit = 4
    if (time) {
        try {
            ;({ beatsPerBar, beatUnit } = parseTime(time))
        } catch {
            // 4/4.
        }
    }
    const written = strumOf(drawing, time)
    const pattern = written.pattern
    const compound = pattern ? pattern.compound : isCompound(beatsPerBar, beatUnit)
    const tempo = Number(drawing.getAttribute('data-mn-tempo'))
    const piano = drawing.getAttribute('data-mn-sound') === 'piano'
    const settings: ProgressionSettings = {
        // The app's bpm counts quarters: the same speed in the beat the progression counts.
        bpm: tempoOf(
            drawing.hasAttribute('data-mn-tempo') && Number.isFinite(tempo)
                ? tempo
                : countedTempoOf(options.bpm, compound, pattern ? pattern.beatUnit : beatUnit),
            compound
        ),
        countIn: false,
        loop: false,
        click: true,
        sound: options.sound ?? (piano ? 'piano' : 'guitar'),
        volume: clamp(options.volume, 0, 1, 0.8)
    }
    let strum: ProgressionStrum | 'pattern' = pattern ? 'pattern' : written.strum
    let playing: PlayHandle | null = null

    const bar = html(doc, 'div', 'mn-play mn-play-static mn-progression-play')
    // A press in the bar is the bar's: an editor (Obsidian's live preview) must not take it as a
    // click on the block, which opens its source.
    bar.addEventListener('mousedown', (event) => event.stopPropagation())
    bar.setAttribute('role', 'group')
    bar.setAttribute('aria-label', 'Play the chords in time')
    drawing.insertBefore(bar, drawing.firstChild)

    const toggle = html(doc, 'button', 'mn-play-toggle')
    toggle.type = 'button'
    const show = () => {
        toggle.replaceChildren(icon(doc, playing ? 'stop' : 'play'))
        toggle.setAttribute('aria-label', playing ? 'Stop' : 'Play in time')
        toggle.title = playing ? 'Stop' : 'Play in time'
    }
    const stop = () => {
        playing?.stop()
        playing = null
        show()
    }
    const start = () => {
        stop()
        if (!drawing.isConnected) return
        const here = drawing.ownerDocument.defaultView ?? win
        playing = runProgression(
            bars,
            {
                beatsPerBar,
                beatUnit,
                strum: strum === 'pattern' ? 'beats' : strum,
                pattern: strum === 'pattern' ? pattern : null
            },
            () => barPlayer(drawing, win, options),
            // A loop stops once the drawing leaves the page.
            () => ({ ...settings, loop: settings.loop && drawing.isConnected }),
            here,
            () => {
                playing = null
                show()
            },
            // The chord playing lights for its bar, from the moment the pass is heard (#41).
            (timings, current) =>
                followNotes(
                    here,
                    drawing,
                    timings.map((t) => marks[t.slot] ?? []),
                    timings.map((t) => ({ midi: 0, time: t.time, duration: t.duration })),
                    current.reportsStart === true ? Infinity : START_WAIT
                )
        )
        show()
    }
    toggle.addEventListener('click', () => (playing ? stop() : start()))
    show()
    bar.appendChild(toggle)

    const mark = (path: string) => {
        const el = svg(doc, 'svg', {
            'class': 'mn-play-icon mn-play-icon-loop',
            'viewBox': '0 0 16 16',
            'width': 12,
            'height': 12,
            'aria-hidden': 'true'
        })
        el.appendChild(svg(doc, 'path', { d: path }))
        return el
    }
    const pressed = (
        cls: string,
        label: string,
        glyph: SVGElement,
        on: boolean,
        set: (on: boolean) => void
    ) => {
        const button = html(doc, 'button', cls)
        button.type = 'button'
        button.appendChild(glyph)
        button.title = label
        button.setAttribute('aria-label', label)
        const show = () => {
            button.setAttribute('aria-pressed', String(on))
            button.classList.toggle('mn-on', on)
        }
        button.addEventListener('click', () => {
            on = !on
            set(on)
            show()
        })
        show()
        bar.appendChild(button)
    }
    // Changes apply from the next pass of a loop.
    pressed('mn-play-loop', 'Loop', icon(doc, 'loop'), false, (on) => (settings.loop = on))
    pressed('mn-play-count', 'Count-in', mark(COUNT_IN), false, (on) => (settings.countIn = on))
    pressed('mn-play-click', 'Click', mark(CLICK), true, (on) => (settings.click = on))

    const slider = (
        label: string,
        min: number,
        max: number,
        value: number,
        set: (n: number) => void,
        glyph: string | SVGElement
    ) => {
        const field = html(doc, 'label', 'mn-play-field')
        field.title = `${label}: ${value}`
        const tag = html(doc, 'span', 'mn-play-label')
        tag.setAttribute('aria-hidden', 'true')
        tag.append(glyph)
        const input = html(doc, 'input')
        input.type = 'range'
        input.min = String(min)
        input.max = String(max)
        input.value = String(value)
        input.setAttribute('aria-label', label)
        input.addEventListener('input', () => {
            set(Number(input.value))
            field.title = `${label}: ${input.value}`
        })
        field.append(tag, input)
        bar.appendChild(field)
    }
    slider(
        'Tempo (BPM)',
        20,
        240,
        settings.bpm,
        (n) => (settings.bpm = tempoOf(n)),
        compound ? '♩.' : '♩'
    )
    slider(
        'Volume',
        0,
        100,
        Math.round(settings.volume * 100),
        (n) => (settings.volume = n / 100),
        icon(doc, 'volume')
    )

    const select = <T extends string>(
        cls: string,
        label: string,
        values: readonly T[],
        chosen: T,
        names: Record<T, string>,
        set: (value: T) => void
    ) => {
        const el = html(doc, 'select', cls)
        el.setAttribute('aria-label', label)
        el.title = label
        for (const value of values) {
            const option = html(doc, 'option', undefined, names[value])
            option.value = value
            option.selected = value === chosen
            el.appendChild(option)
        }
        el.addEventListener('change', () => set(el.value as T))
        bar.appendChild(el)
    }
    const strums: (ProgressionStrum | 'pattern')[] = [
        ...(pattern ? (['pattern'] as const) : []),
        ...PROGRESSION_STRUMS
    ]
    // A new strum starts again from the first bar.
    select('mn-play-strum', 'Strum', strums, strum, STRUM_LABELS, (value) => {
        strum = value
        if (playing) start()
    })
    select(
        'mn-play-sound',
        'Sound',
        ['guitar', 'piano'] as const,
        settings.sound,
        { guitar: 'Guitar', piano: 'Piano' },
        (value) => (settings.sound = value === 'piano' ? 'piano' : 'guitar')
    )
    return stop
}
