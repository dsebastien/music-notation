/**
 * Chord suffixes are written many ways ("Δ7", "M7", "maj7"). One spelling per chord, the one tonal
 * and the voicing data understand, so every spelling the symbol parser accepts also draws.
 */
const CANONICAL = new Map<string, string>([
    ['M', ''],
    ['maj', ''],
    ['min', 'm'],
    ['-', 'm'],
    ['M7', 'maj7'],
    ['Δ', 'maj7'],
    ['Δ7', 'maj7'],
    ['M9', 'maj9'],
    ['Δ9', 'maj9'],
    ['min6', 'm6'],
    ['-6', 'm6'],
    ['min7', 'm7'],
    ['-7', 'm7'],
    ['min9', 'm9'],
    ['-9', 'm9'],
    ['ø', 'm7b5'],
    ['ø7', 'm7b5'],
    ['m7-5', 'm7b5'],
    ['mmaj7', 'mMaj7'],
    ['mM7', 'mMaj7'],
    ['m(maj7)', 'mMaj7'],
    ['-(maj7)', 'mMaj7'],
    ['°', 'dim'],
    ['°7', 'dim7'],
    ['+', 'aug'],
    ['sus', 'sus4'],
    ['add2', 'add9'],
    ['69', '6/9'],
    ['alt', '7alt'],
    // Spellings chord sheets use that tonal knows under another name.
    ['-5', 'Mb5'],
    ['#5', 'aug'],
    ['b5', 'Mb5'],
    ['maj7b5', 'M7b5'],
    ['mmaj9', 'mMaj9'],
    ['m6/9', 'm69'],
    ['m6add9', 'm69'],
    ['sus2sus4', 'sus24']
])

/**
 * A suffix without its parentheses: alterations and additions in whole groups read like the same
 * symbol without them (7(b9) = 7b9, 7(b5,#9) = 7b5#9, m(add9) = madd9). Null when the
 * parentheses or commas don't form such groups (`C,`, `C()`, `C(b9`): that isn't a chord symbol.
 */
export function withoutParentheses(suffix: string): string | null {
    if (!/[(),]/.test(suffix)) return suffix
    // Each group starts with "(", which the text between groups can't contain: linear.
    if (!/^[^(),]*(?:\([^(),]+(?:,[^(),]+)*\)[^(),]*)+$/.test(suffix)) return null
    return suffix.replace(/[(),\s]/g, '')
}

/** The canonical suffix (m(maj7) has its own entry; other parentheses are dropped first). */
export function canonicalSuffix(suffix: string): string {
    const direct = CANONICAL.get(suffix)
    if (direct !== undefined) return direct
    const flat = withoutParentheses(suffix)
    if (flat === null || flat === suffix) return suffix
    return CANONICAL.get(flat) ?? flat
}
