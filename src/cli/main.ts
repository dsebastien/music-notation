/**
 * The `music-notation` command (package.json `bin`, built to dist/cli.js with a node shebang).
 * The only entry that loads a DOM for Node (linkedom): the library and the browser bundles never
 * import this file.
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { run } from './check.js'

/** The package's version, from the package.json next to dist/. */
function version(): string | undefined {
    try {
        const text = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
        return (JSON.parse(text) as { version?: string }).version
    } catch {
        return undefined
    }
}

// Piped into head or grep -m: stop quietly when the reader is gone.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(process.exitCode ?? 0)
    throw error
})

const { document } = parseHTML('<!doctype html><html><head></head><body></body></html>')

process.exitCode = await run(process.argv.slice(2), {
    cwd: process.cwd(),
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    doc: document as unknown as Document,
    version: version()
})
