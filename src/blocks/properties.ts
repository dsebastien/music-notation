/**
 * Blocks from a note's properties: an empty ```chord block in a chord note, or ```fretboard /
 * ```keyboard in a scale note, draws what the note's frontmatter says, so the body repeats nothing.
 * Used by Music Practice in Obsidian and by the Publish bundle with the page's properties.
 */

/** Property names, as Music Practice and the Obsidian Starter Kit write them by default. */
export interface PropertyNames {
    chordSymbol: string
    frets: string
    fingers: string
    /** First fret shown (guitar); 0 or empty means computed. */
    position: string
    pitches: string
    fingering: string
    scaleRoot: string
    scaleType: string
    /** Chord or scale shape ("Open", "Box 2", "CAGED E", "3NPS"). */
    shape: string
    fingeringRight: string
    tags: string
}

export const DEFAULT_PROPERTY_NAMES: PropertyNames = {
    chordSymbol: 'chord_symbol',
    frets: 'frets',
    fingers: 'fingers',
    position: 'position',
    pitches: 'pitches',
    fingering: 'fingering',
    scaleRoot: 'scale_root',
    scaleType: 'scale_type',
    shape: 'shape',
    fingeringRight: 'fingering_rh',
    tags: 'tags'
}

export type Instrument = 'guitar' | 'piano'

type Properties = Record<string, unknown>

/** A property as one line of text: lists joined, line breaks removed (a value is never two keys). */
function text(properties: Properties, name: string): string | undefined {
    const value = properties[name]
    const out = Array.isArray(value)
        ? value.filter((v) => v !== null && v !== undefined).join(' ')
        : typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : undefined
    const line = out?.replace(/[\r\n]+/g, ' ').trim()
    return line ? line : undefined
}

/** Piano when a tag has a `piano` segment (`type/music/piano/chord`), else guitar. */
export function instrumentOf(properties: Properties, names: PropertyNames): Instrument {
    const tags = properties[names.tags]
    const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[\s,]+/) : []
    return list.some((t) => typeof t === 'string' && /(^|\/)piano(\/|$)/i.test(t.replace(/^#/, '')))
        ? 'piano'
        : 'guitar'
}

/** "Box 2" → position 2, "CAGED E" → shape E, "3NPS" → 3nps; chord shapes ("Open") say nothing. */
function scaleShape(shape: string | undefined): string[] {
    if (!shape) return []
    const box = /^box\s*(\d+)$/i.exec(shape)
    if (box) return [`position: ${box[1]}`]
    const caged = /^caged\s*([CAGED])$/i.exec(shape)
    if (caged) return [`shape: ${caged[1]!.toUpperCase()}`]
    if (/^3\s*nps$/i.test(shape)) return ['shape: 3nps']
    return []
}

/**
 * The source of a block drawn from a note's properties; null when they don't describe one (a chord
 * block in a scale note, a chord note with no chord yet).
 */
export function blockFromProperties(
    language: string,
    properties: Properties,
    options: { names?: Partial<PropertyNames>; instrument?: Instrument } = {}
): string | null {
    const names = { ...DEFAULT_PROPERTY_NAMES, ...options.names }
    const instrument = options.instrument ?? instrumentOf(properties, names)
    const get = (name: string) => text(properties, name)
    const lines: string[] = []
    if (language === 'chord') {
        const symbol = get(names.chordSymbol)
        if (symbol) lines.push(`symbol: ${symbol}`)
        if (instrument === 'piano') {
            const pitches = get(names.pitches)
            if (!symbol && !pitches) return null
            lines.push('instrument: piano')
            if (pitches) lines.push(`pitches: ${pitches}`)
            const fingering = get(names.fingering)
            if (fingering) lines.push(`fingering: ${fingering}`)
            return lines.join('\n')
        }
        const frets = get(names.frets)
        if (!symbol && !frets) return null
        if (frets) lines.push(`frets: ${frets}`)
        const fingers = get(names.fingers)
        if (fingers && frets) lines.push(`fingers: ${fingers}`)
        const position = Number(get(names.position))
        if (frets && Number.isInteger(position) && position >= 1)
            lines.push(`position: ${position}`)
        return lines.join('\n')
    }
    if (language === 'fretboard' || language === 'keyboard') {
        const root = get(names.scaleRoot)
        const type = get(names.scaleType)
        if (!root || !type) return null
        lines.push(`scale: ${root} ${type}`)
        if (language === 'fretboard') lines.push(...scaleShape(get(names.shape)))
        else {
            const fingering = get(names.fingeringRight)
            if (fingering) lines.push(`fingering: ${fingering}`)
        }
        return lines.join('\n')
    }
    return null
}
