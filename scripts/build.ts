/**
 * Build:
 * - dist/index.js, dist/voicings/index.js, dist/publish/index.js: ES modules for bundlers (dependencies kept
 *   external), with type declarations from tsc.
 * - dist/music-notation.publish.min.js: a self-contained browser bundle for Obsidian Publish
 *   (publish.js loads it from jsDelivr).
 * - dist/music-notation.css: the stylesheet, for hosts that ship their own CSS file.
 * - dist/cli.js: the `music-notation` command (Node, linkedom bundled).
 */
import { $, type BunPlugin } from 'bun'
import { chmod, cp, readdir, rm } from 'node:fs/promises'

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
    entrypoints: [
        'src/index.ts',
        'src/voicings/index.ts',
        'src/publish/index.ts',
        'src/tab/index.ts'
    ],
    outdir: 'dist',
    root: 'src',
    naming: { entry: '[dir]/[name].js' },
    target: 'browser',
    format: 'esm',
    // No code splitting: Bun 1.4 emitted an index.js that re-exported names without importing
    // them from its chunk (0.1.2). Each entry is self-contained; check-dist.ts guards the output.
    splitting: false,
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

// Tabs and scores on web pages: alphaTab itself comes from jsDelivr at run time, not this file.
const tabBundle = await Bun.build({
    entrypoints: ['src/tab/auto.ts'],
    outdir: 'dist',
    naming: 'music-notation.tab.min.js',
    target: 'browser',
    format: 'iife',
    minify: true,
    banner: `/*! @dsebastien/music-notation ${pkg.version} tab bundle | MIT | loads alphaTab (MPL-2.0) from jsDelivr */`
})
if (!tabBundle.success) throw new AggregateError(tabBundle.logs, 'Tab bundle build failed')

// The `music-notation` command (package.json `bin`): Node only, with linkedom for the DOM. Its own
// entry, so the library and the browser bundles never load linkedom. It imports the built entries
// (./index.js, ./voicings/index.js, ./tab/index.js) instead of a copy of them: it checks blocks
// with the code that ships. Names are kept, so a stack trace stays readable.
const builtEntries: BunPlugin = {
    name: 'built-entries',
    setup(build) {
        build.onResolve({ filter: /^\.\.\/(?:voicings\/|tab\/)?index\.js$/ }, (args) =>
            args.importer.replace(/\\/g, '/').includes('/src/cli/')
                ? { path: args.path.replace('../', './'), external: true }
                : undefined
        )
    }
}
const cli = await Bun.build({
    entrypoints: ['src/cli/main.ts'],
    outdir: 'dist',
    naming: 'cli.js',
    target: 'node',
    format: 'esm',
    splitting: false,
    external,
    plugins: [builtEntries],
    minify: { whitespace: true, syntax: true, identifiers: false },
    banner: '#!/usr/bin/env node',
    metafile: true
})
if (!cli.success) throw new AggregateError(cli.logs, 'CLI build failed')
await chmod('dist/cli.js', 0o755)
console.log(`CLI: ${(Bun.file('dist/cli.js').size / 1024).toFixed(0)} KB`)

// Third-party code the CLI bundles: linkedom and its dependencies, read from the build itself.
const cliPackages = [
    ...new Set(
        Object.keys(cli.metafile!.inputs).flatMap((input) => {
            const m = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input)
            return m ? [m[1]!] : []
        })
    )
]
for (const name of cliPackages.sort()) {
    const known = BUNDLED.find((dep) => dep.name === name)
    if (known) known.in += ', cli.js'
    else BUNDLED.push({ name, dir: `node_modules/${name}`, in: 'cli.js' })
}

await cp('src/styles.css', 'dist/music-notation.css')

/** A package's license text: LICENSE, LICENSE.md, license.txt… */
async function licenseOf(dir: string): Promise<string> {
    const file = (await readdir(dir)).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f))
    if (!file) throw new Error(`No license file in ${dir}`)
    return Bun.file(`${dir}/${file}`).text()
}

const notices = await Promise.all(
    BUNDLED.map(
        async (dep) =>
            `## ${dep.name}\n\nShipped in: ${dep.in}\n\n\`\`\`\n${(await licenseOf(dep.dir)).trim()}\n\`\`\`\n`
    )
)
await Bun.write('dist/THIRD_PARTY_LICENSES.md', `# Third-party licenses\n\n${notices.join('\n')}`)
await $`bunx tsc -p tsconfig.build.json`

const size = Bun.file('dist/music-notation.publish.min.js').size
console.log(`Publish bundle: ${(size / 1024).toFixed(0)} KB`)
console.log(`Tab bundle: ${(Bun.file('dist/music-notation.tab.min.js').size / 1024).toFixed(0)} KB`)

// Node 24 runs TypeScript directly (type stripping), the way consumers' Node would load dist/.
await $`node scripts/check-dist.ts`
