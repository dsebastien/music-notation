/**
 * The English table: the source of every text of the library and the fallback of a missing key
 * in another language. One file per area, merged here; keys are `area.name`, placeholders are
 * `{name}` (an identifier). A literal brace never appears in a table string: what a message
 * tells the user to write goes in as a parameter.
 */
import { enCore } from './core.js'

export const en = {
    ...enCore
} as const
