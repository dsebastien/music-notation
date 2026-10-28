/**
 * Orientation and hand of diagrams, and the frame that maps a neck (guitar diagram, fretboard)
 * to x/y. Renderers place things along the neck and across the strings, never in x/y directly,
 * so text stays upright in every orientation (nothing is rotated or mirrored).
 */

export type Orientation = 'vertical' | 'horizontal'
export type Hand = 'left' | 'right'

/** Defaults used when a block doesn't say (Music Practice settings, a Publish site's options). */
export interface LayoutDefaults {
    /** Per block language; piano chords (`chord` blocks for piano) follow `keyboard`. */
    orientation?: Partial<Record<'chord' | 'keyboard' | 'fretboard', Orientation>>
    /** Left-handed guitar diagrams and fretboards. Keyboards ignore it. */
    hand?: Hand
}

export function parseOrientation(text: string): Orientation {
    const value = text.trim().toLowerCase()
    if (value === 'vertical' || value === 'horizontal') return value
    throw new Error(`Unknown orientation "${text}": use vertical or horizontal`)
}

export function parseHand(text: string): Hand {
    const value = text.trim().toLowerCase()
    if (value === 'left' || value === 'right') return value
    throw new Error(`Unknown hand "${text}": use left or right`)
}

/** Keeps only valid layout defaults from untrusted input (a page's `window.musicNotationOptions`). */
export function layoutDefaults(value: unknown): LayoutDefaults {
    const result: LayoutDefaults = {}
    if (!value || typeof value !== 'object') return result
    const word = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : undefined)
    try {
        const { orientation, hand } = value as Record<string, unknown>
        const h = word(hand)
        if (h === 'left' || h === 'right') result.hand = h
        if (orientation && typeof orientation === 'object') {
            for (const language of ['chord', 'keyboard', 'fretboard'] as const) {
                const o = word((orientation as Record<string, unknown>)[language])
                if (o === 'vertical' || o === 'horizontal')
                    (result.orientation ??= {})[language] = o
            }
        }
    } catch {
        // A page's object with a throwing getter: no defaults rather than no rendering.
    }
    return result
}

/** Width a title needs (14px semi-bold), so a narrow diagram doesn't clip it. Errs on the wide side. */
export function titleWidth(title?: string): number {
    if (!title) return 0
    let width = 8
    for (const ch of title) {
        // Wide scripts (CJK, emoji), capitals and digits, then narrow letters and punctuation.
        width += ch.codePointAt(0)! > 0x24f ? 15 : /[A-Z0-9#♯♭]/.test(ch) ? 10.5 : 8
    }
    return Math.ceil(width)
}

export interface NeckLayout {
    orientation: Orientation
    hand: Hand
    /** Distance from the low string to the high string. */
    across: number
    /** Length of the neck shown, from its start (the nut side) to its end. */
    along: number
    /** Margins: before the start of the neck, after its end, beyond the low and the high string. */
    before: number
    after: number
    low: number
    high: number
    /** Space above everything, for the title. */
    top: number
    /** The diagram is widened (and centered) to at least this width. */
    minWidth?: number
}

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export interface NeckFrame {
    width: number
    height: number
    /** x/y of the point `across` from the low string towards the high one, `along` from the neck's start. */
    at(across: number, along: number): [number, number]
    /** The rectangle between two opposite corners, given in neck coordinates. */
    box(across1: number, along1: number, across2: number, along2: number): Box
}

/**
 * Vertical: the nut on top, the low string on the left (on the right when left-handed), as chord
 * diagrams are drawn. Horizontal: the high string on top, as in tabs, the nut on the left (on the
 * right when left-handed).
 */
export function neckFrame(n: NeckLayout): NeckFrame {
    const vertical = n.orientation === 'vertical'
    const left = n.hand === 'left'
    const content = vertical ? n.low + n.across + n.high : n.before + n.along + n.after
    const shift = n.minWidth && n.minWidth > content ? (n.minWidth - content) / 2 : 0
    const height = n.top + (vertical ? n.before + n.along + n.after : n.high + n.across + n.low)
    const at = (across: number, along: number): [number, number] => {
        if (vertical) {
            const x = left ? n.high + (n.across - across) : n.low + across
            return [shift + x, n.top + n.before + along]
        }
        const x = left ? content - n.before - along : n.before + along
        return [shift + x, n.top + n.high + (n.across - across)]
    }
    const box = (a1: number, l1: number, a2: number, l2: number): Box => {
        const [x1, y1] = at(a1, l1)
        const [x2, y2] = at(a2, l2)
        return {
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1)
        }
    }
    return { width: content + 2 * shift, height, at, box }
}
