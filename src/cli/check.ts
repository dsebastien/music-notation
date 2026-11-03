/**
 * `music-notation check`: renders every notation block of Markdown notes with the real renderer
 * and reports each mistake as `file:line: language: message`. The DOM is passed in (the bin uses
 * linkedom), so this module runs anywhere a document exists.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { isNotationLanguage, renderBlock } from '../index.js'
import { parseTabSource } from '../tab/index.js'
import { lookupGuitarVoicing } from '../voicings/index.js'
import { parseMarkdown } from './markdown.js'
import { describeBlock, formatDiagram, type Diagram } from './describe.js'

export type BlockStatus = 'ok' | 'error' | 'skipped' | 'empty'

export interface BlockReport {
    file: string
    /** The opening fence's line, from 1. */
    line: number
    language: string
    status: BlockStatus
    /** The error, or why the block was skipped or draws nothing. */
    message: string | null
    diagrams: Diagram[]
}

export interface Summary {
    files: number
    blocks: number
    ok: number
    errors: number
    skipped: number
    empty: number
}

const DIAGRAM_LANGUAGES = ['chord', 'keyboard', 'fretboard']
/** A message on one line (split, not one regex over the whole text: no backtracking). */
const oneLine = (s: string) =>
    s
        .split(/[\r\n]+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ')

/** Every notation block of one note, rendered into `doc`. */
export function checkNote(file: string, text: string, doc: Document): BlockReport[] {
    const note = parseMarkdown(text)
    const reports: BlockReport[] = []
    for (const block of note.blocks) {
        const { language, line, source } = block
        const report = (status: BlockStatus, message: string | null, diagrams: Diagram[] = []) =>
            reports.push({ file, line, language, status, message, diagrams })
        const isTab = language === 'tab' || language === 'score'
        if ((isTab || isNotationLanguage(language)) && !source.trim()) {
            // Templates scaffold empty blocks: they draw nothing, successfully. In Obsidian an
            // empty diagram block draws from the note's properties, which aren't read here.
            if (note.frontMatter !== null && DIAGRAM_LANGUAGES.includes(language)) {
                report('skipped', "empty block: draws from the note's properties, not checked")
            } else report('empty', 'empty block: draws nothing')
            continue
        }
        if (isTab) {
            // Only the settings lines can be checked: the music itself needs alphaTab.
            try {
                parseTabSource(language, source)
                report('skipped', 'alphaTex is not checked (it needs alphaTab)')
            } catch (e) {
                report('error', oneLine(e instanceof Error ? e.message : String(e)))
            }
            continue
        }
        if (!isNotationLanguage(language)) continue
        const host = doc.createElement('div')
        const result = renderBlock(language, source, host, { voicings: lookupGuitarVoicing })
        const diagrams = describeBlock(result.el)
        if (result.ok) report('ok', null, diagrams)
        else report('error', oneLine(result.error ?? 'error'), diagrams)
        result.destroy()
    }
    return reports
}

export function summarize(files: number, reports: BlockReport[]): Summary {
    const count = (status: BlockStatus) => reports.filter((r) => r.status === status).length
    return {
        files,
        blocks: reports.length,
        ok: count('ok'),
        errors: count('error'),
        skipped: count('skipped'),
        empty: count('empty')
    }
}

/** A mistake, as compilers write them: \`file:line: language: message\`. */
export const formatError = (r: BlockReport) => `${r.file}:${r.line}: ${r.language}: ${r.message}`

/** The block's first line in --describe: where it is, then what happened. */
export function formatReport(r: BlockReport): string {
    const where = `${r.file}:${r.line}: ${r.language}`
    return r.status === 'ok' ? `${where}: ok` : `${where}: ${r.status}: ${r.message ?? ''}`
}

export function formatDescription(r: BlockReport): string[] {
    return [
        formatReport(r),
        ...r.diagrams.flatMap((d, i) => formatDiagram(d, i + 1)).map((l) => `  ${l}`)
    ]
}

const GLOB = /[*?[{]/

/** A glob as a regular expression over `/`-separated paths: *, ?, **, {a,b} and [abc]. */
export function globToRegExp(pattern: string): RegExp {
    let out = ''
    for (let i = 0; i < pattern.length; i++) {
        const c = pattern[i]!
        if (c === '*' && pattern[i + 1] === '*') {
            const slash = pattern[i + 2] === '/'
            out += slash ? '(?:.*/)?' : '.*'
            i += slash ? 2 : 1
        } else if (c === '*') out += '[^/]*'
        else if (c === '?') out += '[^/]'
        else if (c === '{') {
            const end = pattern.indexOf('}', i)
            if (end < 0) out += '\\{'
            else {
                out += `(?:${pattern
                    .slice(i + 1, end)
                    .split(',')
                    .map((p) => p.replace(/[.+^$()|\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
                    .join('|')})`
                i = end
            }
        } else if (c === '[') {
            const end = pattern.indexOf(']', i + 1)
            if (end < 0) out += '\\['
            else {
                out += `[${pattern
                    .slice(i + 1, end)
                    .replace(/^!/, '^')
                    .replace(/\\/g, '\\\\')}]`
                i = end
            }
        } else out += c.replace(/[.+^$()|\\\]}]/g, '\\$&')
    }
    return new RegExp(`^${out}$`)
}

/** Files under a folder, skipping dot folders and node_modules. */
async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                files.push(...(await walk(path)))
            }
        } else if (entry.isFile()) files.push(path)
    }
    return files
}

const isMarkdown = (path: string) => /\.(md|markdown)$/i.test(path)

/** The files an argument names: a file, a folder (its Markdown files), or a glob. */
export async function expand(arg: string, cwd: string): Promise<string[]> {
    const pattern = arg.replace(/\\/g, '/')
    // A file or folder of that name first: "Song {live}.md" and "Draft [1].md" aren't globs.
    const path = resolve(cwd, arg)
    const info = await stat(path).catch(() => null)
    if (info) return info.isDirectory() ? (await walk(path)).filter(isMarkdown) : [path]
    if (!GLOB.test(pattern)) throw new Error(`${arg}: no such file or folder`)
    // The folder before the first wildcard is where the search starts.
    const segments = pattern.split('/')
    const first = segments.findIndex((s) => GLOB.test(s))
    const base = resolve(cwd, segments.slice(0, first).join('/') || '.')
    const matcher = globToRegExp(segments.slice(first).join('/'))
    const baseInfo = await stat(base).catch(() => null)
    if (!baseInfo?.isDirectory()) return []
    return (await walk(base)).filter((f) => matcher.test(relative(base, f).replace(/\\/g, '/')))
}

export const USAGE = `Usage: music-notation check [options] <files, folders or globs...>

Renders every chord, chords, keyboard and fretboard block of Markdown files
and reports each mistake as file:line: language: message.

Options:
  --describe   also print what each block draws (titles, chords, notes, frets, keys)
  --json       print every block and what it draws as JSON
  -h, --help   show this help
  --version    show the version

Exit code: 0 when every block renders, 1 when a block has a mistake,
2 when the command is wrong (unknown option, no file, a file not found).
Tab and score blocks only get their settings lines checked (alphaTex needs alphaTab).
Empty blocks in a note with properties are skipped: in Obsidian they draw from
the properties, which this check doesn't read.`

export interface CliIo {
    cwd: string
    out: (line: string) => void
    err: (line: string) => void
    doc: Document
    version?: string
}

/** Runs the command line; resolves to the exit code. */
export async function run(args: string[], io: CliIo): Promise<number> {
    const usage = (message: string) => {
        io.err(`music-notation: ${message}`)
        io.err(USAGE)
        return 2
    }
    if (args.includes('-h') || args.includes('--help')) {
        io.out(USAGE)
        return 0
    }
    if (args[0] === '--version') {
        io.out(io.version ?? 'unknown')
        return 0
    }
    const [command, ...rest] = args
    if (command !== 'check') return usage(command ? `unknown command "${command}"` : 'no command')
    // After "--", every argument is a file, even one starting with a dash.
    const end = rest.indexOf('--')
    const flags = end < 0 ? rest : rest.slice(0, end)
    const options = flags.filter((a) => a.startsWith('-'))
    const unknown = options.find((o) => o !== '--describe' && o !== '--json')
    if (unknown) return usage(`unknown option "${unknown}"`)
    const patterns = [
        ...flags.filter((a) => !a.startsWith('-')),
        ...(end < 0 ? [] : rest.slice(end + 1))
    ]
    if (!patterns.length) return usage('give the Markdown files to check')
    const json = options.includes('--json')
    const describe = options.includes('--describe')

    const files: string[] = []
    for (const pattern of patterns) {
        let found: string[]
        try {
            found = await expand(pattern, io.cwd)
        } catch (e) {
            return usage(e instanceof Error ? e.message : String(e))
        }
        if (!found.length) return usage(`${pattern}: no file matches`)
        for (const f of found) if (!files.includes(f)) files.push(f)
    }

    const reports: BlockReport[] = []
    for (const path of files) {
        let text: string
        try {
            text = await readFile(path, 'utf8')
        } catch (e) {
            return usage(`${relative(io.cwd, path)}: ${e instanceof Error ? e.message : String(e)}`)
        }
        // Paths inside the folder the command runs in are shown relative to it.
        const inside = relative(io.cwd, path)
        const file = (inside && !inside.startsWith('..') ? inside : path).replace(/\\/g, '/')
        const found = checkNote(file, text, io.doc)
        reports.push(...found)
        if (json) continue
        for (const r of found) {
            if (describe) for (const line of formatDescription(r)) io.out(line)
            else if (r.status === 'error') io.out(formatError(r))
        }
    }
    const summary = summarize(files.length, reports)
    if (json)
        io.out(JSON.stringify({ ok: summary.errors === 0, summary, blocks: reports }, null, 2))
    else {
        io.err(
            `${summary.files} ${summary.files === 1 ? 'file' : 'files'}, ${summary.blocks} blocks: ${summary.ok} ok, ${summary.errors} with errors, ${summary.skipped} skipped, ${summary.empty} empty`
        )
    }
    return summary.errors ? 1 : 0
}
