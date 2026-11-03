/**
 * `scales-for: G D Em C` (chords) or `scales-for-notes: C D E G A` on a keyboard or fretboard: the
 * best scale for them, drawn like `scale:` (#42).
 */
import type { BlockSource } from './block-source.js'
import type { DiagramRenderer } from './renderers.js'
import { findScales } from '../theory/find.js'

/** Keys that choose the notes themselves: they can't go with `scales-for`. */
const OWN_NOTES = ['scale', 'chord', 'notes', 'root', 'modes', 'positions']

/** At most this many chords or notes are repeated in the title. */
const TITLE_ITEMS = 6

/** The block with `scales-for` replaced by the best scale and a title naming it. */
export function scalesForBlock(block: BlockSource): BlockSource {
    const chords = block.fields.get('scales-for')?.trim()
    const notes = block.fields.get('scales-for-notes')?.trim()
    if (chords === undefined && notes === undefined) return block
    if (chords !== undefined && notes !== undefined) {
        throw new Error('Use scales-for (chords) or scales-for-notes, not both')
    }
    const key = chords !== undefined ? 'scales-for' : 'scales-for-notes'
    const own = OWN_NOTES.find((k) => block.fields.has(k))
    if (own || block.head) {
        throw new Error(`${key} finds the scale itself: remove "${own ?? block.head}"`)
    }
    const text = (chords ?? notes)!
    const items = text.split(/[\s,|]+/).filter(Boolean)
    if (!items.length) {
        throw new Error(
            chords !== undefined
                ? 'Add the chords: e.g. scales-for: G D Em C'
                : 'Add the notes: e.g. scales-for-notes: C D E G A'
        )
    }
    const [best] = findScales(items, { as: chords !== undefined ? 'chords' : 'notes' })
    if (!best) {
        // No match at all means an item didn't read (a near match always exists for real notes).
        throw new Error(
            chords !== undefined
                ? `Didn't read the chords "${text}": use chord symbols, e.g. scales-for: G D Em C`
                : `Didn't read the notes "${text}": use note names, e.g. scales-for-notes: C D E G A`
        )
    }
    const listed = items.slice(0, TITLE_ITEMS).join(' ') + (items.length > TITLE_ITEMS ? '…' : '')
    const outside = best.outside.length ? `, ${best.outside.join(' ')} outside` : ''
    const fields = new Map([...block.fields].filter(([k]) => k !== key))
    fields.set('scale', best.name)
    if (!fields.get('title')) fields.set('title', `${best.name} for ${listed}${outside}`)
    return { head: null, fields }
}

/** A keyboard or fretboard renderer that also reads `scales-for`. */
export const withScalesFor =
    (render: DiagramRenderer): DiagramRenderer =>
    (doc, block, options) =>
        render(doc, scalesForBlock(block), options)
