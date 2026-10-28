/**
 * Build:
 * - dist/index.js, dist/voicings/index.js, dist/publish/index.js: ES modules for bundlers (dependencies kept
 *   external), with type declarations from tsc.
 * - dist/music-notation.publish.min.js: a self-contained browser bundle for Obsidian Publish
 *   (publish.js loads it from jsDelivr).
 * - dist/music-notation.css: the stylesheet, for hosts that ship their own CSS file.
 */
import { $ } from 'bun'
import { cp, rm } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })

const pkg = (await Bun.file('package.json').json()) as { dependencies?: Record<string, string> }
const external = Object.keys(pkg.dependencies ?? {}).flatMap((d) => [d, `${d}/*`])

const library = await Bun.build({
    entrypoints: ['src/index.ts', 'src/voicings/index.ts', 'src/publish/index.ts'],
    outdir: 'dist',
    root: 'src',
    naming: { entry: '[dir]/[name].js', chunk: 'chunks/[name]-[hash].js' },
    target: 'browser',
    format: 'esm',
    splitting: true,
    external,
    sourcemap: 'linked'
})
if (!library.success) throw new AggregateError(library.logs, 'Library build failed')

const outputs = library.outputs.map((o) => o.path)
console.log(outputs.map((p) => p.replace(`${process.cwd()}/`, '')).join('\n'))

const bundle = await Bun.build({
    entrypoints: ['src/publish/auto.ts'],
    outdir: 'dist',
    naming: 'music-notation.publish.min.js',
    target: 'browser',
    format: 'iife',
    minify: true
})
if (!bundle.success) throw new AggregateError(bundle.logs, 'Publish bundle build failed')

await cp('src/styles.css', 'dist/music-notation.css')
await $`bunx tsc -p tsconfig.build.json`

const size = Bun.file('dist/music-notation.publish.min.js').size
console.log(`Publish bundle: ${(size / 1024).toFixed(0)} KB`)
