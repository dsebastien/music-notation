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

const pkg = (await Bun.file('package.json').json()) as {
    version: string
    dependencies?: Record<string, string>
}
// Runtime dependencies stay external; the voicing data (a dev dependency) is inlined as a JS
// object, so `./voicings` loads in Node and every bundler without JSON import attributes.
const external = Object.keys(pkg.dependencies ?? {}).flatMap((d) => [d, `${d}/*`])

/** Third-party code shipped inside dist/ (minifiers strip the notices from the code). */
const BUNDLED = [
    { name: 'tonal', dir: 'node_modules/tonal', in: 'music-notation.publish.min.js' },
    {
        name: '@tombatossals/chords-db',
        dir: 'node_modules/@tombatossals/chords-db',
        in: 'voicings/index.js, music-notation.publish.min.js'
    }
]

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
    minify: true,
    banner: `/*! @dsebastien/music-notation ${pkg.version} | MIT | includes tonal (MIT) and chords-db (MIT): see THIRD_PARTY_LICENSES.md */`
})
if (!bundle.success) throw new AggregateError(bundle.logs, 'Publish bundle build failed')

await cp('src/styles.css', 'dist/music-notation.css')

const notices = await Promise.all(
    BUNDLED.map(
        async (dep) =>
            `## ${dep.name}\n\nShipped in: ${dep.in}\n\n\`\`\`\n${(await Bun.file(`${dep.dir}/LICENSE`).text()).trim()}\n\`\`\`\n`
    )
)
await Bun.write('dist/THIRD_PARTY_LICENSES.md', `# Third-party licenses\n\n${notices.join('\n')}`)
await $`bunx tsc -p tsconfig.build.json`

const size = Bun.file('dist/music-notation.publish.min.js').size
console.log(`Publish bundle: ${(size / 1024).toFixed(0)} KB`)
