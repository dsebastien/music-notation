/** Small helpers for the sentences that describe fingerings and transitions (#136). */
import { t } from '../i18n/translate.js'

/** "1st", "2nd", "11th" (French: "1re", "2e"). */
export function ordinal(n: number): string {
    if (n === 1) return t('chord.words.ordinalFirst')
    const key =
        n % 100 >= 11 && n % 100 <= 13
            ? 'chord.words.ordinalTh'
            : ((
                  [
                      'chord.words.ordinalTh',
                      'chord.words.ordinalSt',
                      'chord.words.ordinalNd',
                      'chord.words.ordinalRd'
                  ] as const
              )[n % 10] ?? 'chord.words.ordinalTh')
    return t(key, { n })
}

/** "A", "C and E", "A, D and G". */
export function andList(items: readonly string[]): string {
    if (items.length < 2) return items[0] ?? ''
    return t('chord.words.listAnd', { head: items.slice(0, -1).join(', '), last: items.at(-1)! })
}
