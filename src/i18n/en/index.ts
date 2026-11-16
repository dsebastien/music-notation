/**
 * The English table: the source of every text of the library and the fallback of a missing key
 * in another language. One file per area, merged here; keys are `<dir>.<topic>.<name>`,
 * placeholders are `{name}` (an identifier). A literal brace never appears in a table string:
 * what a message tells the user to write goes in as a parameter.
 */
import { enDiagrams } from './diagrams.js'
import { enParse } from './parse.js'
import { enPlay } from './play.js'
import { enTimed } from './timed.js'

export const en = {
    ...enParse,
    ...enDiagrams,
    ...enTimed,
    ...enPlay
} as const
