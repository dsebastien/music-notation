/**
 * Fenced code blocks in a Markdown note, the way Obsidian finds them: ``` or ~~~ fences of any
 * length (3 or more), in callouts and quotes (`> `) and in list items, with CRLF or LF line ends.
 * The front matter is skipped.
 */

export interface FencedBlock {
    /** The info string's first word ("chord"), as written. */
    language: string
    /** 1-based line of the opening fence. */
    line: number
    /** The lines between the fences, without the container's quote markers and indentation. */
    source: string
}

export interface MarkdownNote {
    /** The front matter's lines (between the `---` lines), or null when the note has none. */
    frontMatter: string | null
    blocks: FencedBlock[]
}

const QUOTE = /^[ \t]{0,3}>[ \t]?/
const OPENING = /^(`{3,}|~{3,})(.*)$/
const LIST_MARKER = /^(?:[-*+]|\d{1,9}[.)])[ \t]+/

/** Strips `depth` quote markers; null when the line has fewer (the quote has ended). */
function unquote(line: string, depth: number): string | null {
    let rest = line
    for (let i = 0; i < depth; i++) {
        const m = QUOTE.exec(rest)
        if (!m) return null
        rest = rest.slice(m[0].length)
    }
    return rest
}

/** Removes up to `indent` columns of leading spaces (a tab counts as one). */
const dedent = (line: string, indent: number) => {
    let i = 0
    while (i < indent && (line[i] === ' ' || line[i] === '\t')) i++
    return line.slice(i)
}

/** Columns of leading whitespace (a tab counts as 4). */
const columns = (lead: string) => [...lead].reduce((n, c) => n + (c === '\t' ? 4 - (n % 4) : 1), 0)

/** Whether a line leaves a comment open: an odd number of %%, or <!-- without --> after it. */
function opensComment(line: string): boolean {
    if ((line.split('%%').length - 1) % 2 === 1) return true
    const html = line.lastIndexOf('<!--')
    return html >= 0 && !line.includes('-->', html + 4)
}

/** The text that closes the comment a line opens. */
const commentEnd = (line: string): '%%' | '-->' =>
    (line.split('%%').length - 1) % 2 === 1 ? '%%' : '-->'

export function parseMarkdown(text: string): MarkdownNote {
    const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/)
    let i = 0
    let frontMatter: string | null = null
    // Front matter: a `---` first line, up to the next `---` (or `...`) line.
    if (lines[0]?.trimEnd() === '---') {
        const end = lines.findIndex((l, n) => n > 0 && /^(?:---|\.\.\.)\s*$/.test(l))
        if (end > 0) {
            frontMatter = lines.slice(1, end).join('\n')
            i = end + 1
        }
    }
    const blocks: FencedBlock[] = []
    // Obsidian draws nothing inside %% … %% and <!-- … --> comments.
    let comment: '%%' | '-->' | null = null
    // Inside a list, a fence may sit 4 columns in or more; elsewhere that's an indented code block.
    let inList = false
    for (; i < lines.length; i++) {
        const line = lines[i]!
        if (comment) {
            const end = line.indexOf(comment)
            if (end < 0) continue
            comment = null
            if (opensComment(line.slice(end + 2))) comment = commentEnd(line.slice(end + 2))
            continue
        }
        let rest = line
        let depth = 0
        for (let m = QUOTE.exec(rest); m; m = QUOTE.exec(rest)) {
            rest = rest.slice(m[0].length)
            depth++
        }
        // A fence in a list item, on the marker's line or under it: the content's indentation.
        const spaces = /^[ \t]*/.exec(rest)![0].length
        const marker = LIST_MARKER.exec(rest.slice(spaces))?.[0].length ?? 0
        const indent = spaces + marker
        if (marker) inList = true
        else if (rest.trim() && columns(rest.slice(0, spaces)) === 0) inList = false
        const open = OPENING.exec(rest.slice(indent))
        if (!open) {
            if (opensComment(rest)) comment = commentEnd(rest)
            continue
        }
        if (!marker && !inList && columns(rest.slice(0, spaces)) > 3) continue
        const fence = open[1]!
        const info = open[2]!
        // A backtick fence's info string has no backticks (else it's inline code).
        if (fence[0] === '`' && info.includes('`')) continue
        const body: string[] = []
        const start = i
        for (i++; i < lines.length; i++) {
            const inner = unquote(lines[i]!, depth)
            // The quote ended: so does the block (CommonMark).
            if (inner === null) {
                i--
                break
            }
            const close = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(inner)
            if (close && close[1]![0] === fence[0] && close[1]!.length >= fence.length) break
            body.push(dedent(inner, indent))
        }
        blocks.push({
            language: info.trim().split(/\s+/)[0] ?? '',
            line: start + 1,
            source: body.join('\n')
        })
    }
    return { frontMatter, blocks }
}
