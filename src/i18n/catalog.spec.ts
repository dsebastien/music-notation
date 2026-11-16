import { describe, expect, it } from 'bun:test'
import { en } from './en/index.js'
import { fr } from './fr/index.js'
import { LANGUAGES_OF_TEXTS, TABLES } from './language.js'

const PLACEHOLDER = /\{(\w+)\}/g
const placeholders = (text: string) => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]!).sort()

/**
 * French strings that are the same as the English ones because the word is the same in both
 * languages (a name, a unit, a term musicians use as is). Every other French string must differ.
 */
const SAME_IN_BOTH = new Set<string>([
    // Words that are the same in French, or strings made only of placeholders and punctuation.
    'blocks.progression.blues',
    'blocks.fretboard.threeNpsTitle',
    'chord.words.guitarIndex',
    'chord.words.sentence',
    'chords.chart.tempo',
    'chord.shape.power',
    'chord.shape.shell',
    'render.positions.npsTitle',
    'render.fingering.handTitle',
    'strum.count.alternative.next',
    'strum.feel.swing',
    'strum.name.feel',
    'playback.piano',
    'playback.tempo',
    'playback.unit.bpm',
    'playback.unit.ms',
    'playback.copy.bar',
    'tab.player.pause',
    'tab.view.whatTab',
    'tab.tempo.group'
])

describe('catalog', () => {
    it('has the same keys in every language', () => {
        for (const language of LANGUAGES_OF_TEXTS) {
            const table = TABLES[language] as Record<string, string>
            expect(Object.keys(table).sort()).toEqual(Object.keys(en).sort())
        }
    })

    it('keeps every placeholder of an English string in its translation', () => {
        for (const [key, text] of Object.entries(en)) {
            const translated = (fr as Record<string, string>)[key]!
            expect(placeholders(translated), key).toEqual(placeholders(text))
        }
    })

    it('uses braces for placeholders only', () => {
        for (const table of [en, fr] as Record<string, string>[]) {
            for (const [key, text] of Object.entries(table)) {
                expect(text.replace(PLACEHOLDER, ''), key).not.toMatch(/[{}]/)
            }
        }
    })

    it('names its keys <area>.<name>', () => {
        for (const key of Object.keys(en))
            expect(key, key).toMatch(/^[a-z0-9]+(\.[A-Za-z0-9_-]+){1,}$/)
    })

    it('has no empty text', () => {
        for (const table of [en, fr] as Record<string, string>[])
            for (const [key, text] of Object.entries(table)) expect(text.trim(), key).not.toBe('')
    })

    it('translates French for real: a string equal to the English one is on the allow list', () => {
        const copies = Object.keys(en).filter(
            (key) => (fr as Record<string, string>)[key] === (en as Record<string, string>)[key]
        )
        expect(copies.filter((key) => !SAME_IN_BOTH.has(key))).toEqual([])
        // The allow list holds no key that is translated now, or that doesn't exist.
        expect([...SAME_IN_BOTH].filter((key) => !copies.includes(key))).toEqual([])
    })
})
