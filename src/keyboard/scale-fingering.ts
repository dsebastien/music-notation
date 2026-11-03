/**
 * Piano scale fingerings (#68): the standard method-book fingerings of the major and harmonic
 * minor scales for each hand, and fingers for every octave of a keyboard.
 *
 * A fingering is written for one octave going up, root to root (8 fingers for a 7-note scale).
 * Over several octaves the pattern repeats and the root where two octaves meet takes the thumb
 * (the finger the pattern gives the root on its thumb side): the right hand's C major is
 * 1 2 3 1 2 3 4 | 1 2 3 1 2 3 4 | 5, the left hand's 5 4 3 2 1 3 2 | 1 4 3 2 1 3 2 | 1. Only the
 * lowest and highest roots take the octave's first and last fingers.
 */

export type ScaleHand = 'right' | 'left'

/** Fingers from the root up to the root above, by the tonic's pitch class (C = 0). */
type Table = Record<number, string>

/** Major scales: right hand, then left hand (enharmonic keys share their fingering). */
const MAJOR: Record<ScaleHand, Table> = {
    right: {
        0: '12312345', // C
        1: '23123412', // Db / C#
        2: '12312345', // D
        3: '31234123', // Eb
        4: '12312345', // E
        5: '12341234', // F
        6: '23412312', // F# / Gb
        7: '12312345', // G
        8: '34123123', // Ab
        9: '12312345', // A
        10: '41231234', // Bb
        11: '12312345' // B / Cb
    },
    left: {
        0: '54321321',
        1: '32143213',
        2: '54321321',
        3: '32143213',
        4: '54321321',
        5: '54321321',
        6: '43213214',
        7: '54321321',
        8: '32143213',
        9: '54321321',
        10: '32143213',
        11: '43214321'
    }
}

/** Harmonic minor scales: right hand, then left hand. */
const HARMONIC_MINOR: Record<ScaleHand, Table> = {
    right: {
        0: '12312345', // C
        1: '34123123', // C#
        2: '12312345', // D
        3: '31234123', // D# / Eb
        4: '12312345', // E
        5: '12341234', // F
        6: '34123123', // F#
        7: '12312345', // G
        8: '34123123', // G# / Ab
        9: '12312345', // A
        10: '41231234', // Bb / A#
        11: '12312345' // B
    },
    left: {
        0: '54321321',
        1: '32143213',
        2: '54321321',
        3: '21432132',
        4: '54321321',
        5: '54321321',
        6: '43213214',
        7: '54321321',
        8: '32143213',
        9: '54321321',
        10: '21321432',
        11: '43214321'
    }
}

/** The scale types with standard fingerings, as tonal names them. */
export const FINGERED_SCALES = ['major', 'harmonic minor'] as const

/**
 * The standard fingering of a major or harmonic minor scale for one octave going up, root to root
 * ("1 2 3 1 2 3 4 5" as 8 fingers); null for another scale.
 */
export function standardScaleFingering(
    tonic: number,
    type: string,
    hand: ScaleHand
): string[] | null {
    const table = type === 'major' ? MAJOR : type === 'harmonic minor' ? HARMONIC_MINOR : null
    const fingers = table?.[hand][((tonic % 12) + 12) % 12]
    return fingers ? [...fingers] : null
}

/**
 * Fingers for every key of a scale in a stretch of the keyboard (`pitches`, low to high), from a
 * one-octave fingering (`octave`: one finger per scale note going up from the root, and the root
 * above). Each note takes its degree's finger; a root takes the thumb where two octaves meet, the
 * octave's first finger when it is the lowest key and its last when it is the highest.
 */
export function scaleFingers(
    pitches: readonly number[],
    root: number,
    chromas: readonly number[],
    octave: readonly string[]
): Map<number, string> {
    // The scale's notes going up from the root, by pitch class.
    const order = [...new Set(chromas.map((c) => (((c - root) % 12) + 12) % 12))].sort(
        (a, b) => a - b
    )
    const first = octave[0]!
    const last = octave[octave.length - 1]!
    // The root between two octaves: the thumb when one end has it, else the first finger.
    const junction = first === last ? first : last === '1' ? last : first
    const sorted = [...pitches].sort((a, b) => a - b)
    const fingers = new Map<number, string>()
    sorted.forEach((pitch, i) => {
        const degree = order.indexOf((((pitch - root) % 12) + 12) % 12)
        if (degree < 0) return
        if (degree > 0) fingers.set(pitch, octave[degree]!)
        else if (i === 0) fingers.set(pitch, first)
        else if (i === sorted.length - 1) fingers.set(pitch, last)
        else fingers.set(pitch, junction)
    })
    return fingers
}

/** A finger list as written ("1 2 3", "5-3-1"): each finger 1 (thumb) to 5; throws otherwise. */
export function parseFingerList(text: string): string[] {
    const fingers = text.split(/[\s,-]+/).filter(Boolean)
    const wrong = fingers.find((f) => !/^[1-5]$/.test(f))
    if (wrong !== undefined) {
        throw new Error(`fingering: fingers go from 1 (thumb) to 5 (little finger), got "${wrong}"`)
    }
    return fingers
}

/**
 * `fingering: auto` and its hands: "auto", "auto left", "left hand", "right"… The hand, or null
 * when the value is a list of fingers.
 */
export function autoFingeringHand(text: string): ScaleHand | null {
    const m = /^(auto)?[\s:(,-]*(?:(left|right)(?:[\s-]*hand)?)?\)?$/.exec(
        text.trim().toLowerCase()
    )
    if (!m || (!m[1] && !m[2])) return null
    return (m[2] as ScaleHand | undefined) ?? 'right'
}
