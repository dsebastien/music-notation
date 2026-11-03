/**
 * What a rendered block draws, read back from its elements: titles, chord names, each dot's or
 * key's note and label, the frets or keys shown. So a script can check that a block draws what the
 * text around it says, not only that it renders.
 */
import { chordNoteSet, midiOf, nameOf, noteOf } from '../index.js'

export interface GuitarString {
    /** As guitarists count them: 1 is the highest string. */
    string: number
    /** null: muted; 0: open. */
    fret: number | null
    /** With its octave ("A2"), when the tuning is known. */
    note: string | null
    /** The text on the dot (a finger, an interval, a note name). */
    label: string | null
    root: boolean
    /** Transition marks: anchor or guide. */
    mark: 'anchor' | 'guide' | null
}

export interface GuitarChordDiagram {
    type: 'guitar-chord'
    title: string | null
    chord: string | null
    /** Lowest string first, as blocks write them ("x02210", "8-10-10-9-8-8"). */
    frets: string
    /** First and last fret drawn. */
    fretRange: [number, number]
    /** Lowest string first. */
    strings: GuitarString[]
    /** The capo's fret, when there is one (frets then count from it unless `fretsFrom` is nut). */
    capo?: number
    fretsFrom?: 'capo' | 'nut'
    /** The chord the shape sounds with the capo ("B" for an A shape with a capo on 2). */
    sounds?: string
}

export interface FretboardDot {
    string: number
    fret: number
    note: string
    label: string | null
    root: boolean
    /** characteristic (a mode's own note), different (not in the compared scale). */
    marks: string[]
}

export interface FretboardDiagram {
    type: 'fretboard'
    title: string | null
    /** The scale, chord or notes drawn ("A minor pentatonic"). */
    notes: string | null
    fretRange: [number, number]
    /** Open strings, lowest first. */
    tuning: string[]
    /** Lowest string first, then by fret. */
    dots: FretboardDot[]
    /** A compared scale's notes missing here (`compare:`), drawn faint. */
    ghosts: { string: number; fret: number; note: string }[]
    /** The capo's fret, when there is one; `tuning` is then what the strings sound. */
    capo?: number
    fretsFrom?: 'capo' | 'nut'
}

export interface KeyboardKey {
    note: string
    label: string | null
    finger: string | null
    root: boolean
    marks: string[]
    /** The hand that plays it, when the piano chord says (hands: left+right). */
    hand?: 'left' | 'right'
}

export interface KeyboardDiagram {
    type: 'keyboard'
    title: string | null
    /** The chord, for piano chords. */
    chord: string | null
    notes: string | null
    /** Lowest and highest key drawn. */
    keyRange: [string, string]
    /** The highlighted keys, low to high. */
    keys: KeyboardKey[]
    /** A compared scale's notes missing here (`compare:`), drawn faint, low to high. */
    ghosts: string[]
}

export interface ChartDiagram {
    type: 'chart'
    title: string | null
    /** Each chord once, in the order it first appears (transposed when the song says so). */
    chords: string[]
    sections: string[]
}

/** A diagram of a row that has a mistake: its message is in the block's error. */
export interface FailedDiagram {
    type: 'error'
    message: string
}

export type Diagram =
    GuitarChordDiagram | FretboardDiagram | KeyboardDiagram | ChartDiagram | FailedDiagram

const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/)
const has = (el: Element, cls: string) => classes(el).includes(cls)
const text = (el: Element | null | undefined) => el?.textContent?.trim() || null
const int = (value: string | null) => (value === null ? null : Number(value))

const marksOf = (el: Element) =>
    classes(el).flatMap((c) =>
        c === 'mn-char' ? ['characteristic'] : c === 'mn-diff' ? ['different'] : []
    )

/** A spelled note with its octave: B#3 is MIDI 60, so the octave follows the letter. */
function spelled(name: string, midi: number): string {
    const octave = Math.floor(midi / 12) - 1
    for (const o of [octave, octave - 1, octave + 1]) {
        if (midiOf(`${name}${o}`) === midi) return `${name}${o}`
    }
    return noteOf(midi)
}

/** The label drawn right after a mark, if any. */
const labelAfter = (el: Element, cls: string) => {
    const next = el.nextElementSibling
    return next && has(next, cls) ? text(next) : null
}

/** A capo's fret and where frets count from, when the diagram has a capo. */
function capoOf(svg: Element): { capo?: number; fretsFrom?: 'capo' | 'nut' } {
    const capo = int(svg.getAttribute('data-mn-capo'))
    if (!capo) return {}
    return { capo, fretsFrom: svg.getAttribute('data-mn-frets-from') === 'nut' ? 'nut' : 'capo' }
}

function guitarChord(svg: Element): GuitarChordDiagram {
    const chord = svg.getAttribute('data-mn-chord')
    const sounds = svg.getAttribute('data-mn-sounds')
    // Notes are what sounds: with a capo, spelled as the sounding chord spells them.
    const set = sounds ? chordNoteSet(sounds) : chord ? chordNoteSet(chord) : null
    const strings = [...svg.querySelectorAll('[data-mn-string]')].map((el): GuitarString => {
        const fret = int(el.getAttribute('data-mn-fret'))
        const midi = int(el.getAttribute('data-midi'))
        const name =
            midi === null
                ? null
                : (set?.members.find((m) => m.chroma === midi % 12)?.name ??
                  nameOf(midi, set?.preferFlats))
        return {
            string: Number(el.getAttribute('data-mn-string')),
            fret,
            note: name !== null && midi !== null ? spelled(name, midi) : null,
            label: fret ? labelAfter(el, 'mn-dot-text') : null,
            root: has(el, 'mn-root'),
            mark: has(el, 'mn-anchor') ? 'anchor' : has(el, 'mn-guide') ? 'guide' : null
        }
    })
    const base = parseInt(text(svg.querySelector('.mn-base-fret')) ?? '1', 10)
    const rows = svg.querySelectorAll('line.mn-fret, line.mn-nut').length - 1
    const frets = strings.map((s) => (s.fret === null ? 'x' : String(s.fret)))
    return {
        type: 'guitar-chord',
        title: text(svg.querySelector('.mn-title')),
        chord,
        frets: frets.join(frets.some((f) => f.length > 1) ? '-' : ''),
        fretRange: [base, base + rows - 1],
        strings,
        ...capoOf(svg),
        ...(sounds ? { sounds } : {})
    }
}

function fretboard(svg: Element): FretboardDiagram {
    const range = (svg.getAttribute('data-mn-frets') ?? '0-0').split('-').map(Number)
    // String names are drawn highest string first.
    const tuning = [...svg.querySelectorAll('.mn-string-name')].map((el) => text(el) ?? '?')
    const dots = [...svg.querySelectorAll('circle[data-mn-string]')]
        .map((el): FretboardDot => ({
            string: Number(el.getAttribute('data-mn-string')),
            fret: Number(el.getAttribute('data-mn-fret')),
            note: spelled(
                el.getAttribute('data-mn-note') ?? '',
                Number(el.getAttribute('data-midi'))
            ),
            label: labelAfter(el, 'mn-dot-text'),
            root: has(el, 'mn-root'),
            marks: marksOf(el)
        }))
        .sort((a, b) => b.string - a.string || a.fret - b.fret)
    const ghosts = [...svg.querySelectorAll('circle[data-mn-ghost-string]')]
        .map((el) => ({
            string: Number(el.getAttribute('data-mn-ghost-string')),
            fret: Number(el.getAttribute('data-mn-fret')),
            note: spelled(
                el.getAttribute('data-mn-note') ?? '',
                Number(el.getAttribute('data-mn-pitch'))
            )
        }))
        .sort((a, b) => b.string - a.string || a.fret - b.fret)
    return {
        type: 'fretboard',
        title: text(svg.querySelector('.mn-title')),
        notes: svg.getAttribute('data-mn-set'),
        fretRange: [range[0] ?? 0, range[1] ?? 0],
        tuning: tuning.reverse(),
        dots,
        ghosts,
        ...capoOf(svg)
    }
}

function keyboard(svg: Element): KeyboardDiagram {
    const all = [...svg.querySelectorAll('rect[data-midi]')]
    const midis = all.map((el) => Number(el.getAttribute('data-midi')))
    const fingers = new Map(
        [...svg.querySelectorAll('.mn-key-finger')].map((el) => [
            Number(el.getAttribute('data-mn-key')),
            text(el)
        ])
    )
    const keys = all
        .filter((el) => has(el, 'mn-on'))
        .map((el) => {
            const midi = Number(el.getAttribute('data-midi'))
            return {
                midi,
                note: spelled(el.getAttribute('data-mn-note') ?? '', midi),
                label: labelAfter(el, 'mn-key-label'),
                finger: fingers.get(midi) ?? null,
                root: has(el, 'mn-root'),
                marks: marksOf(el),
                ...(has(el, 'mn-hand-left')
                    ? { hand: 'left' as const }
                    : has(el, 'mn-hand-right')
                      ? { hand: 'right' as const }
                      : {})
            }
        })
        .sort((a, b) => a.midi - b.midi)
        .map(({ midi: _, ...key }) => key)
    return {
        type: 'keyboard',
        title: text(svg.querySelector('.mn-title')),
        chord: svg.getAttribute('data-mn-chord'),
        notes: svg.getAttribute('data-mn-set'),
        keyRange: [noteOf(Math.min(...midis)), noteOf(Math.max(...midis))],
        keys,
        ghosts: all
            .filter((el) => has(el, 'mn-ghost'))
            .map((el) => {
                const midi = Number(el.getAttribute('data-midi'))
                return spelled(el.getAttribute('data-mn-note') ?? '', midi)
            })
    }
}

function chart(el: Element): ChartDiagram {
    const chords: string[] = []
    for (const c of el.querySelectorAll('.mn-chord')) {
        const name = text(c)
        if (name && !chords.includes(name)) chords.push(name)
    }
    return {
        type: 'chart',
        title: text(el.querySelector('.mn-chart-title')),
        chords,
        sections: [...el.querySelectorAll('.mn-section-label')].map((s) => text(s) ?? '')
    }
}

/** Every diagram a rendered block holds, in order. */
export function describeBlock(el: Element): Diagram[] {
    return [...el.querySelectorAll('svg.mn-svg, .mn-chart, .mn-cell.mn-error')].map((d) => {
        if (has(d, 'mn-error')) {
            // The cell says "chord, diagram 2: …": the language is already in the report.
            const message = text(d.querySelector('.mn-error-message')) ?? ''
            return { type: 'error', message: message.replace(/^[a-z]+, /, '') }
        }
        if (has(d, 'mn-chart')) return chart(d)
        if (has(d, 'mn-fretboard')) return fretboard(d)
        if (has(d, 'mn-keyboard')) return keyboard(d)
        return guitarChord(d)
    })
}

const quoted = (s: string | null) => (s ? `"${s}"` : null)

const listed = (parts: (string | null | false)[]) => parts.filter(Boolean).join(', ')

const extra = (label: string | null, root: boolean, more: string[] = []) =>
    [label !== null ? `"${label}"` : null, root ? 'root' : null, ...more].filter(Boolean).join(' ')

/** "capo 2" (frets from the capo) or "capo 2, frets from the nut". */
const capoText = (capo: number, from?: 'capo' | 'nut') =>
    `capo ${capo}${from === 'nut' ? ', frets from the nut' : ''}`

/** One diagram in words: a heading line, then what each string, dot or key shows. */
export function formatDiagram(d: Diagram, n: number): string[] {
    const head = `${n}. `
    const pad = ' '.repeat(head.length)
    switch (d.type) {
        case 'error':
            return [`${head}error: ${d.message}`]
        case 'chart':
            return [
                `${head}${listed([
                    'chart',
                    quoted(d.title),
                    d.sections.length > 0 && `sections ${d.sections.join(', ')}`,
                    `chords ${d.chords.join(' ') || 'none'}`
                ])}`
            ]
        case 'guitar-chord': {
            const strings = d.strings.map(
                (s) =>
                    `${s.string} ${s.fret === null ? 'x' : [s.fret, s.note, extra(s.label, s.root, s.mark ? [s.mark] : [])].filter((p) => p !== null && p !== '').join(' ')}`
            )
            return [
                `${head}${listed([
                    'chord diagram',
                    quoted(d.title),
                    d.chord && `chord ${d.chord}`,
                    d.capo !== undefined && capoText(d.capo, d.fretsFrom),
                    d.sounds !== undefined && `sounds ${d.sounds}`,
                    `frets ${d.fretRange[0]}-${d.fretRange[1]}`,
                    d.frets
                ])}`,
                `${pad}strings: ${strings.join(' | ')}`
            ]
        }
        case 'fretboard': {
            const lines = [
                `${head}${listed([
                    'fretboard',
                    quoted(d.title),
                    d.notes,
                    d.capo !== undefined && capoText(d.capo, d.fretsFrom),
                    `frets ${d.fretRange[0]}-${d.fretRange[1]}`,
                    `tuning ${d.tuning.join(' ')}`
                ])}`
            ]
            const count = d.tuning.length
            for (let string = count; string >= 1; string--) {
                const dots = d.dots.filter((dot) => dot.string === string)
                if (!dots.length) continue
                const name = d.tuning[count - string] ?? '?'
                lines.push(
                    `${pad}string ${string} (${name}): ${dots
                        .map((dot) =>
                            [dot.fret, dot.note, extra(dot.label, dot.root, dot.marks)]
                                .filter((p) => p !== '')
                                .join(' ')
                        )
                        .join(', ')}`
                )
            }
            if (d.ghosts.length) {
                lines.push(
                    `${pad}ghosts (compared scale): ${d.ghosts
                        .map((g) => `string ${g.string} fret ${g.fret} ${g.note}`)
                        .join(', ')}`
                )
            }
            return lines
        }
        case 'keyboard':
            return [
                `${head}${listed([
                    'keyboard',
                    quoted(d.title),
                    d.chord && `chord ${d.chord}`,
                    d.notes,
                    `keys ${d.keyRange[0]}-${d.keyRange[1]}`
                ])}`,
                `${pad}keys: ${
                    d.keys
                        .map((k) =>
                            [
                                k.note,
                                extra(k.label, k.root, [
                                    ...(k.finger ? [`finger ${k.finger}`] : []),
                                    ...(k.hand ? [`${k.hand} hand`] : []),
                                    ...k.marks
                                ])
                            ]
                                .filter(Boolean)
                                .join(' ')
                        )
                        .join(', ') || 'none'
                }`,
                ...(d.ghosts.length
                    ? [`${pad}ghosts (compared scale): ${d.ghosts.join(', ')}`]
                    : [])
            ]
    }
}
