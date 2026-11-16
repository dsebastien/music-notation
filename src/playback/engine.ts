/**
 * Which engine plays the notes (#124): GeneralUser GS samples, alphaTab's small sonivox bank, or
 * the light synthesizer. The reader's side chooses (a page's or an app's `engine`); a block may
 * say `engine:` as a wish. A wish is never a demand: when the host can't give an engine, the next
 * one of the fallback order plays, and the light synthesizer is always there for diagrams.
 */

export type Engine = 'generaluser' | 'sonivox' | 'light'

/** The fallback order, always: the best sound the host has. */
export const ENGINES: readonly Engine[] = ['generaluser', 'sonivox', 'light']

/** An engine's name from a page option, a setting or a block line; null when it isn't one. */
export function engineOf(value: unknown): Engine | null {
    if (typeof value !== 'string') return null
    const name = value.trim().toLowerCase()
    return (ENGINES as readonly string[]).includes(name) ? (name as Engine) : null
}

/** The engines to try, in order: the wish first, then the fallback order. */
export function engineOrder(wish?: Engine | null): Engine[] {
    return wish ? [wish, ...ENGINES.filter((engine) => engine !== wish)] : [...ENGINES]
}

/**
 * The first engine of the order that the host has: `has` says so for each one (and may return
 * what plays it). Null when it has none of them.
 */
export function chooseEngine<T>(
    wish: Engine | null | undefined,
    has: (engine: Engine) => T | null | undefined | false
): { engine: Engine; value: T } | null {
    for (const engine of engineOrder(wish)) {
        const value = has(engine)
        if (value !== null && value !== undefined && value !== false) return { engine, value }
    }
    return null
}

const LINE = /^[ \t]*engine[ \t]*:[ \t]*(.*?)[ \t]*(?:\r?\n|$)/gim
/** In a ChordPro chart a line without braces is lyrics: the wish is a directive there. */
const DIRECTIVE = /^[ \t]*\{[ \t]*engine[ \t]*:[ \t]*(.*?)[ \t]*\}[ \t]*(?:\r?\n|$)/gim

/**
 * A block's `engine:` line (the last one wins; `{engine: …}` in a ChordPro chart), taken out of
 * its source so that no block parser has to know it. Throws a message for the user when the value
 * isn't an engine.
 */
export function blockEngine(
    source: string,
    chart = false
): { engine: Engine | null; source: string } {
    let engine: Engine | null = null
    const rest = source.replace(chart ? DIRECTIVE : LINE, (_line: string, value: string) => {
        const read = engineOf(value)
        if (!read) {
            throw new Error(`engine: use generaluser, sonivox or light, got "${value}"`)
        }
        engine = read
        return ''
    })
    return { engine, source: rest }
}

/** The wish of the block an element is in (`data-mn-engine`, set from its `engine:` line). */
export function engineWish(el: Element | null | undefined): Engine | null {
    return engineOf(el?.closest('[data-mn-engine]')?.getAttribute('data-mn-engine'))
}

/** A page's engine (`play: { engine }` in `window.musicNotationOptions`), when it names one. */
export function pageEngine(options: unknown): Engine | undefined {
    if (!options || typeof options !== 'object' || !('play' in options)) return undefined
    const play: unknown = options.play
    if (!play || typeof play !== 'object' || !('engine' in play)) return undefined
    return engineOf(play.engine) ?? undefined
}
