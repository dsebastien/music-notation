/** The `caption:` key of diagram blocks (#53, #52). */
import type { BlockSource } from './block-source.js'
import { t } from '../i18n/translate.js'

type Caption = 'fingering' | 'formula'

const NO_CAPTION = ['none', 'no', 'off', 'false']

/**
 * `caption:` (#53, #52): `fingering` writes the fingering in words under the diagram (chord
 * blocks), `formula` the notes and intervals of its chord or scale, both with a list
 * (`fingering, formula`, fingering first); `none` writes nothing.
 */
export function captionsOf(block: BlockSource, fingering = true): Caption[] {
    const written = block.fields.get('caption')?.trim()
    const text = written?.toLowerCase()
    if (!text || NO_CAPTION.includes(text)) return []
    const words = text.split(/[\s,]+/).filter(Boolean)
    const known = words.every((w) => w === 'fingering' || w === 'formula')
    if (known && !fingering && words.includes('fingering')) {
        throw new Error(t('blocks.caption.fingeringChordOnly'))
    }
    if (!known) {
        throw new Error(
            fingering
                ? t('blocks.caption.useAll', { written: written ?? '' })
                : t('blocks.caption.useFormula', { written: written ?? '' })
        )
    }
    return (['fingering', 'formula'] as const).filter((c) => words.includes(c))
}
