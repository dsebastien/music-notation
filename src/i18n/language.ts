/**
 * Languages of the library's own texts (#136). A language is a table in `src/i18n/<code>/`:
 * adding one is a new table, one import and one line in `TABLES`.
 */
import { en } from './en/index.js'
import { fr } from './fr/index.js'
import type { MessageKey } from './messages.js'

/** Every table but English is partial in spirit: a missing key reads as English. */
export const TABLES = { en, fr } as const satisfies Record<
    string,
    Partial<Record<MessageKey, string>>
>

export type Language = keyof typeof TABLES
export const LANGUAGES_OF_TEXTS = Object.keys(TABLES) as readonly Language[]

/**
 * A language from an option or a page (`'fr'`, `'fr-BE'`, `'FR'`, `'fr_CA'`): its table, else null
 * for anything the library has no table for (and for what is not text).
 */
export function languageOf(value: unknown): Language | null {
    if (typeof value !== 'string') return null
    const code = value.trim().toLowerCase().split(/[-_]/)[0]!
    return (LANGUAGES_OF_TEXTS as readonly string[]).includes(code) ? (code as Language) : null
}
