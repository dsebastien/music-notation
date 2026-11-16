/**
 * Texts in the language of the drawing in progress (#136). Like note naming (`withNaming`), a draw
 * runs under a language (`withLanguage`) and the parsers and renderers call `t`. Code that runs
 * later (a click, a player's state change) must not read the current language then: it takes a
 * `translator()` when its bar or control is built, and uses that one.
 */
import { languageOf, TABLES, type Language } from './language.js'
import type { MessageKey, MessageParams } from './messages.js'

let current: Language = 'en'

/** The language of the drawing in progress (English outside `withLanguage`). */
export const currentLanguage = (): Language => current

/** Runs `fn` with `language` as the current one; the one before is back after, even on a throw. */
export function withLanguage<T>(language: Language | null | undefined, fn: () => T): T {
    const before = current
    current = language ?? current
    try {
        return fn()
    } finally {
        current = before
    }
}

/** The language an option names, else the one in progress (a standalone call: English). */
export const languageFrom = (value: unknown): Language => languageOf(value) ?? current

function fill(text: string, params: Record<string, string | number> | undefined): string {
    if (!params) return text
    return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in params ? String(params[name]) : whole
    )
}

export type Translator = <K extends MessageKey>(key: K, ...params: MessageParams<K>) => string

/** A translator tied to `language`. A key a language lacks reads as English. */
export function translatorFor(language: Language): Translator {
    return (key, ...params) =>
        fill(
            (TABLES[language] as Partial<Record<MessageKey, string>>)[key] ?? TABLES.en[key],
            params[0]
        )
}

/** A translator tied to the language in progress now: keep it for what runs later. */
export const translator = (): Translator => translatorFor(current)

/** The text of `key` in the language in progress. */
export const t: Translator = (key, ...params) => translatorFor(current)(key, ...params)
