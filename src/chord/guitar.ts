/** Guitar (and any fretted instrument) chord diagrams, as SVG. */
import { dotLabel, playableMark, svg, svgLabel, svgLine, svgRoot, svgText } from '../render/dom.js'
import {
    drawTitle,
    neckFrame,
    titleLines,
    titleWidth,
    TITLE_LINE,
    type Hand,
    type NeckLayout,
    type Orientation
} from '../render/layout.js'
import { chromaOf, nameOf } from '../theory/pitch.js'

/** Standard tuning, lowest string first. */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64]

/**
 * A note name as guitar charts write it on a dot: a double sharp or flat becomes the plain note
 * (E7#9's F## is G, Bbb is A); any other name or label stays.
 */
export function chartNoteName(name: string): string {
    if (!/^[A-G](##|bb)$/.test(name)) return name
    return nameOf(chromaOf(name)!, name.endsWith('b'))
}

export interface FrettedVoicing {
    /** Absolute frets, lowest string first: null = muted, 0 = open. */
    frets: (number | null)[]
    /** Finger per string ("1".."4", "T"); null = none. */
    fingers: (string | null)[]
    /** First fret shown; computed when absent. */
    baseFret?: number
}

export interface GuitarDiagramOptions {
    title?: string
    /** Chroma of the chord's root: its dots are marked. */
    root?: number | null
    /** Open-string pitches (MIDI), lowest first. */
    tuning?: number[]
    /** Vertical (default): the nut on top. Horizontal: the high string on top, the nut on the left. */
    orientation?: Orientation
    /** Left-handed: mirrored (the low string on the right, or the nut on the right). */
    hand?: Hand
    /**
     * Fingers worked out for a voicing written without any (`fingerVoicing`): only its full
     * barres are drawn from them (F 133211 keeps its bar); its dots stay without numbers (#73).
     */
    barreFingers?: readonly (string | null)[] | null
    /** Text in each string's dot instead of its finger (intervals, note names); null for none. */
    labels?: (string | null)[]
    /** Chord transitions: fingers that stay (anchor) or slide (guide), per string. */
    marks?: ('anchor' | 'guide' | null)[]
    /**
     * A capo on this fret: drawn as a bar, open strings sound at it, and a caption says "Capo N".
     * Frets are counted from the capo (as players read them) unless `fretsFrom` is `nut`.
     */
    capo?: number
    /**
     * `capo` (default): the frets count from the capo, which sits where the nut is drawn. `nut`:
     * the frets count from the nut, the capo is drawn on its fret, and strings at that fret are
     * played by the capo (a ring on it).
     */
    fretsFrom?: 'capo' | 'nut'
    /** The chord the shape sounds with the capo, added to the caption ("Capo 2, sounds B"). */
    sounds?: string
    /**
     * false: no caption under the diagram (a row of shapes with one caption for the capo, such as
     * a chart's chords used); the capo bar and the sounding pitches stay.
     */
    caption?: boolean
}

/** "x02220", "x-10-12-12-11-10", "x 10 12 12 11 10" → frets; null when invalid. */
export function parseFrets(text: string): (number | null)[] | null {
    const trimmed = text.trim()
    const tokens = /[\s,-]/.test(trimmed) ? trimmed.split(/[\s,-]+/) : [...trimmed]
    const frets = tokens
        .filter(Boolean)
        .map((t) => (/^[xX]$/.test(t) ? null : /^\d+$/.test(t) ? Number(t) : NaN))
    return frets.length >= 2 && frets.every((f) => f === null || (Number.isInteger(f) && f <= 36))
        ? frets
        : null
}

/** "x01230", "x-1-3-4-2-1", "x 1 3 4 2 1" → fingers; 0 and x mean no finger. */
export function parseFingers(text: string): (string | null)[] {
    const trimmed = text.trim()
    const tokens =
        /[\s,]/.test(trimmed) || trimmed.includes('-', 1) ? trimmed.split(/[\s,-]+/) : [...trimmed]
    return tokens.filter(Boolean).map((t) => (/^[0xX]$/.test(t) ? null : t.toUpperCase()))
}

/** The first fret shown: 1 when the chord fits in the first 4 frets, else its lowest fretted fret. */
export function baseFretOf(frets: (number | null)[]): number {
    const fretted = frets.filter((f): f is number => f !== null && f > 0)
    if (!fretted.length || Math.max(...fretted) <= 4) return 1
    return Math.min(...fretted)
}

interface Barre {
    fret: number
    from: number
    to: number
    finger: string
    /** The strings the finger holds at that fret, lowest first. */
    strings: number[]
    /** A full barre: over four strings or more, or over strings fretted higher (F 133211, Bm7
     * x24232), not a small one (F xx3211, a triad's two strings under one finger). */
    full: boolean
}

/** Strings held by the same finger on the same fret, across at least two strings. */
function barresOf(
    voicing: Pick<FrettedVoicing, 'frets' | 'fingers'>,
    capoFret: number | null
): Barre[] {
    const byKey = new Map<string, number[]>()
    voicing.frets.forEach((fret, string) => {
        const finger = voicing.fingers[string]
        // Strings the capo holds have no finger.
        if (fret === null || fret === 0 || fret === capoFret || !finger) return
        const key = `${finger}@${fret}`
        byKey.set(key, [...(byKey.get(key) ?? []), string])
    })
    const barres: Barre[] = []
    for (const [key, strings] of byKey) {
        if (strings.length < 2) continue
        const [finger, fretText] = key.split('@')
        const fret = Number(fretText)
        const from = Math.min(...strings)
        const to = Math.max(...strings)
        let under = false
        for (let s = from + 1; s < to; s++) {
            const f = voicing.frets[s]
            if (!strings.includes(s) && f !== null && f !== undefined && f > fret) under = true
        }
        barres.push({ fret, from, to, finger: finger!, strings, full: under || strings.length > 3 })
    }
    return barres
}

/**
 * The barre a voicing is held with: `full` when one finger lies over four strings or more, or over
 * strings fretted higher (F 133211, Bm7 x24232: an E-shape or A-shape barre chord), `partial` for a
 * smaller one (F xx3211, an A shape's ring-finger barre x3555x), null when no finger holds two
 * strings on one fret.
 */
export function barreKind(
    voicing: Pick<FrettedVoicing, 'frets' | 'fingers'>
): 'full' | 'partial' | null {
    const barres = barresOf(voicing, null)
    if (!barres.length) return null
    return barres.some((b) => b.full) ? 'full' : 'partial'
}

/**
 * Whether a finger holds two strings or more on one fret (a full or a partial barre): what told
 * an "E-shape barre" from a "CAGED E" before shapes had one name per CAGED letter. Generated
 * voicings say the same with `reasons.includes('barre')`.
 */
export const isBarreVoicing = (voicing: Pick<FrettedVoicing, 'frets' | 'fingers'>): boolean =>
    barreKind(voicing) !== null

/** Between two strings. */
const SPACING = 18
/** One fret. */
const ROW = 20
/** Room for the open and muted marks before the nut. */
const MARKERS = 16
/** A playable mark's hit area along its string (its string's lane across): taller than the mark,
 * as touch guidelines ask; a string has one mark, so the areas never overlap. */
const HIT_ALONG = 44
/** Room beyond the low string, for the base fret. */
const BASE = 30
const TITLE = 22
/** Room under the neck for the caption (the capo). */
const CAPTION = 18

/** "Capo 2", "Capo 2, sounds B": what a diagram with a capo says under it. */
export const capoCaption = (capo: number, sounds?: string): string =>
    `Capo ${capo}${sounds ? `, sounds ${sounds}` : ''}`

export function renderGuitarDiagram(
    doc: Document,
    voicing: FrettedVoicing,
    options: GuitarDiagramOptions = {}
): SVGElement {
    const strings = voicing.frets.length
    const base = voicing.baseFret ?? baseFretOf(voicing.frets)
    const fretted = voicing.frets.filter((f): f is number => f !== null && f > 0)
    const rows = Math.max(4, fretted.length ? Math.max(...fretted) - base + 1 : 0)
    const orientation = options.orientation ?? 'vertical'
    const vertical = orientation === 'vertical'
    const capo = options.capo && options.capo > 0 ? options.capo : 0
    // From the nut, the capo sits on its own fret; from the capo, where the nut is drawn.
    const fromNut = capo > 0 && options.fretsFrom === 'nut'
    const capoFret = fromNut ? capo : null
    const caption =
        capo && options.caption !== false ? capoCaption(capo, options.sounds) : undefined
    const layout: NeckLayout = {
        orientation,
        hand: options.hand ?? 'right',
        across: (strings - 1) * SPACING,
        along: rows * ROW,
        before: MARKERS,
        after: 10,
        low: vertical || base > 1 ? BASE : 10,
        high: vertical ? 14 : 10,
        top: 4,
        minWidth: titleWidth(caption)
    }
    // The title never widens the diagram (#74): it wraps onto more lines instead.
    const lines = options.title ? titleLines(options.title, neckFrame(layout).width) : []
    const frame = neckFrame({
        ...layout,
        top: lines.length ? TITLE + (lines.length - 1) * TITLE_LINE : 4
    })
    // Neck coordinates: strings across (lowest first), fret rows along.
    const across = (string: number) => string * SPACING
    const along = (row: number) => row * ROW
    const at = (string: number, row: number) => frame.at(across(string), along(row))

    const label = `${options.title ? `${options.title} chord diagram` : 'Chord diagram'}${capo ? `, ${capoCaption(capo, options.sounds).replace(/^Capo/, 'capo')}` : ''}`
    const height = frame.height + (caption ? CAPTION : 0)
    const root = svgRoot(doc, frame.width, height, 'mn-guitar-chord', label)
    // Its hand, for a redraw that must keep it (#60).
    root.setAttribute('data-mn-hand', options.hand ?? 'right')
    // The frets as written (x02220, x-12-14-14-14-12 past fret 9), for tools that read diagrams.
    const fretText = voicing.frets.map((f) => (f === null ? 'x' : String(f)))
    root.setAttribute(
        'data-mn-voicing',
        fretText.some((f) => f.length > 1) ? fretText.join('-') : fretText.join('')
    )
    if (caption) {
        root.appendChild(
            svgText(doc, caption, {
                'class': 'mn-caption',
                'x': frame.width / 2,
                'y': height - 6,
                'text-anchor': 'middle'
            })
        )
    }
    if (capo) {
        root.setAttribute('data-mn-capo', String(capo))
        root.setAttribute('data-mn-frets-from', fromNut ? 'nut' : 'capo')
    }
    if (lines.length) drawTitle(doc, root, lines, frame.width / 2, 15)

    for (let row = 0; row <= rows; row++) {
        // From the capo, the capo takes the nut's place.
        const cls = row === 0 && base === 1 && (!capo || fromNut) ? 'mn-nut' : 'mn-fret'
        root.appendChild(svgLine(doc, at(0, row), at(strings - 1, row), cls))
    }
    // The capo: a bar across every string, where the nut is drawn (frets from the capo) or on its
    // fret (frets from the nut), when that fret is in view.
    const capoRow = fromNut ? capo - base + 0.5 : base === 1 ? 0 : null
    if (capo && capoRow !== null && capoRow >= 0 && capoRow <= rows) {
        root.appendChild(
            svg(doc, 'rect', {
                class: 'mn-capo',
                ...frame.box(
                    across(0) - 8,
                    along(capoRow) - 3,
                    across(strings - 1) + 8,
                    along(capoRow) + 3
                ),
                rx: 3
            })
        )
    }
    for (let s = 0; s < strings; s++) {
        root.appendChild(svgLine(doc, at(s, 0), at(s, rows), 'mn-string'))
    }
    if (base > 1) {
        // Beyond the low string, level with the first fret: ending next to the neck when
        // vertical, under it when horizontal.
        const label = `${base}fr`
        root.appendChild(
            vertical
                ? svgLabel(
                      doc,
                      label,
                      frame.at(-10, along(0.5)),
                      'mn-base-fret',
                      options.hand === 'left' ? 'start' : 'end'
                  )
                : svgLabel(doc, label, frame.at(-16, along(0.5)), 'mn-base-fret')
        )
    }

    // What each dot says: its finger, or the label asked for.
    const textOf = (s: number) => (options.labels ? options.labels[s] : voicing.fingers[s]) ?? null
    // Strings whose text the barre's one label stands for.
    const quiet = new Set<number>()
    const fingered = voicing.fingers.some((f) => f)
    const barres = fingered
        ? barresOf(voicing, capoFret)
        : options.barreFingers
          ? barresOf({ frets: voicing.frets, fingers: [...options.barreFingers] }, capoFret).filter(
                (b) => b.full
            )
          : []
    for (const barre of barres) {
        const texts = new Set(barre.strings.map(textOf))
        if (texts.size === 1) {
            // One finger number for the whole bar, on its lowest string.
            for (const s of barre.strings) if (s !== barre.from) quiet.add(s)
        } else if (!barre.full) {
            // A small barre's dots labelled differently (a triad's 5 and R) stay apart.
            continue
        }
        // A full barre labelled differently (F 133211 with notes): each dot's label on the bar.
        const middle = along(barre.fret - base + 0.5)
        root.appendChild(
            svg(doc, 'rect', {
                'class': 'mn-barre',
                ...frame.box(across(barre.from) - 7, middle - 7, across(barre.to) + 7, middle + 7),
                'rx': 7,
                // What the bar is, for tools that read diagrams (strings as guitarists count them).
                'data-mn-fret': barre.fret,
                'data-mn-finger': barre.finger,
                'data-mn-from': strings - barre.from,
                'data-mn-to': strings - barre.to
            })
        )
    }

    const tuning = options.tuning ?? (strings === 6 ? STANDARD_TUNING : undefined)
    voicing.frets.forEach((fret, s) => {
        // Open and muted marks sit just before the nut.
        const markAlong = -8
        const mark = frame.at(across(s), markAlong)
        // What each mark is, for tools that read diagrams (strings as guitarists count them).
        const string = strings - s
        if (fret === null) {
            // An x as big and as dark as the open circles.
            const [x, y] = mark
            const d = 3.5
            root.appendChild(
                svg(doc, 'path', {
                    'class': 'mn-muted',
                    'd': `M${x - d} ${y - d}L${x + d} ${y + d}M${x + d} ${y - d}L${x - d} ${y + d}`,
                    'data-mn-string': string
                })
            )
            return
        }
        // From the capo, every string sounds `capo` semitones higher.
        const openString = tuning?.[s]
        const open = openString === undefined ? undefined : openString + (fromNut ? 0 : capo)
        const isRoot =
            options.root !== undefined &&
            options.root !== null &&
            open !== undefined &&
            (open + fret) % 12 === options.root
        const midi = {
            'data-mn-string': string,
            'data-mn-fret': fret,
            ...(open !== undefined ? { 'data-midi': open + fret } : {})
        }
        // A mark that plays (the tuning is known) gets a hit area: its string's lane, centered on it.
        const place = (markAt: number, ...els: Element[]) => {
            if (open === undefined) {
                for (const el of els) root.appendChild(el)
                return
            }
            const area = frame.box(
                across(s) - SPACING / 2,
                markAt - HIT_ALONG / 2,
                across(s) + SPACING / 2,
                markAt + HIT_ALONG / 2
            )
            root.appendChild(playableMark(doc, area, ...els))
        }
        if (fret === 0) {
            const [cx, cy] = mark
            place(
                markAlong,
                svg(doc, 'circle', {
                    class: `mn-open${isRoot ? ' mn-root' : ''}`,
                    cx,
                    cy,
                    r: 4,
                    ...midi
                })
            )
            return
        }
        const row = along(fret - base + 0.5)
        const center = at(s, fret - base + 0.5)
        const [cx, cy] = center
        if (fret === capoFret) {
            // A string the capo plays: a ring on the capo.
            place(
                row,
                svg(doc, 'circle', {
                    class: `mn-capo-open${isRoot ? ' mn-root' : ''}`,
                    cx,
                    cy,
                    r: 4,
                    ...midi
                })
            )
            return
        }
        const text = quiet.has(s) ? null : textOf(s)
        place(
            row,
            svg(doc, 'circle', {
                class: `mn-dot${isRoot ? ' mn-root' : ''}${options.marks?.[s] ? ` mn-${options.marks[s]}` : ''}`,
                cx,
                cy,
                r: 7,
                ...midi
            }),
            ...(text ? [dotLabel(doc, text, center, 7)] : [])
        )
    })
    // What playback plays: the sounding strings, low to high (when the tuning is known).
    if (tuning) {
        const shift = fromNut ? 0 : capo
        const pitches = voicing.frets.flatMap((f, s) =>
            f === null ? [] : [tuning[s]! + shift + f]
        )
        root.setAttribute('data-mn-pitches', pitches.join(' '))
        root.setAttribute('data-mn-play', 'chord')
        root.setAttribute('data-mn-sound', 'guitar')
    }
    return root
}
