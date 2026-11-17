/**
 * Which guitar plays the diagrams (#103): a steel-string acoustic (the default), a nylon-string
 * classical guitar, a clean electric or an overdriven electric. The reader's side chooses (a
 * page's or an app's `guitar`); a block may say `guitar:`. It changes the guitar sound only: a
 * piano stays a piano, and tabs and scores keep the instruments their tracks name.
 */

import { t } from '../i18n/translate.js'

/** The guitars, the default first. */
export const GUITAR_TONES = ['steel', 'nylon', 'clean', 'overdrive'] as const
export type GuitarTone = (typeof GUITAR_TONES)[number]

export const DEFAULT_GUITAR_TONE: GuitarTone = 'steel'

/** The General MIDI program of each guitar, for the players that play a soundfont. */
export const GUITAR_PROGRAMS: Readonly<Record<GuitarTone, number>> = {
    steel: 25,
    nylon: 24,
    clean: 27,
    overdrive: 29
}

/** Other words people write for a guitar. */
const ALIASES: Readonly<Record<string, GuitarTone>> = {
    'acoustic': 'steel',
    'steel-string': 'steel',
    'classical': 'nylon',
    'nylon-string': 'nylon',
    'electric': 'clean',
    'overdriven': 'overdrive'
}

/** A guitar's name from a page option, a setting or a block line; null when it isn't one. */
export function guitarToneOf(value: unknown): GuitarTone | null {
    if (typeof value !== 'string') return null
    const name = value.trim().toLowerCase().replace(/\s+/g, '-')
    return GUITAR_TONES.find((tone) => tone === name) ?? ALIASES[name] ?? null
}

const LINE = /^[ \t]*guitar[ \t]*:[ \t]*(.*?)[ \t]*(?:\r?\n|$)/gim
/** In a ChordPro chart a line without braces is lyrics: the guitar is a directive there. */
const DIRECTIVE = /^[ \t]*\{[ \t]*guitar[ \t]*:[ \t]*(.*?)[ \t]*\}[ \t]*(?:\r?\n|$)/gim

/**
 * A block's `guitar:` line (the last one wins; `{guitar: …}` in a ChordPro chart), taken out of
 * its source so that no block parser has to know it. Throws a message for the user when the value
 * isn't a guitar.
 */
export function blockGuitar(
    source: string,
    chart = false
): { guitar: GuitarTone | null; source: string } {
    let guitar: GuitarTone | null = null
    const rest = source.replace(chart ? DIRECTIVE : LINE, (_line: string, value: string) => {
        const read = guitarToneOf(value)
        if (!read) {
            throw new Error(t('playback.guitar.invalid', { value }))
        }
        guitar = read
        return ''
    })
    return { guitar, source: rest }
}

/** The guitar of the block an element is in (`data-mn-guitar`, set from its `guitar:` line). */
export function guitarWish(el: Element | null | undefined): GuitarTone | null {
    return guitarToneOf(el?.closest('[data-mn-guitar]')?.getAttribute('data-mn-guitar'))
}

/** A page's guitar (`play: { guitar }` in `window.musicNotationOptions`), when it names one. */
export function pageGuitar(options: unknown): GuitarTone | undefined {
    if (!options || typeof options !== 'object' || !('play' in options)) return undefined
    const play: unknown = options.play
    if (!play || typeof play !== 'object' || !('guitar' in play)) return undefined
    return guitarToneOf(play.guitar) ?? undefined
}
