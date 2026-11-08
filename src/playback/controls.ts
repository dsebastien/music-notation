/**
 * Hearing the diagrams (#58): the play options, what a diagram plays (read from its drawing), its
 * redrawing for the other instrument, and `attachPlayback`, which gives each block its one bar
 * below it (`block-bar.ts`) and each pattern, progression and chart its bar in time.
 */
import { accessibleName, setAccessibleName } from '../render/dom.js'
import { keyRangeOf, renderKeyboard } from '../keyboard/keyboard.js'
import { renderFretboard } from '../fretboard/fretboard.js'
import type { Hand } from '../render/layout.js'
import { chartNoteName, renderGuitarDiagram, STANDARD_TUNING } from '../chord/guitar.js'
import { generateVoicings } from '../chord/generate.js'
import {
    chordNoteSet,
    intervalLabel,
    listNoteSet,
    scaleNoteSet,
    type NoteLabel,
    type NoteSet
} from '../theory/note-set.js'
import { midiOf, nameOf } from '../theory/pitch.js'
import { DEFAULT_STRUM, lightPlayer, type NotePlayer, type PlayKind, type Sound } from './player.js'
import { strumBarFor } from './strum-bar.js'
import { progressionBarFor } from './progression-bar.js'
import { pickingBarFor } from './picking-bar.js'
import { blockBarFor, diagramGroup } from './block-bar.js'

export interface PlayOptions {
    /**
     * Plays the notes: a player, or a function returning one at each play (null for the default),
     * so a soundfont loaded later is used once it's there. The function gets the diagram's window
     * (popouts have their own). The light synthesizer by default.
     */
    player?: NotePlayer | ((win: Window) => NotePlayer | null | undefined)
    /** Guitar or piano; by default the diagram's (piano for keyboards and piano chords). */
    sound?: Sound
    /**
     * 0 to 1, 0.8 by default. The bars have no volume (#58): it is the app's setting. A function
     * is read at each play (and each pass of a loop), so a setting changed in the app applies at
     * once.
     */
    volume?: number | (() => number)
    /** Scales: notes per minute, 90 by default; also strum patterns' tempo when they have none. */
    bpm?: number
    /**
     * Chords: milliseconds between strings; by default 12 on guitar, 0 (a block) on piano. A number
     * is the guitar's (piano chords stay a block); `{ guitar, piano }` sets each instrument's.
     */
    strum?: number | { guitar?: number; piano?: number }
    /**
     * The hand of the page or app (its layout default): a diagram redrawn for guitar from one that
     * has no hand (a keyboard, a piano chord) is drawn for it. Right by default (#60).
     */
    hand?: Hand
    /**
     * Called with each bar that plays a piece in time (strum, picking, progression, ChordPro chart;
     * #77), once it's built, so the app can add its own controls (`bar.add`) and read the tempo set
     * on it. What it returns (a function) is called when the block is destroyed. A hook that
     * throws leaves the bar as it is.
     */
    timedBar?: (bar: TimedBar) => void | (() => void)
}

/** A bar that plays a piece in time, as an app sees it (`PlayOptions.timedBar`, #77). */
export interface TimedBar {
    /** What it plays: a strumming or picking pattern, a progression block or a ChordPro chart. */
    kind: 'strum' | 'picking' | 'progression' | 'chart'
    /** The bar itself (`.mn-play`, role group). */
    element: HTMLElement
    /** The drawing it plays: the pattern's SVG, the `.mn-progression` or the `.mn-chart`. */
    drawing: Element
    /** Counted in dotted beats (6/8, 9/8, 12/8): the tempo counts dotted quarters. */
    compound: boolean
    /** The tempo set on the bar (20 to 240), in the beat it counts: what the next pass plays at. */
    tempo(): number
    /** Calls `listener` with each new tempo set on the bar; returns a function that stops it. */
    onTempo(listener: (bpm: number) => void): () => void
    /**
     * Adds an app control at the end of the bar, after the bar's own (so they come last in the
     * focus order), in its `.mn-play-app` slot. It shows and hides with the bar.
     */
    add(control: HTMLElement): void
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

export { icon } from './bar-parts.js'

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
export interface DiagramData {
    kind: PlayKind
    pitches: number[]
    sound: Sound
    /** The tonic's pitch class, from the root mark (scales start on it); null without one. */
    root: number | null
}

/** The pitch classes of a chord drawn over a scale (its tones), or undefined. */
export function tonesOf(drawing: Element): number[] | undefined {
    const tones = [...drawing.querySelectorAll('.mn-tone[data-midi]')]
        .map((el) => Number(el.getAttribute('data-midi')))
        .filter((midi) => Number.isFinite(midi))
        .map((midi) => ((midi % 12) + 12) % 12)
    return tones.length ? [...new Set(tones)] : undefined
}

/** The pitch class of a drawing's root mark (a root dot or key), or null. */
export function rootOf(drawing: Element): number | null {
    const mark = drawing.querySelector('.mn-root[data-midi]')
    const midi = Number(mark?.getAttribute('data-midi'))
    return mark && Number.isFinite(midi) ? ((midi % 12) + 12) % 12 : null
}

export function dataOf(diagram: Element): DiagramData | null {
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
export function redrawFor(
    doc: Document,
    diagram: Element,
    data: DiagramData,
    pageHand: Hand = 'right'
): Element | null {
    // A guitar drawing keeps the diagram's own hand, else the page's (a keyboard has none).
    const own = diagram.getAttribute('data-mn-hand')
    const hand: Hand = own === 'left' || own === 'right' ? own : pageHand
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
    // A hand belongs to the piano: "C major, right hand" is "C major" on a guitar.
    const shownTitle = diagram.querySelector('.mn-title')?.textContent ?? undefined
    const heading = toGuitar ? shownTitle?.replace(/,\s*(left|right) hand$/, '') : shownTitle
    // A piano plays what the guitar sounds: the title says which chord that is.
    const title =
        sounds && heading ? `${heading} (sounds ${sounds})` : (heading ?? sounds ?? undefined)
    // A piano chord on guitar: a grip a guitarist plays (the easiest voicing of the chord), not a
    // map of its pitches over the neck. An inversion keeps its bass (C first inversion: C/E's
    // grip); a rootless voicing has no bass of its own.
    const given = chord ?? named
    const chordSet = toGuitar && data.kind === 'chord' && given ? chordNoteSet(given) : null
    const chroma = (midi: number) => ((midi % 12) + 12) % 12
    const lowest = chroma(Math.min(...data.pitches))
    const bassName = chordSet?.members.find((m) => m.chroma === lowest)?.name
    const rooted = data.pitches.some((midi) => chroma(midi) === chordSet?.root)
    const symbol =
        given && rooted && !given.includes('/') && bassName && chordSet?.root !== lowest
            ? `${given}/${bassName}`
            : given
    const grip =
        chordSet && chordSet.root !== null && symbol ? generateVoicings(symbol)[0] : undefined
    if (grip && chordSet) {
        const members = chordSet.members
        const labels =
            label === 'intervals' || label === 'notes'
                ? grip.frets.map((fret, s) => {
                      if (fret === null) return null
                      const member = members.find(
                          (m) => m.chroma === (STANDARD_TUNING[s]! + fret) % 12
                      )
                      if (!member) return null
                      return label === 'notes' || member.interval === null
                          ? chartNoteName(member.name)
                          : intervalLabel(member.interval)
                  })
                : label === 'none'
                  ? grip.frets.map(() => null)
                  : null
        const drawn = renderGuitarDiagram(doc, grip, {
            hand,
            ...(title ? { title } : {}),
            root: chordSet.root,
            ...(labels ? { labels } : {})
        })
        drawn.setAttribute('data-mn-chord', symbol!)
        const name = accessibleName(diagram)
        if (name) setAccessibleName(drawn, `${name}, drawn for guitar`)
        drawn.classList.add('mn-redrawn')
        return drawn
    }
    // A fretboard and a keyboard share their orientation; a chord diagram's is its own.
    const orientation =
        diagram.getAttribute('data-mn-orientation') === 'vertical' ? 'vertical' : undefined
    const drawn = toGuitar
        ? renderFretboard(doc, set, {
              label,
              hand,
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
 * Makes what `el` draws playable: each block's diagrams (an SVG with notes to play) get one bar
 * below them, strumming and picking patterns, progressions and ChordPro charts their bar in time.
 * Returns a function that stops whatever plays.
 */
export function attachPlayback(el: HTMLElement, options: PlayOptions = {}): () => void {
    const doc = el.ownerDocument
    const win = doc.defaultView
    if (!win) return () => {}
    const stops: (() => void)[] = []
    // Strumming patterns (#22): their own bar, with tempo and count-in.
    for (const pattern of [...el.querySelectorAll('svg[data-mn-strum]')])
        stops.push(strumBarFor(doc, win, pattern, options))
    // Picking patterns (#51): the same bar, with a click.
    for (const pattern of [...el.querySelectorAll('svg[data-mn-picking]')])
        stops.push(pickingBarFor(doc, win, pattern, options))
    // The diagrams, by block: those of a progression or a chart play on a click, its bar in time
    // being the block's one bar; the others get a bar of their own block.
    const timed = [...el.querySelectorAll('[data-mn-progression-play]')]
    const byBlock = new Map<Element, { diagram: Element; data: DiagramData }[]>()
    const byDrawing = new Map<Element, { diagram: Element; data: DiagramData }[]>()
    for (const diagram of [...el.querySelectorAll('svg[data-mn-pitches]')]) {
        // A diagram with a pick layer (Music Practice #73): the layer owns its clicks and keys.
        if (diagram.hasAttribute('data-mn-pick')) continue
        const data = dataOf(diagram)
        if (!data) continue
        const drawing = timed.find((t) => t.contains(diagram))
        const key = drawing ?? diagram.closest('.mn-block') ?? el
        const map = drawing ? byDrawing : byBlock
        map.set(key, [...(map.get(key) ?? []), { diagram, data }])
    }
    for (const [block, diagrams] of byBlock)
        stops.push(blockBarFor(doc, win, block, diagrams, options))
    // Progressions and ChordPro charts (#46): one chord a bar, in time.
    for (const drawing of timed) {
        const diagrams = byDrawing.get(drawing)
        const group = diagrams?.length
            ? diagramGroup(doc, win, diagrams, options, { bar: false }).group
            : null
        const bar = progressionBarFor(doc, win, drawing, options, group)
        stops.push(() => {
            bar()
            group?.destroy()
        })
    }
    return () => stops.forEach((stop) => stop())
}
