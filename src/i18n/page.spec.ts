import { describe, expect, it } from 'bun:test'
import { pageLanguage } from './page.js'

const docWith = (lang: string) => ({ documentElement: { lang } }) as unknown as Document

describe('pageLanguage', () => {
    it('reads <html lang> when the page has no option', () => {
        expect(pageLanguage(undefined, docWith('fr'))).toBe('fr')
        expect(pageLanguage({}, docWith('fr-CA'))).toBe('fr')
        expect(pageLanguage(null, docWith('en-GB'))).toBe('en')
    })
    it('is English for a language without a table, or none', () => {
        expect(pageLanguage(undefined, docWith('de'))).toBe('en')
        expect(pageLanguage(undefined, docWith(''))).toBe('en')
    })
    it('lets the page option win over <html lang>', () => {
        expect(pageLanguage({ language: 'en' }, docWith('fr'))).toBe('en')
        expect(pageLanguage({ language: 'FR' }, docWith('en'))).toBe('fr')
    })
    it('skips an invalid option', () => {
        expect(pageLanguage({ language: 'klingon' }, docWith('fr'))).toBe('fr')
        expect(pageLanguage({ language: 3 }, docWith('de'))).toBe('en')
    })
})
