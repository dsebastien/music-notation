import { languageOf, type Language } from './language.js'

/**
 * The language of a web page's blocks (#136): `language` of `window.musicNotationOptions` when it
 * names one the library has, else the page's own (`<html lang>`), else English. A value the
 * library has no table for is not an error: the next choice applies.
 */
export function pageLanguage(options: unknown, doc: Document): Language {
    const given =
        options && typeof options === 'object'
            ? languageOf((options as Record<string, unknown>)['language'])
            : null
    return given ?? languageOf(doc.documentElement.lang) ?? 'en'
}
