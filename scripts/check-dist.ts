// Import every built entry in Node, as consumers do, and check its exports exist. Catches a
// broken bundle (0.1.2 shipped an index.js exporting names it never declared).
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

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
    'dist/publish/index.js': ['renderAll', 'autoRender']
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
if (failed) process.exit(1)
