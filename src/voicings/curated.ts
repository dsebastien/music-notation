/**
 * The standard shapes guitar teachers expect first (#62), ahead of the database's voicings. Keys
 * are chord symbols with canonical suffixes, the lookup's root names (C C# D Eb E F F# G Ab A Bb B) and
 * the database's bass names (C# D# F# G# Bb): "Cmaj7", "Am/G", "E/G#", "C#7alt";
 * values are frets, lowest string first ("x32000", "x-9-8-9-10-x" past fret 9), each optionally
 * followed by its fingers ("xx0211 ---211", "-" for none); without fingers, the generator's
 * fingering. Every entry must pass the same checks as the database (voicings.spec.ts). Our own data
 * (MIT), not taken from chords-db.
 */

/** The Hendrix grip (R 3 b7 #9 on the A string), and the open E's. */
const HENDRIX: Record<string, string[]> = {
    'C': ['x3234x'],
    'C#': ['x4345x'],
    'D': ['x5456x'],
    'Eb': ['x6567x'],
    'E': ['x7678x', '076780'],
    'F': ['x8789x'],
    'F#': ['x-9-8-9-10-x'],
    'G': ['x-10-9-10-11-x'],
    'Ab': ['x-11-10-11-12-x'],
    'A': ['x-12-11-12-13-x'],
    'Bb': ['x1012x'],
    'B': ['x2123x']
}

/** Power chords: root, fifth and octave on the low strings, fingered 1 3 4. */
const POWER: Record<string, string> = {
    'C': 'x355xx -134--',
    'C#': 'x466xx -134--',
    'D': 'xx023x ---13-',
    'Eb': 'x688xx -134--',
    'E': '022xxx -12---',
    'F': '133xxx 134---',
    'F#': '244xxx 134---',
    'G': '355xxx 134---',
    'Ab': '466xxx 134---',
    'A': 'x022xx --12--',
    'Bb': 'x133xx -134--',
    'B': 'x244xx -134--'
}

export const CURATED: Record<string, readonly string[]> = {
    // Barre chords rather than partial or awkward shapes.
    'C#': ['x46664'],
    'Eb': ['x68886', 'xx1343'],
    'Ab': ['466544'],
    'Cm': ['x35543'],
    'C#m': ['x46654'],
    'Ebm': ['x68876'],
    'Gm': ['355333'],
    'C#7': ['x46464'],
    'Eb7': ['x68686'],
    'Cm7': ['x35343'],
    'Ebm7': ['x68676'],
    'C#maj7': ['x46564'],
    'C#sus4': ['x46674'],
    'B6': ['x24444'],
    'Eb9': ['x65666'],
    'G9': ['353435'],
    // The open shapes, fingered as taught.
    'Cmaj7': ['x32000 -32---'],
    'Dm7': ['xx0211 ---211'],
    'A9': ['x02423', '575657'],
    'Fsus2': ['xx3011'],
    // The D shape moved up.
    'F#sus2': ['xx4674'],
    'Absus2': ['xx6896'],
    'Ddim': ['xx0131'],
    'Ebdim': ['xx1242'],
    'Edim': ['xx2353'],
    'Fdim': ['xx3464'],
    'Gm7b5': ['3x332x'],
    'C#aug': ['x4322x'],
    // Walking bass lines.
    'Am/G': ['3x2210', '302210'],
    'E/G#': ['422100'],
    ...Object.fromEntries(Object.entries(HENDRIX).map(([root, list]) => [`${root}7#9`, list])),
    ...Object.fromEntries(Object.entries(HENDRIX).map(([root, list]) => [`${root}7alt`, list])),
    ...Object.fromEntries(Object.entries(POWER).map(([root, shape]) => [`${root}5`, [shape]]))
}
