/**
 * The playback bar of a diagram: play / stop, loop, speed (when several notes play), volume and
 * sound, at the bottom of the diagram, shown on hover (on tap on touch screens). A click on a dot
 * or a key plays that note.
 */
import { accessibleName, html, setAccessibleName, svg } from '../render/dom.js'
import { keyRangeOf, renderKeyboard } from '../keyboard/keyboard.js'
import { renderFretboard } from '../fretboard/fretboard.js'
import {
    chordNoteSet,
    listNoteSet,
    scaleNoteSet,
    type NoteLabel,
    type NoteSet
} from '../theory/note-set.js'
import { midiOf, nameOf } from '../theory/pitch.js'
import {
    DEFAULT_SEQUENCE,
    DEFAULT_STRUM,
    lightPlayer,
    sequenceOf,
    type NoteEvent,
    type NotePlayer,
    type PlayHandle,
    type PlayKind,
    type Sound
} from './player.js'
import { strumBarFor } from './strum-bar.js'
import {
    followNotes,
    noteTargets,
    sawStart,
    startsReported,
    START_WAIT,
    type Follower
} from './follow.js'

export interface PlayOptions {
    /**
     * Plays the notes: a player, or a function returning one at each play (null for the default),
     * so a soundfont loaded later is used once it's there. The function gets the diagram's window
     * (popouts have their own). The light synthesizer by default.
     */
    player?: NotePlayer | ((win: Window) => NotePlayer | null | undefined)
    /** Guitar or piano; by default the diagram's (piano for keyboards and piano chords). */
    sound?: Sound
    /** 0 to 1, 0.8 by default. */
    volume?: number
    /** Scales: notes per minute, 90 by default; also strum patterns' tempo when they have none. */
    bpm?: number
    /**
     * Chords: milliseconds between strings; by default 12 on guitar, 0 (a block) on piano. A number
     * is the guitar's (piano chords stay a block); `{ guitar, piano }` sets each instrument's.
     */
    strum?: number | { guitar?: number; piano?: number }
}

/** A number within bounds; the fallback when it isn't a number at all. */
export const clamp = (n: number | undefined, lo: number, hi: number, fallback: number) =>
    n === undefined || !Number.isFinite(n) ? fallback : Math.min(hi, Math.max(lo, n))

/**
 * Each instrument's strum from the app's `strum` option, clamped: a plain number is the guitar's,
 * so piano chords stay a block unless `{ piano }` is given.
 */
export function strumsOf(strum: PlayOptions['strum']): Record<Sound, number> {
    const given = typeof strum === 'number' ? { guitar: strum } : (strum ?? {})
    return {
        guitar: clamp(given.guitar, 0, 200, DEFAULT_STRUM.guitar),
        piano: clamp(given.piano, 0, 200, DEFAULT_STRUM.piano)
    }
}

/** Small icons, drawn so they look the same in every font. */
const ICONS: Record<'play' | 'stop' | 'loop' | 'volume', string> = {
    play: 'M4 2.5v11l9-5.5z',
    stop: 'M4 4h8v8H4z',
    loop: 'M3 8a5 5 0 0 1 8.5-3.5L13 6V2.5M13 8a5 5 0 0 1-8.5 3.5L3 10v3.5',
    volume: 'M2 6h3l4-3v10l-4-3H2zM11 5.5a3.5 3.5 0 0 1 0 5'
}

export function icon(doc: Document, name: keyof typeof ICONS): SVGElement {
    const root = svg(doc, 'svg', {
        'class': `mn-play-icon mn-play-icon-${name}`,
        'viewBox': '0 0 16 16',
        'width': 12,
        'height': 12,
        'aria-hidden': 'true'
    })
    root.appendChild(svg(doc, 'path', { d: ICONS[name] }))
    return root
}

/** One light synthesizer per window. */
const players = new WeakMap<Window, NotePlayer>()
export function lightFor(win: Window): NotePlayer {
    let player = players.get(win)
    if (!player) {
        player = lightPlayer(win)
        players.set(win, player)
    }
    return player
}

/** The player apps passed (read at each play), else the light synthesizer. */
export function playerFor(win: Window, options: PlayOptions): NotePlayer {
    const given = typeof options.player === 'function' ? options.player(win) : options.player
    return given ?? lightFor(win)
}

/** The diagram's own playback data, set by its renderer. */
interface DiagramData {
    kind: PlayKind
    pitches: number[]
    sound: Sound
    /** The tonic's pitch class, from the root mark (scales start on it); null without one. */
    root: number | null
}

/** The pitch classes of a chord drawn over a scale (its tones), or undefined. */
function tonesOf(drawing: Element): number[] | undefined {
    const tones = [...drawing.querySelectorAll('.mn-tone[data-midi]')]
        .map((el) => Number(el.getAttribute('data-midi')))
        .filter((midi) => Number.isFinite(midi))
        .map((midi) => ((midi % 12) + 12) % 12)
    return tones.length ? [...new Set(tones)] : undefined
}

/** The pitch class of a drawing's root mark (a root dot or key), or null. */
function rootOf(drawing: Element): number | null {
    const mark = drawing.querySelector('.mn-root[data-midi]')
    const midi = Number(mark?.getAttribute('data-midi'))
    return mark && Number.isFinite(midi) ? ((midi % 12) + 12) % 12 : null
}

function dataOf(diagram: Element): DiagramData | null {
    const pitches = (diagram.getAttribute('data-mn-pitches') ?? '')
        .split(' ')
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isFinite(n))
    if (!pitches.length) return null
    return {
        kind: diagram.getAttribute('data-mn-play') === 'chord' ? 'chord' : 'scale',
        pitches,
        sound: diagram.getAttribute('data-mn-sound') === 'piano' ? 'piano' : 'guitar',
        root: rootOf(diagram)
    }
}

const LABELS = new Set<NoteLabel>(['notes', 'degrees', 'intervals', 'none'])

/** A note name with the octave that gives this pitch ("B#3" is MIDI 60, "Cb5" is 71). */
function spelledNote(name: string, midi: number): string {
    const octave = Math.floor(midi / 12) - 1
    for (const o of [octave, octave + 1, octave - 1])
        if (midiOf(`${name}${o}`) === midi) return `${name}${o}`
    return `${nameOf(midi)}${octave}`
}

/**
 * The same notes drawn for the other instrument: a keyboard for a guitar diagram or a fretboard,
 * a fretboard for a keyboard. The diagram's own chord or scale with its exact pitches, so notes
 * keep their spelling (Gm's Bb) and labels their meaning (C9's 9); a list rebuilt from its notes
 * and root otherwise. With the title, the labels and the orientation (between fretboards and
 * keyboards); null when nothing can be drawn (no note within a guitar's range).
 */
function redrawFor(doc: Document, diagram: Element, data: DiagramData): Element | null {
    // A guitar can't play below its low E (MIDI 40) or past fret 24 of the high E (88).
    const toGuitar = data.sound === 'piano'
    const pitches = [...new Set(data.pitches)]
        .sort((a, b) => a - b)
        .filter((midi) => !toGuitar || (midi >= 40 && midi <= 88))
    if (!pitches.length) return null
    // A shape played with a capo: the chord it sounds (an A shape with a capo on 2 is B).
    const sounds = diagram.getAttribute('data-mn-sounds')
    const chord = sounds ?? diagram.getAttribute('data-mn-chord')
    const named = diagram.getAttribute('data-mn-set')
    let set: NoteSet | null =
        (chord && chordNoteSet(chord)) ||
        (named && (scaleNoteSet(named) ?? (named.includes(' ') ? null : chordNoteSet(named)))) ||
        null
    if (set && !pitches.every((midi) => set!.members.some((m) => m.chroma === midi % 12)))
        set = null
    if (set) set.pitches = pitches
    else {
        // A list: its notes as drawn, its root from the root mark.
        const flats = [...diagram.querySelectorAll('[data-mn-note]')].some((el) =>
            /^[A-G]b/.test(el.getAttribute('data-mn-note') ?? '')
        )
        const nameAt = (midi: number) =>
            diagram
                .querySelector(`[data-midi="${midi}"][data-mn-note]`)
                ?.getAttribute('data-mn-note') ?? nameOf(midi, flats)
        const rootEl = diagram.querySelector('.mn-root[data-midi]')
        const rootMidi = rootEl ? Number(rootEl.getAttribute('data-midi')) : null
        set = listNoteSet(
            pitches.map((midi) => spelledNote(nameAt(midi), midi)).join(' '),
            rootMidi === null ? undefined : nameAt(rootMidi)
        )
        if (!set) return null
    }
    const written = diagram.getAttribute('data-mn-labels') as NoteLabel | null
    const label: NoteLabel =
        written &&
        LABELS.has(written) &&
        (set.root !== null || written === 'notes' || written === 'none')
            ? written
            : 'notes'
    const heading = diagram.querySelector('.mn-title')?.textContent ?? undefined
    // A piano plays what the guitar sounds: the title says which chord that is.
    const title =
        sounds && heading ? `${heading} (sounds ${sounds})` : (heading ?? sounds ?? undefined)
    // A fretboard and a keyboard share their orientation; a chord diagram's is its own.
    const orientation =
        diagram.getAttribute('data-mn-orientation') === 'vertical' ? 'vertical' : undefined
    const drawn = toGuitar
        ? renderFretboard(doc, set, {
              label,
              ...(title ? { title } : {}),
              ...(orientation ? { orientation } : {}),
              frets: [0, Math.max(12, Math.min(24, pitches[pitches.length - 1]! - 64))]
          })
        : renderKeyboard(doc, set, {
              label,
              ...(title ? { title } : {}),
              ...(orientation ? { orientation } : {}),
              range: keyRangeOf(set),
              playAs: data.kind
          })
    // Its name stays the diagram's, for screen readers.
    const name = accessibleName(diagram)
    if (name) setAccessibleName(drawn, `${name}, drawn for ${toGuitar ? 'guitar' : 'piano'}`)
    drawn.classList.add('mn-redrawn')
    return drawn
}

/**
 * Wraps each playable diagram in `el` (an SVG with notes to play) with its playback bar. Returns
 * a function that stops whatever plays.
 */
export function attachPlayback(el: HTMLElement, options: PlayOptions = {}): () => void {
    const doc = el.ownerDocument
    const win = doc.defaultView
    if (!win) return () => {}
    const stops: (() => void)[] = []
    for (const diagram of [...el.querySelectorAll('svg[data-mn-pitches]')]) {
        const data = dataOf(diagram)
        if (!data) continue
        stops.push(barFor(doc, win, diagram, data, options))
    }
    // Strumming patterns (#22): their own bar, with tempo and count-in.
    for (const pattern of [...el.querySelectorAll('svg[data-mn-strum]')])
        stops.push(strumBarFor(doc, win, pattern, options))
    return () => stops.forEach((stop) => stop())
}

function barFor(
    doc: Document,
    win: Window,
    diagram: Element,
    data: DiagramData,
    options: PlayOptions
): () => void {
    const wrap = html(doc, 'div', 'mn-playable')
    diagram.parentNode?.insertBefore(wrap, diagram)
    wrap.appendChild(diagram)
    const bar = html(doc, 'div', 'mn-play')
    bar.setAttribute('role', 'group')
    // Named after the diagram, so a page with many bars reads clearly.
    const name = accessibleName(diagram)
    bar.setAttribute('aria-label', name ? `Play ${name}` : 'Playback')
    wrap.appendChild(bar)

    const firstSound = options.sound ?? data.sound
    // Each instrument keeps its own strum (a guitar strum, a piano block chord by default); the
    // slider sets the one of the sound chosen.
    const strums = strumsOf(options.strum)
    const settings = {
        sound: firstSound,
        volume: clamp(options.volume, 0, 1, 0.8),
        bpm: clamp(options.bpm, 20, 240, DEFAULT_SEQUENCE.bpm),
        strum: strums[firstSound],
        loop: false
    }
    let playing: PlayHandle | null = null
    // The notes lit on the drawing as they sound.
    let lights: Follower | null = null
    // The drawing on the page: the diagram, or its redrawing for the other instrument.
    let shown: Element = diagram
    // What the drawing on the page shows: a redrawn fretboard leaves out notes a guitar can't play.
    const pitchesShown = () =>
        shown === diagram ? data.pitches : (dataOf(shown)?.pitches ?? data.pitches)
    // Its tonic: a scale's run starts on it.
    const rootShown = () => (shown === diagram ? data.root : rootOf(shown))

    const toggle = html(doc, 'button', 'mn-play-toggle')
    toggle.type = 'button'
    const show = () => {
        toggle.replaceChildren(icon(doc, playing ? 'stop' : 'play'))
        toggle.setAttribute('aria-label', playing ? 'Stop' : 'Play')
        toggle.title = playing ? 'Stop' : 'Play'
    }
    const stop = () => {
        playing?.stop()
        playing = null
        lights?.stop()
        lights = null
        show()
    }
    /**
     * Plays notes with the app's player, or the light synthesizer when that one fails, in the
     * window the diagram is in now: a host may move a drawn diagram to another window (Obsidian
     * popouts), and its sound then belongs to that window.
     */
    const play = (
        events: NoteEvent[],
        onEnd: () => void,
        targets: readonly (readonly Element[])[]
    ): PlayHandle => {
        const here = wrap.ownerDocument.defaultView ?? win
        // Each note lights when it really sounds: a soundfont may take seconds on the first play.
        const run = (player: NotePlayer) => {
            lights?.stop()
            const follower = followNotes(
                here,
                shown,
                targets,
                events,
                startsReported(player) ? Infinity : START_WAIT
            )
            lights = follower
            const onStart = () => {
                sawStart(player)
                follower.heard()
            }
            try {
                return player.play(events, {
                    sound: settings.sound,
                    volume: settings.volume,
                    onEnd,
                    onStart
                })
            } catch (error) {
                follower.stop()
                throw error
            }
        }
        try {
            return run(playerFor(here, options))
        } catch {
            return run(lightFor(here))
        }
    }
    const start = () => {
        stop()
        // A diagram no longer on the page (the block was redrawn or left) stops looping.
        if (!wrap.isConnected) return
        const tones = tonesOf(shown)
        const events = sequenceOf(data.kind, pitchesShown(), {
            ...settings,
            root: rootShown(),
            ...(tones ? { tones } : {}),
            // A list of notes plays as written (keyboard data-mn-order), then back.
            ...(shown.getAttribute('data-mn-order') === 'written' ? { ordered: true } : {})
        })
        playing = play(
            events,
            () => {
                playing = null
                if (settings.loop && wrap.isConnected) start()
                else show()
            },
            noteTargets(shown, events, data.kind)
        )
        show()
    }
    toggle.addEventListener('click', () => (playing ? stop() : start()))
    show()
    bar.appendChild(toggle)

    const loop = html(doc, 'button', 'mn-play-loop')
    loop.type = 'button'
    loop.appendChild(icon(doc, 'loop'))
    loop.title = 'Loop'
    loop.setAttribute('aria-label', 'Loop')
    loop.setAttribute('aria-pressed', 'false')
    loop.addEventListener('click', () => {
        settings.loop = !settings.loop
        loop.setAttribute('aria-pressed', String(settings.loop))
        loop.classList.toggle('mn-on', settings.loop)
    })
    bar.appendChild(loop)

    const slider = (
        label: string,
        min: number,
        max: number,
        value: number,
        set: (n: number) => void,
        mark: string | SVGElement
    ) => {
        const field = html(doc, 'label', 'mn-play-field')
        field.title = `${label}: ${value}`
        const tag = html(doc, 'span', 'mn-play-label')
        tag.setAttribute('aria-hidden', 'true')
        tag.append(mark)
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
        return (n: number) => {
            input.value = String(n)
            field.title = `${label}: ${n}`
        }
    }
    let showStrum: ((n: number) => void) | null = null
    // Speed only when several notes play: BPM for scales, the strum's spread for chords.
    if (data.pitches.length > 1) {
        if (data.kind === 'scale')
            slider('Tempo (BPM)', 20, 240, settings.bpm, (n) => (settings.bpm = n), '♩')
        else
            showStrum = slider(
                'Strum (ms between strings)',
                0,
                200,
                settings.strum,
                (n) => {
                    settings.strum = n
                    strums[settings.sound] = n
                },
                '≋'
            )
    }
    slider(
        'Volume',
        0,
        100,
        Math.round(settings.volume * 100),
        (n) => (settings.volume = n / 100),
        icon(doc, 'volume')
    )

    const sound = html(doc, 'select', 'mn-play-sound')
    sound.setAttribute('aria-label', 'Sound')
    for (const value of ['guitar', 'piano'] as const) {
        const option = html(doc, 'option', undefined, value === 'guitar' ? 'Guitar' : 'Piano')
        option.value = value
        option.selected = value === settings.sound
        sound.appendChild(option)
    }
    // Choosing the other instrument draws the same notes for it (a fretboard on piano becomes a
    // keyboard); choosing the diagram's own brings its drawing back.
    let other: Element | null | undefined
    // A drawing that isn't an instrument (the circle of fifths) keeps itself: only the sound changes.
    const redraws = diagram.getAttribute('data-mn-redraw') !== 'no'
    const drawFor = () => {
        if (!redraws) return
        if (settings.sound !== data.sound) other ??= redrawFor(doc, diagram, data)
        const next = settings.sound === data.sound ? diagram : (other ?? diagram)
        // Only while the host leaves the drawing in its wrapper.
        if (next !== shown && shown.parentNode === wrap) {
            wrap.replaceChild(next, shown)
            shown = next
        }
    }
    sound.addEventListener('change', () => {
        // What plays stops first: its notes belong to the drawing that goes away.
        stop()
        settings.sound = sound.value === 'piano' ? 'piano' : 'guitar'
        // Each instrument its own strum.
        settings.strum = strums[settings.sound]
        showStrum?.(settings.strum)
        drawFor()
    })
    // An app or a page that starts on the other sound (play: { sound }) shows its drawing.
    drawFor()
    bar.appendChild(sound)

    // A dot or a key plays its note, on either drawing (the bar has no notes).
    wrap.addEventListener('click', (event) => {
        // Not `instanceof Element`: nodes of a popout window have that window's Element.
        const node = event.target as Partial<Element> | null
        // A mark's hit area (#69) plays the mark it surrounds.
        const target =
            typeof node?.closest === 'function'
                ? (node.closest('[data-midi]') ??
                  node.closest('.mn-mark')?.querySelector('[data-midi]') ??
                  null)
                : null
        const midi = Number(target?.getAttribute('data-midi'))
        if (!target || !Number.isFinite(midi)) return
        stop()
        // A chord on the element (a key on the circle of fifths) is strummed; else its one note.
        // Only the clicked element lights, not the pitch's other places.
        const strum = (target.getAttribute('data-mn-strum') ?? '')
            .split(' ')
            .filter(Boolean)
            .map(Number)
            .filter((n) => Number.isFinite(n))
        const events = strum.length
            ? sequenceOf('chord', strum, settings)
            : [{ midi, time: 0, duration: 1.5 }]
        playing = play(
            events,
            () => {
                playing = null
                show()
            },
            events.map(() => [target])
        )
        show()
    })
    // Touch screens have no hover: a tap on the diagram shows the bar.
    wrap.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch' || bar.contains(event.target as Node)) return
        wrap.classList.toggle('mn-play-open')
    })
    return stop
}
