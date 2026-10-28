/**
 * Block sources: `key: value` lines, with an optional first line that has no key (the shorthand:
 * "A x02220 x01230"). Keys are case-insensitive; the last value wins.
 */

export interface BlockSource {
    /** The first line when it has no `key:`; null otherwise. */
    head: string | null
    fields: Map<string, string>
}

const FIELD = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/

export function parseBlockSource(source: string): BlockSource {
    const fields = new Map<string, string>()
    let head: string | null = null
    source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line, i) => {
            const m = FIELD.exec(line)
            if (m) fields.set(m[1]!.toLowerCase(), m[2]!.trim())
            else if (i === 0) head = line
            else throw new Error(`Expected "key: value", got "${line}"`)
        })
    return { head, fields }
}

/** "5-8", "5", "0 - 12" → [from, to]; null when invalid. */
export function parseRange(text: string): [number, number] | null {
    const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(text.trim())
    if (!m) return null
    const from = Number(m[1])
    const to = m[2] === undefined ? from : Number(m[2])
    return from <= to ? [from, to] : null
}
