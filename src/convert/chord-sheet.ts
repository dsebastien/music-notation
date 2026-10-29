/**
 * Chord sheets (chords on their own line above the lyrics, as found on the web) → ChordPro, so
 * they draw as ```chords blocks and transpose (#25).
 */
import { parseChord } from '../theory/chord-symbol.js'

/** A line of chord symbols only ("G   D/F#   Em"), with each chord's column. */
function chordsOf(line: string): { chord: string; at: number }[] | null {
    const found: { chord: string; at: number }[] = []
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
        // Bar lines, repeat marks (|: :| %), counts (2x, x2) and "no chord" between chords.
        if (/^(\|:?|:?\||:|%|\/|-|\(?\d+x\)?|\(?x\d+\)?|n\.?c\.?)$/i.test(m[0])) continue
        if (!parseChord(m[0])) return null
        found.push({ chord: m[0], at: m.index })
    }
    return found.length ? found : null
}

/** "[Verse 1]", "Chorus:", "Bridge" on its own line → the section's name. */
function sectionOf(line: string): string | null {
    const m =
        /^\s*\[?\s*((?:intro|verse|pre-?chorus|chorus|bridge|solo|outro|interlude|refrain|coda)(?:\s*\d+)?)\s*\]?\s*:?\s*$/i.exec(
            line
        )
    return m ? m[1]!.trim() : null
}

/** A lyric line, its own brackets made round: in ChordPro, [x] is a chord. */
const lyricsOf = (line: string) => line.trimEnd().replace(/\[/g, '(').replace(/\]/g, ')')

/** ChordPro for a chord sheet: chords placed into the lyrics at their column. */
export function chordSheetToChordPro(text: string): string {
    const lines = text.replace(/\t/g, '    ').split(/\r?\n/)
    const out: string[] = []
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        const section = sectionOf(line)
        if (section) {
            out.push(`{comment: ${section}}`)
            continue
        }
        // "Intro: G D Em C": a section with its chords.
        const labelled = /^\s*([A-Za-z][\w -]{0,20}):\s+(\S.*)$/.exec(line)
        const labelledChords = labelled ? chordsOf(labelled[2]!) : null
        if (labelled && labelledChords) {
            out.push(`{comment: ${labelled[1]!.trim()}}`)
            out.push(labelledChords.map((c) => `[${c.chord}]`).join(' '))
            continue
        }
        const chords = chordsOf(line)
        if (!chords) {
            out.push(lyricsOf(line))
            continue
        }
        const next = lines[i + 1]
        const lyrics = next !== undefined && next.trim() && !chordsOf(next) && !sectionOf(next)
        if (!lyrics) {
            // Chords without lyrics (an intro, a riff): one after the other.
            out.push(chords.map((c) => `[${c.chord}]`).join(' '))
            continue
        }
        let merged = lyricsOf(next)
        const width = Math.max(merged.length, chords[chords.length - 1]!.at)
        merged = merged.padEnd(width, ' ')
        // From the last chord back, so earlier columns stay where they are.
        for (const c of [...chords].reverse()) {
            merged = `${merged.slice(0, c.at)}[${c.chord}]${merged.slice(c.at)}`
        }
        out.push(merged.trimEnd())
        i++
    }
    return out
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}
