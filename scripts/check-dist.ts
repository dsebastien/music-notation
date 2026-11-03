// Import every built entry in Node, as consumers do, and check its exports exist. Catches a
// broken bundle (0.1.2 shipped an index.js exporting names it never declared).
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const BROWSER_BUNDLES = ['dist/music-notation.publish.min.js', 'dist/music-notation.tab.min.js']

const expect: Record<string, string[]> = {
    'dist/index.js': [
        'renderBlock',
        'LANGUAGES',
        'parseChord',
        'chordNoteSet',
        'renderGuitarDiagram',
        'STYLES'
    ],
    'dist/voicings/index.js': ['lookupGuitarVoicing', 'voicingCount'],
    'dist/publish/index.js': ['renderAll', 'autoRender'],
    'dist/tab/index.js': [
        'renderTab',
        'parseTabSource',
        'soundfontPlayer',
        'createSoundfontPlayer',
        'scoreToAlphaTex',
        'exportGp7',
        'exportMidi',
        'textTabToAlphaTex',
        'chordSheetToChordPro',
        'ALPHATAB_VERSION'
    ]
}

let failed = false
for (const [file, names] of Object.entries(expect)) {
    try {
        const mod = (await import(pathToFileURL(resolve(file)).href)) as Record<string, unknown>
        const missing = names.filter((n) => mod[n] === undefined)
        if (missing.length) throw new Error(`missing exports: ${missing.join(', ')}`)
        console.log(`✓ ${file}`)
    } catch (error) {
        failed = true
        console.error(`✗ ${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
}
const voicings = (await import(pathToFileURL(resolve('dist/voicings/index.js')).href)) as {
    lookupGuitarVoicing: (symbol: string, index: number) => { frets: (number | null)[] } | null
}
if (JSON.stringify(voicings.lookupGuitarVoicing('A', 0)?.frets) !== '[null,0,2,2,2,0]') {
    failed = true
    console.error('✗ voicings: A did not resolve to x02220')
}
// The command line (bin): runs in Node on the fixture, reports its mistakes, exits with 1.
const cli = spawnSync(process.execPath, ['dist/cli.js', 'check', 'src/cli/fixtures/notes.md'], {
    encoding: 'utf8'
})
if (cli.status !== 1 || !cli.stdout.startsWith('src/cli/fixtures/notes.md:17: chord: ')) {
    failed = true
    console.error(`✗ dist/cli.js: exit ${cli.status}\n${cli.stdout}${cli.stderr}`)
} else console.log('✓ dist/cli.js')
// linkedom is the command line's alone: no other entry may load or bundle it. Its package name
// doesn't survive bundling, so look for its import and for code only linkedom brings (parseHTML,
// its CSSStyleDeclaration), and make sure those markers are in dist/cli.js, or the guard is blind.
const LINKEDOM = [/linkedom/, /\bparseHTML\b/, /\bCSSStyleDeclaration\b/]
const cliText = await readFile('dist/cli.js', 'utf8')
if (!LINKEDOM.slice(1).every((marker) => marker.test(cliText))) {
    failed = true
    console.error('✗ dist/cli.js: the linkedom markers are gone; update the guard in check-dist.ts')
}
for (const file of [...Object.keys(expect), ...BROWSER_BUNDLES]) {
    const text = await readFile(file, 'utf8')
    const found = LINKEDOM.find((marker) => marker.test(text))
    if (found) {
        failed = true
        console.error(`✗ ${file} includes linkedom (${found.source})`)
    }
}
if (failed) process.exit(1)
