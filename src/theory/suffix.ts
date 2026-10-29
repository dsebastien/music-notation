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
    ['alt', '7alt']
])

export const canonicalSuffix = (suffix: string): string => CANONICAL.get(suffix) ?? suffix
