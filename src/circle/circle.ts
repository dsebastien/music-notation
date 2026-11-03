/**
 * The circle of fifths (#44), as SVG: the 12 major keys, their relative minors and the diminished
 * chords on their leading tones, each key's signature, and a chosen key's diatonic chords marked
 * on the wheel with their numerals, its tonic and its IV and V neighbours set apart. A row of the
 * key's chords sits under the wheel. Keys and chords carry their notes (`data-midi`, the root,
 * and `data-mn-strum`, the chord) so playback can play them on a click; the key's chords also
 * carry their root's pitch class (`data-mn-chroma`) so they light while the scale plays.
 */
import { Key } from 'tonal'
import { svg, svgRoot, svgText } from '../render/dom.js'
import { titleWidth } from '../render/layout.js'
import { chordNoteSet } from '../theory/note-set.js'
import { chromaOf, splitChordSymbol } from '../theory/pitch.js'
import { parseBlockSource } from '../blocks/block-source.js'
import type { Renderer } from '../blocks/renderers.js'
import {
    keyChords,
    readKey,
    MODES,
    keyNotes,
    keySignature,
    signatureText,
    type KeyChord,
    type MusicalKey
} from '../theory/keys.js'

export interface CircleOptions {
    /** The key to mark; C major by default. */
    key?: MusicalKey
    /** Seventh chords instead of triads, for the marked chords. */
    sevenths?: boolean
    /** Set the IV and V chords (iv and v in minor) apart; true by default. */
    neighbours?: boolean
    title?: string
}

/** Major keys clockwise from C, as usually written (F# and Gb share a place). */
const MAJORS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#/Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F']
const MINORS = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m/Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm']
/** The diminished chord on each major key's leading tone. */
const DIMINISHED = ['B°', 'F#°', 'C#°', 'G#°', 'D#°', 'A#°', 'E#°', 'C°', 'G°', 'D°', 'A°', 'E°']
const SIGNATURES = ['0', '1♯', '2♯', '3♯', '4♯', '5♯', '6♯/6♭', '5♭', '4♭', '3♭', '2♭', '1♭']

const SIZE = 400
const CENTER = SIZE / 2
const TITLE = 24
/** Ring edges, from the outside: signatures, major keys, minor keys, diminished chords, center. */
const R = { sig: 196, major: 176, minor: 128, dim: 88, center: 58 }
const CHIP_H = 40
const CHIP_GAP = 4

type Ring = 'major' | 'minor' | 'dim'

/** "F#" → "F♯", "Bbm7b5" → "B♭ø7", "Cdim" → "C°": names as the wheel shows them. */
export function pretty(symbol: string): string {
    return symbol
        .replace(/^([A-G])#/, '$1♯')
        .replace(/^([A-G])b/, '$1♭')
        .replace(/\/([A-G])#/, '/$1♯')
        .replace(/\/([A-G])b/, '/$1♭')
        .replace(/m7b5$/, 'ø7')
        .replace(/dim7$/, '°7')
        .replace(/dim$/, '°')
}

/** The wheel position (0 = C at the top, clockwise by fifths) of a major key's pitch class. */
const positionOf = (chroma: number) => (chroma * 7) % 12

/** Where a chord sits: major chords on their key, minor ones on their relative major, diminished
 * ones on the major key they lead to. Null for other qualities. */
function cellOf(symbol: string): { ring: Ring; position: number } | null {
    const set = chordNoteSet(symbol)
    if (!set || set.root === null) return null
    const third = set.members.find((m) => m.interval?.startsWith('3'))?.interval
    const fifth = set.members.find((m) => m.interval?.startsWith('5'))?.interval
    if (third === '3M' && fifth === '5P') return { ring: 'major', position: positionOf(set.root) }
    if (third === '3m' && fifth === '5P')
        return { ring: 'minor', position: positionOf((set.root + 3) % 12) }
    if (third === '3m' && fifth === '5d')
        return { ring: 'dim', position: positionOf((set.root + 1) % 12) }
    return null
}

/** A point at a radius and an angle in degrees (0 at the top, clockwise). */
function point(r: number, degrees: number, top: number): [number, number] {
    const a = ((degrees - 90) * Math.PI) / 180
    return [CENTER + r * Math.cos(a), top + CENTER + r * Math.sin(a)]
}

/** A ring's slice for a position, as a path. */
function slice(outer: number, inner: number, position: number, top: number): string {
    const from = position * 30 - 15
    const to = position * 30 + 15
    const [x1, y1] = point(outer, from, top)
    const [x2, y2] = point(outer, to, top)
    const [x3, y3] = point(inner, to, top)
    const [x4, y4] = point(inner, from, top)
    const f = (n: number) => n.toFixed(2)
    return `M${f(x1)} ${f(y1)}A${outer} ${outer} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${inner} ${inner} 0 0 0 ${f(x4)} ${f(y4)}Z`
}

/** A chord's pitches around middle C: the root from G3 to F#4, the other notes stacked above. */
export function chordPitches(symbol: string): number[] {
    const set = chordNoteSet(symbol)
    if (!set || set.root === null) return []
    let previous = 55 + ((((set.root - 55) % 12) + 12) % 12) - 1
    return set.members.map((m) => {
        let midi = previous + 1 + ((((m.chroma - previous - 1) % 12) + 12) % 12)
        if (midi <= previous) midi += 12
        previous = midi
        return midi
    })
}

/** The diatonic triads, to place the chords (sevenths sit where their triad does). */
function placed(key: MusicalKey, sevenths: boolean) {
    const triads = keyChords(key, false)
    const shown = sevenths ? keyChords(key, true) : triads
    return shown.map((chord, i) => ({ chord, cell: cellOf(triads[i]!.symbol) }))
}

export function renderCircle(doc: Document, options: CircleOptions = {}): SVGElement {
    const key = options.key ?? { tonic: 'C', mode: 'major', name: 'C major' }
    const chords = placed(key, options.sevenths ?? false)
    const neighbours = options.neighbours ?? true
    const top = options.title ? TITLE : 0
    const width = Math.max(SIZE, titleWidth(options.title))
    const chipsTop = top + SIZE + 8
    const height = chipsTop + CHIP_H + 2
    const signature = keySignature(key)
    const label =
        `Circle of fifths, ${key.name}: ${signatureText(signature.count)}` +
        (signature.accidentals.length ? ` (${signature.accidentals.join(' ')})` : '') +
        `; chords: ${chords.map(({ chord }) => `${chord.numeral} ${chord.symbol}`).join(', ')}`
    const root = svgRoot(doc, width, height, 'mn-circle', label)
    // The wheel is centered when a long title widens the drawing.
    const shift = (width - SIZE) / 2
    const g = svg(doc, 'g', shift ? { transform: `translate(${shift} 0)` } : {})
    if (options.title) {
        root.appendChild(
            svgText(doc, options.title, {
                'class': 'mn-title',
                'x': width / 2,
                'y': 16,
                'text-anchor': 'middle'
            })
        )
    }
    root.appendChild(g)

    /** The chord on a cell, when the key has one there. */
    const at = (ring: Ring, position: number) =>
        chords.find(({ cell }) => cell?.ring === ring && cell.position === position)?.chord
    const markOf = (chord: KeyChord | undefined) =>
        !chord
            ? ''
            : chord.degree === 1
              ? ' mn-circle-tonic'
              : neighbours && (chord.degree === 4 || chord.degree === 5)
                ? ' mn-circle-neighbour'
                : ' mn-circle-diatonic'
    /** The triad a cell names (its default spelling), for playing it. */
    const triadOf = (ring: Ring, position: number) => {
        const major = MAJORS[position]!.split('/')[0]!
        if (ring === 'major') return major
        if (ring === 'minor') return MINORS[position]!.split('/')[0]!
        return `${DIMINISHED[position]!.replace('°', '')}dim`
    }
    const radii: Record<Ring, [number, number]> = {
        major: [R.major, R.minor],
        minor: [R.minor, R.dim],
        dim: [R.dim, R.center]
    }
    const defaults: Record<Ring, string[]> = {
        major: MAJORS,
        minor: MINORS,
        dim: DIMINISHED
    }

    for (const ring of ['major', 'minor', 'dim'] as Ring[]) {
        const [outer, inner] = radii[ring]
        for (let position = 0; position < 12; position++) {
            const chord = at(ring, position)
            const mark = markOf(chord)
            // The key's chords as the key spells them (E#° in F# major); the others as usual.
            const symbol = chord?.symbol ?? triadOf(ring, position)
            const pitches = chordPitches(symbol)
            const cell = svg(doc, 'path', {
                'class': `mn-circle-cell mn-circle-${ring}${mark}`,
                'd': slice(outer, inner, position, top),
                'data-mn-chord': symbol,
                'data-midi': pitches[0],
                'data-mn-strum': pitches.join(' '),
                // A chord of the key lights while the scale plays its root.
                'data-mn-chroma': chord && pitches.length ? pitches[0]! % 12 : undefined
            })
            const name = chord ? pretty(chord.symbol) : pretty(defaults[ring][position]!)
            const title = svg(doc, 'title')
            title.textContent = chord ? `${chord.numeral}: ${name}` : name.replace('/', ' or ')
            cell.appendChild(title)
            g.appendChild(cell)
            const mid = (outer + inner) / 2
            const solid = mark === ' mn-circle-tonic' || mark === ' mn-circle-neighbour'
            const textClass = `mn-circle-label mn-circle-label-${ring}${solid ? ' mn-circle-on' : ''}`
            const lines = name.includes('/') ? name.split('/') : [name]
            if (chord) lines.push(chord.numeral)
            const step = ring === 'dim' ? 10 : 12
            lines.forEach((line, i) => {
                const [x, y] = point(mid, position * 30, top)
                const isNumeral = chord !== undefined && i === lines.length - 1
                g.appendChild(
                    svgText(doc, line, {
                        'class': isNumeral ? `${textClass} mn-circle-numeral` : textClass,
                        x,
                        'y': y + 4 + (i - (lines.length - 1) / 2) * step,
                        'text-anchor': 'middle'
                    })
                )
            })
        }
    }

    // Key signatures around the wheel: the marked major keys' own (C# major: 7♯).
    for (let position = 0; position < 12; position++) {
        const chord = at('major', position)
        const text = chord
            ? signatureText(Key.majorKey(splitChordSymbol(chord.symbol)!.root).alteration).replace(
                  'no ♯ or ♭',
                  '0'
              )
            : SIGNATURES[position]!
        const [x, y] = point((R.sig + R.major) / 2, position * 30, top)
        g.appendChild(
            svgText(doc, text, {
                'class': `mn-circle-sig${chord ? ' mn-circle-sig-key' : ''}`,
                x,
                'y': y + 3.5,
                'text-anchor': 'middle'
            })
        )
    }

    // The center: the key, its signature and the notes it alters.
    const centerY = top + CENTER
    const centerLines: [string, string][] = [
        [pretty(key.tonic) + ` ${key.mode}`, 'mn-circle-key'],
        [signatureText(signature.count), 'mn-circle-key-sig']
    ]
    if (signature.accidentals.length && signature.accidentals.length <= 7) {
        centerLines.push([signature.accidentals.map(pretty).join(' '), 'mn-circle-key-notes'])
    }
    centerLines.forEach(([text, cls], i) => {
        g.appendChild(
            svgText(doc, text, {
                'class': cls,
                'x': CENTER,
                'y': centerY + 4 + (i - (centerLines.length - 1) / 2) * 14,
                'text-anchor': 'middle'
            })
        )
    })

    // The key's chords in a row, in scale order.
    const chipW = (SIZE - CHIP_GAP * 6) / 7
    chords.forEach(({ chord }, i) => {
        const x = i * (chipW + CHIP_GAP)
        const pitches = chordPitches(chord.symbol)
        const chip = svg(doc, 'rect', {
            'class': `mn-circle-chip${markOf(chord)}`,
            x,
            'y': chipsTop,
            'width': chipW.toFixed(2),
            'height': CHIP_H,
            'rx': 5,
            'data-mn-chord': chord.symbol,
            'data-midi': pitches[0],
            'data-mn-strum': pitches.join(' '),
            'data-mn-chroma': pitches.length ? pitches[0]! % 12 : undefined
        })
        const tip = svg(doc, 'title')
        tip.textContent = `${chord.numeral}: ${pretty(chord.symbol)}`
        chip.appendChild(tip)
        g.appendChild(chip)
        const solid =
            chord.degree === 1 || (neighbours && (chord.degree === 4 || chord.degree === 5))
        const on = solid ? ' mn-circle-on' : ''
        g.appendChild(
            svgText(doc, chord.numeral, {
                'class': `mn-circle-label mn-circle-numeral${on}`,
                'x': x + chipW / 2,
                'y': chipsTop + 15,
                'text-anchor': 'middle'
            })
        )
        g.appendChild(
            svgText(doc, pretty(chord.symbol), {
                'class': `mn-circle-label${on}`,
                'x': x + chipW / 2,
                'y': chipsTop + 31,
                'text-anchor': 'middle'
            })
        )
    })

    // Playback: the bar plays the key's scale, up to the tonic above; a click plays a key or chord.
    const tonic = chromaOf(key.tonic) ?? 0
    const start = 60 + tonic
    const scale = keyNotes(key).map(
        (n) => start + (((((chromaOf(n) ?? 0) - tonic) % 12) + 12) % 12)
    )
    root.setAttribute('data-mn-pitches', [...scale, start + 12].join(' '))
    root.setAttribute('data-mn-play', 'scale')
    root.setAttribute('data-mn-sound', 'piano')
    // A wheel isn't redrawn as a keyboard or fretboard when the sound changes.
    root.setAttribute('data-mn-redraw', 'no')
    root.setAttribute('data-mn-set', key.name)
    return root
}

const yes = (text: string | undefined, key: string, fallback: boolean): boolean => {
    if (text === undefined || text.trim() === '') return fallback
    const value = text.trim().toLowerCase()
    if (['yes', 'true', 'on'].includes(value)) return true
    if (['no', 'false', 'off'].includes(value)) return false
    throw new Error(`${key} must be yes or no, got "${text}"`)
}

/**
 * The `circle` block: `key:` (or a shorthand line: G, E minor, D dorian), `mode:` (major, minor or
 * a church mode), `chords: triads | sevenths`, `neighbours: yes | no`, `title:`.
 */
export const renderCircleBlock: Renderer = (doc, source) => {
    const block = parseBlockSource(source)
    const get = (name: string) => {
        const value = block.fields.get(name)?.trim()
        return value === '' ? undefined : value
    }
    const keyText = get('key') ?? block.head ?? 'C'
    const key = readKey(keyText)
    if (!key) throw new Error(`Unknown key "${keyText}": use e.g. key: G, key: Em or key: D dorian`)
    const modeText = get('mode')?.toLowerCase()
    if (modeText !== undefined) {
        if (!(MODES as readonly string[]).includes(modeText)) {
            throw new Error(
                `Unknown mode "${modeText}": use major, minor, dorian, phrygian, lydian, mixolydian or locrian`
            )
        }
        const written = /\s*[A-Ga-g][#♯b♭]?\s*(\S*)/.exec(keyText)?.[1] ?? ''
        if (written && key.mode !== modeText) {
            throw new Error(
                `key: ${keyText} already says ${key.mode}: leave out mode or write the key's note alone`
            )
        }
        key.mode = modeText as MusicalKey['mode']
        key.name = `${key.tonic} ${key.mode}`
    }
    const chordsText = get('chords')?.toLowerCase()
    if (chordsText !== undefined && chordsText !== 'triads' && chordsText !== 'sevenths') {
        throw new Error(`chords: use triads or sevenths, got "${chordsText}"`)
    }
    const neighbours = yes(get('neighbours') ?? get('neighbors'), 'neighbours', true)
    const title = get('title')
    return renderCircle(doc, {
        key,
        sevenths: chordsText === 'sevenths',
        neighbours,
        ...(title ? { title } : {})
    })
}
