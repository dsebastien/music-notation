import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A text added to the code without a key (#136): the sources are scanned for the places where a
 * user-facing text is written as a literal. A new literal fails here; give it a key in
 * `src/i18n/en/` (and `fr/`), or, when no user ever sees it, add it to `ALLOWED` with the reason.
 */
const ROOT = join(import.meta.dir, '..')
// The command line stays English (#136); the catalog is where the literals live.
const SKIPPED_DIRS = new Set(['i18n', 'cli'])

function sources(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
            if (!SKIPPED_DIRS.has(entry.name)) out.push(...sources(path))
        } else if (
            entry.name.endsWith('.ts') &&
            !/\.(spec|fixture)\.ts$/.test(entry.name) &&
            !entry.name.endsWith('.d.ts')
        )
            out.push(path)
    }
    return out
}

/** Literal user-facing texts: an error message, a label, a title, a text node. */
const PATTERNS: [string, RegExp][] = [
    ['error message', /new Error\(\s*(['"`])/g],
    [
        'accessible name or tooltip',
        /setAttribute\(\s*'(?:aria-label|title|aria-description|aria-valuetext|alt|placeholder)'\s*,\s*(['"`])/g
    ],
    [
        'title or text assignment',
        /\.(?:title|textContent|ariaLabel|ariaDescription)\s*=\s*(['"`])/g
    ],
    [
        'attribute object',
        /['"](?:aria-label|aria-description|aria-valuetext|title)['"]?\s*:\s*(['"`])/g
    ],
    [
        'text given to the html helper',
        /\bhtml\(\s*[\w.]+\s*,\s*'[a-z0-9]+'\s*,\s*(?:'[^']*'|undefined|[\w.]+)\s*,\s*(['"`])/g
    ]
]

/**
 * Sites that are not user-facing: `file: the literal's start`. Each has a reason; keep it short.
 */
const ALLOWED: Record<string, string> = {
    // Developer-facing: API misuse or data a caller handed in, never shown inline to a reader.
    "export/image.ts: 'The element is not in a window'": 'toPng rejection for the caller',
    "export/image.ts: 'The image could not be drawn'": 'toPng rejection for the caller',
    "export/image.ts: 'No canvas to draw the image on'": 'toPng rejection for the caller',
    "export/image.ts: 'The image could not be made'": 'toPng rejection for the caller',
    "picking/play.ts: 'playPicking needs": 'API misuse',
    "strum/play.ts: 'playStrum needs": 'API misuse',
    'playback/progression.ts: `Unknown tuning': 'playProgression API misuse',
    "playback/progression.ts: 'playProgression needs": 'API misuse',
    "playback/progression.ts: `Didn't recognize": 'playProgression API misuse',
    "playback/soundfont.ts: 'Not a": 'soundfont data handed in by the app',
    "tab/index.ts: 'The score is not drawn yet'": 'printTab API misuse',
    'tab/index.ts: "alphaTab isn': 'renderTab API misuse',
    "tab/index.ts: 'The soundfont player is not ready'": 'player API misuse'
}

describe('translations guard', () => {
    it('finds no user-facing literal without a key', () => {
        const found: string[] = []
        for (const file of sources(ROOT)) {
            const text = readFileSync(file, 'utf8')
            const name = file.slice(ROOT.length + 1).replaceAll('\\', '/')
            for (const [what, pattern] of PATTERNS) {
                for (const match of text.matchAll(pattern)) {
                    const start = match.index + match[0].length - 1
                    const literal = text.slice(start, start + 40).split('\n')[0]!
                    // A template with no words of its own (`${a}: ${b}`) holds no text to translate.
                    const words = literal.replace(/\$\{[^}]*\}?/g, '')
                    if (!/[A-Za-z]{2,}/.test(words)) continue
                    const key = `${name}: ${literal}`
                    if (!Object.keys(ALLOWED).some((allowed) => key.startsWith(allowed)))
                        found.push(`${what}: ${key}`)
                }
            }
        }
        expect(found).toEqual([])
    })
})
