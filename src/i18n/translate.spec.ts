import { describe, expect, it } from 'bun:test'
import { languageOf } from './language.js'
import { currentLanguage, t, translator, translatorFor, withLanguage } from './translate.js'

describe('languageOf', () => {
    it('reads French in its usual spellings', () => {
        for (const value of ['fr', 'FR', 'fr-BE', 'fr_CA', ' fr-FR '])
            expect(languageOf(value)).toBe('fr')
    })
    it('reads English, and nothing else', () => {
        expect(languageOf('en-US')).toBe('en')
        for (const value of ['de', '', 'fra', 'french', null, undefined, 3, {}])
            expect(languageOf(value)).toBeNull()
    })
})

describe('t', () => {
    it('is English outside withLanguage', () => {
        expect(currentLanguage()).toBe('en')
        expect(t('core.example')).toBe('Example')
    })
    it('speaks the language of withLanguage, and restores it, even on a throw', () => {
        expect(withLanguage('fr', () => t('core.example'))).toBe('Exemple')
        expect(() =>
            withLanguage('fr', () => {
                throw new Error('x')
            })
        ).toThrow()
        expect(currentLanguage()).toBe('en')
    })
    it('keeps its language in a captured translator', () => {
        const fr = withLanguage('fr', () => translator())
        const en = translator()
        expect(fr('core.example')).toBe('Exemple')
        expect(en('core.example')).toBe('Example')
        expect(translatorFor('fr')('core.example')).toBe('Exemple')
    })
})
