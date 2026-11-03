import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseHTML } from 'linkedom'
import { checkNote, expand, globToRegExp, run, type BlockReport } from './check.js'
import { renderBlock } from '../render/render-block.js'
import type {
    ChartDiagram,
    FretboardDiagram,
    GuitarChordDiagram,
    KeyboardDiagram
} from './describe.js'

const FIXTURE = join(import.meta.dir, 'fixtures', 'notes.md')
let fixture = ''
let dir = ''

beforeAll(async () => {
    fixture = await readFile(FIXTURE, 'utf8')
    dir = await mkdtemp(join(tmpdir(), 'mn-check-'))
    await mkdir(join(dir, 'notes', 'deep'), { recursive: true })
    await writeFile(join(dir, 'notes', 'good.md'), '```chord\nAm\n```\n')
    await writeFile(join(dir, 'notes', 'deep', 'bad.md'), 'Text\n\n```keyboard\nH major\n```\n')
    await writeFile(join(dir, 'notes', 'deep', 'other.txt'), '```chord\nHm7\n```\n')
    await writeFile(join(dir, 'crlf.md'), fixture.replace(/\n/g, '\r\n'))
    await writeFile(join(dir, 'Song {live}.md'), '```chord\nAm\n```\n')
    await writeFile(join(dir, 'Draft [1].md'), '```chord\nAm\n```\n')
})
afterAll(() => rm(dir, { recursive: true, force: true }))

const statuses = (reports: BlockReport[]) =>
    reports.map((r) => [r.line, r.language, r.status, r.message])

const EXPECTED = [
    [11, 'chord', 'ok', null],
    [17, 'chord', 'error', `Didn't recognize "Hm7": try A, Am, A7 or A Major`],
    [23, 'fretboard', 'ok', null],
    [32, 'keyboard', 'ok', null],
    [39, 'chord', 'error', 'diagram 2: "x" has 1 fingers for 6 strings'],
    [47, 'chord', 'skipped', "empty block: draws from the note's properties, not checked"],
    [52, 'chords', 'ok', null],
    [59, 'tab', 'error', 'staves: use tab, score or both, got "guitar"']
]

/** Runs the command line and collects what it prints. */
async function cli(args: string[], doc: Document = document) {
    const out: string[] = []
    const err: string[] = []
    const code = await run(args, {
        cwd: dir,
        out: (l) => out.push(l),
        err: (l) => err.push(l),
        doc,
        version: '1.2.3'
    })
    return { code, out: out.join('\n'), err: err.join('\n') }
}

describe('checkNote', () => {
    test('renders every notation block and reports it at its fence line', () => {
        expect(statuses(checkNote('notes.md', fixture, document))).toEqual(EXPECTED)
    })

    test('a CRLF note gives the same reports', () => {
        const crlf = fixture.replace(/\n/g, '\r\n')
        expect(statuses(checkNote('notes.md', crlf, document))).toEqual(EXPECTED)
    })

    test('linkedom (the command line DOM) draws what happy-dom draws', () => {
        const { document: linked } = parseHTML('<html><body></body></html>')
        expect(checkNote('notes.md', fixture, linked as unknown as Document)).toEqual(
            checkNote('notes.md', fixture, document)
        )
    })

    test('an empty block in a note without properties draws nothing; an empty chart too', () => {
        const reports = checkNote('a.md', '```chord\n```\n\n```chords\n\n```', document)
        expect(statuses(reports)).toEqual([
            [1, 'chord', 'empty', 'empty block: draws nothing'],
            [4, 'chords', 'empty', 'empty block: draws nothing']
        ])
    })

    test('a tab with valid settings is skipped: alphaTex needs alphaTab', () => {
        const [report] = checkNote('a.md', '```score\nstaves: both\n:4 0.6\n```', document)
        expect(report?.status).toBe('skipped')
    })

    test('other languages are not checked', () => {
        expect(checkNote('a.md', '```js\nx\n```\n```Chord\nHm7\n```', document)).toEqual([])
    })
})

describe('what blocks draw', () => {
    const reports = () => checkNote('notes.md', fixture, document)

    test('a guitar chord: title, chord, frets, and each string', () => {
        const chord = reports()[0]!.diagrams[0] as GuitarChordDiagram
        expect(chord).toMatchObject({
            type: 'guitar-chord',
            title: 'Am',
            chord: 'Am',
            frets: 'x02210',
            fretRange: [1, 4]
        })
        expect(chord.strings.map((s) => [s.string, s.fret, s.note, s.label, s.root])).toEqual([
            [6, null, null, null, false],
            [5, 0, 'A2', null, true],
            [4, 2, 'E3', '2', false],
            [3, 2, 'A3', '3', true],
            [2, 1, 'C4', '1', false],
            [1, 0, 'E4', null, false]
        ])
    })

    test('a fretboard: the scale, the frets shown, each dot', () => {
        const board = reports()[2]!.diagrams[0] as FretboardDiagram
        expect(board).toMatchObject({
            title: 'Box 1',
            notes: 'A minor pentatonic',
            fretRange: [5, 8],
            tuning: ['E', 'A', 'D', 'G', 'B', 'E']
        })
        expect(board.dots.slice(0, 3)).toEqual([
            { string: 6, fret: 5, note: 'A2', label: 'R', root: true, marks: [] },
            { string: 6, fret: 8, note: 'C3', label: 'b3', root: false, marks: [] },
            { string: 5, fret: 5, note: 'D3', label: '4', root: false, marks: [] }
        ])
        expect(board.dots).toHaveLength(12)
    })

    test('a keyboard: the range and the keys drawn', () => {
        const keys = reports()[3]!.diagrams[0] as KeyboardDiagram
        expect(keys.keyRange).toEqual(['C4', 'C5'])
        expect(keys.keys.map((k) => k.note)).toEqual([
            'C4',
            'D4',
            'E4',
            'F4',
            'G4',
            'A4',
            'B4',
            'C5'
        ])
    })

    test('a row with a mistake: the diagrams that draw, and the one that failed', () => {
        const row = reports()[4]!.diagrams
        expect(row.map((d) => d.type)).toEqual(['guitar-chord', 'error'])
        expect(row[1]).toEqual({
            type: 'error',
            message: 'diagram 2: "x" has 1 fingers for 6 strings'
        })
    })

    test('a chart: its title and chords', () => {
        const chart = reports()[6]!.diagrams[0] as ChartDiagram
        expect(chart).toEqual({ type: 'chart', title: 'Song', chords: ['G', 'D'], sections: [] })
    })

    test('piano chords, spelled notes with octaves, fingers and the chord name', () => {
        const [report] = checkNote(
            'a.md',
            '```chord\nsymbol: Bb/D\ninstrument: piano\nfingering: 1 2 4\n```',
            document
        )
        const piano = report!.diagrams[0] as KeyboardDiagram
        expect(piano.chord).toBe('Bb/D')
        expect(piano.keys.map((k) => [k.note, k.label, k.root])).toEqual([
            ['D3', '1', false],
            ['Bb4', '2', true],
            ['D5', '4', false],
            ['F5', null, false]
        ])
    })

    test('a high chord shows its frets; flats follow the chord', () => {
        const [high] = checkNote('a.md', '```chord\nBbm x13321\nposition: 1\n```', document)
        const chord = high!.diagrams[0] as GuitarChordDiagram
        expect(chord.strings.map((s) => s.note)).toEqual([null, 'Bb2', 'F3', 'Bb3', 'Db4', 'F4'])
        const [barre] = checkNote('a.md', '```chord\nC 8-10-10-9-8-8\n```', document)
        expect((barre!.diagrams[0] as GuitarChordDiagram).fretRange).toEqual([8, 11])
        expect((barre!.diagrams[0] as GuitarChordDiagram).frets).toBe('8-10-10-9-8-8')
    })
})

describe('rows a block draws itself', () => {
    const diagrams = (source: string) =>
        checkNote('a.md', `\`\`\`chord\n${source}\n\`\`\``, document)[0]!
            .diagrams as GuitarChordDiagram[]

    test('voicings:, triads: and transitions draw a diagram each', () => {
        expect(diagrams('G7\nvoicings: 3').map((d) => d.chord)).toEqual(['G7', 'G7', 'G7'])
        expect(diagrams('key: G major\ntriads: 1-3').map((d) => d.title)).toEqual([
            'I · G',
            'ii · Am',
            'iii · Bm',
            'IV · C',
            'V · D',
            'vi · Em',
            'vii° · F#dim'
        ])
        expect(diagrams('progression: C G').map((d) => d.chord)).toEqual(['C', 'G'])
        const [from, to] = diagrams('from: C x32010\nto: Am\ncount: 1')
        expect(from!.chord).toBe('C')
        expect(to!.strings.filter((s) => s.mark).map((s) => [s.string, s.mark])).toEqual([
            [4, 'anchor'],
            [2, 'anchor']
        ])
    })
})

test('--describe says where the capo is and what the shape sounds', () => {
    const [chord] = checkNote('a.md', '```chord\nA x02220\ncapo: 2\n```', document)[0]!
        .diagrams as GuitarChordDiagram[]
    expect(chord).toMatchObject({ chord: 'A', capo: 2, fretsFrom: 'capo', sounds: 'B' })
    expect(chord!.strings.map((s) => s.note)).toEqual([null, 'B2', 'F#3', 'B3', 'D#4', 'F#4'])
    const [board] = checkNote('a.md', '```fretboard\nE minor\ncapo: 3\n```', document)[0]!
        .diagrams as FretboardDiagram[]
    expect(board).toMatchObject({ capo: 3, tuning: ['G', 'C', 'F', 'A#', 'D', 'G'] })
    // No capo: nothing added.
    const [plain] = checkNote('a.md', '```chord\nA x02220\n```', document)[0]!.diagrams
    expect(plain).not.toHaveProperty('capo')
})

test('--describe says which hand plays each key', () => {
    const [keyboard] = checkNote(
        'a.md',
        '```chord\nC\ninstrument: piano\nhands: left+right\n```',
        document
    )[0]!.diagrams as KeyboardDiagram[]
    expect(keyboard!.keys.map((k) => [k.note, k.hand])).toEqual([
        ['C3', 'left'],
        ['C4', 'right'],
        ['E4', 'right'],
        ['G4', 'right']
    ])
})

describe('review fixes', () => {
    test('empty tab and score blocks are empty, not errors (templates scaffold them)', () => {
        const reports = checkNote('t.md', '```tab\n```\n\n```score\n\n```\n', document)
        expect(reports.map((r) => r.status)).toEqual(['empty', 'empty'])
    })

    test('a long run of spaces in an error message takes no time', () => {
        const start = performance.now()
        const [report] = checkNote(
            's.md',
            '```keyboard\nnotes: C' + ' '.repeat(40_000) + 'X\n```\n',
            document
        )
        expect(report!.status).toBe('error')
        expect(performance.now() - start).toBeLessThan(500)
    })

    test('a list with a root draws and checks', () => {
        const [report] = checkNote(
            'r.md',
            '```keyboard\nnotes: C4 E4 G4 C5 E5\nroot: C\n```\n',
            document
        )
        expect(report!.status).toBe('ok')
        const host = document.createElement('div')
        // An empty root: line is no root.
        expect(renderBlock('keyboard', 'notes: C E G\nroot:', host).ok).toBe(true)
    })

    test("--describe lists the compared scale's ghost notes", () => {
        const [board] = checkNote(
            'g.md',
            '```fretboard\nC major\ncompare: C minor\nfrets: 0-3\n```\n',
            document
        )
        const fret = board!.diagrams[0] as FretboardDiagram
        expect(fret.ghosts.map((g) => g.note)).toContain('Eb3')
        const [keys] = checkNote(
            'k.md',
            '```keyboard\nC major\ncompare: C minor\nrange: C4-B4\n```\n',
            document
        )
        expect((keys!.diagrams[0] as KeyboardDiagram).ghosts).toEqual(['Eb4', 'Ab4', 'Bb4'])
    })
})

describe('globs', () => {
    test('*, ** and {a,b}', () => {
        expect(globToRegExp('*.md').test('a.md')).toBe(true)
        expect(globToRegExp('*.md').test('x/a.md')).toBe(false)
        expect(globToRegExp('**/*.md').test('a.md')).toBe(true)
        expect(globToRegExp('**/*.md').test('x/y/a.md')).toBe(true)
        expect(globToRegExp('{a,b}?.md').test('b1.md')).toBe(true)
        expect(globToRegExp('[ab].md').test('c.md')).toBe(false)
    })

    test('files, folders (their Markdown files) and globs', async () => {
        const names = async (arg: string) =>
            (await expand(arg, dir)).map((f) => f.slice(dir.length + 1))
        expect(await names('notes')).toEqual(['notes/deep/bad.md', 'notes/good.md'])
        expect(await names('notes/*.md')).toEqual(['notes/good.md'])
        expect(await names('notes/**/*.md')).toEqual(['notes/deep/bad.md', 'notes/good.md'])
        expect(await names('notes/deep/other.txt')).toEqual(['notes/deep/other.txt'])
        expect(await names('missing/*.md')).toEqual([])
        expect(expand('missing.md', dir)).rejects.toThrow('missing.md: no such file or folder')
        // File names with glob characters are files first.
        expect(await names('Song {live}.md')).toEqual(['Song {live}.md'])
        expect(await names('Draft [1].md')).toEqual(['Draft [1].md'])
    })
})

describe('run', () => {
    test('prints each mistake as file:line: language: message and exits with 1', async () => {
        const { code, out, err } = await cli(['check', 'notes'])
        expect(code).toBe(1)
        expect(out).toBe(
            'notes/deep/bad.md:3: keyboard: "H major" is not a scale, chord or list of notes'
        )
        expect(err).toBe('2 files, 2 blocks: 1 ok, 1 with errors, 0 skipped, 0 empty')
    })

    test('exits with 0 when every block renders', async () => {
        expect((await cli(['check', 'notes/good.md'])).code).toBe(0)
    })

    test('--describe prints every block and what it draws', async () => {
        const { code, out } = await cli(['check', '--describe', 'notes/good.md'])
        expect(code).toBe(0)
        expect(out).toBe(
            [
                'notes/good.md:1: chord: ok',
                '  1. chord diagram, "Am", chord Am, frets 1-4, x02210',
                '     strings: 6 x | 5 0 A2 root | 4 2 E3 "2" | 3 2 A3 "3" root | 2 1 C4 "1" | 1 0 E4'
            ].join('\n')
        )
    })

    test('--json prints every block, the summary, and whether all is ok', async () => {
        const { code, out, err } = await cli(['check', '--json', 'crlf.md'])
        expect(code).toBe(1)
        expect(err).toBe('')
        const parsed = JSON.parse(out) as {
            ok: boolean
            summary: Record<string, number>
            blocks: BlockReport[]
        }
        expect(parsed.ok).toBe(false)
        expect(parsed.summary).toEqual({
            files: 1,
            blocks: 8,
            ok: 4,
            errors: 3,
            skipped: 1,
            empty: 0
        })
        expect(statuses(parsed.blocks)).toEqual(EXPECTED)
        expect(parsed.blocks[0]?.file).toBe('crlf.md')
    })

    test('usage errors exit with 2', async () => {
        expect((await cli([])).code).toBe(2)
        expect((await cli(['lint', 'a.md'])).code).toBe(2)
        expect((await cli(['check'])).code).toBe(2)
        expect((await cli(['check', '--fix', 'notes'])).code).toBe(2)
        const missing = await cli(['check', 'missing.md'])
        expect(missing.code).toBe(2)
        expect(missing.err).toStartWith('music-notation: missing.md: no such file or folder')
        expect((await cli(['check', 'none/*.md'])).code).toBe(2)
    })

    test('--help and --version', async () => {
        const help = await cli(['check', '--help'])
        expect(help.code).toBe(0)
        expect(help.out).toStartWith('Usage: music-notation check')
        expect(await cli(['--version'])).toEqual({ code: 0, out: '1.2.3', err: '' })
    })

    test('after --, arguments are files', async () => {
        expect((await cli(['check', '--', 'notes/good.md'])).code).toBe(0)
    })
})
