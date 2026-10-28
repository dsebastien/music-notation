/**
 * Docs: after each ````markdown example of a notation block, insert the same block as raw HTML
 * (`<pre><code class="language-…">`), which the bundle loaded by `_includes/head_custom.html`
 * draws on the published site. Idempotent: existing live blocks are regenerated.
 *
 *   bun scripts/live-examples.ts docs/blocks.md docs/examples.md
 */
const LANGUAGES = ['chord', 'chords', 'keyboard', 'fretboard']
const LIVE = /\n<div class="mn-live" markdown="0">[\s\S]*?<\/div>\n/g
const EXAMPLE = /````markdown\n```(\w+)\n([\s\S]*?)\n```\n````\n/g

const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

for (const path of process.argv.slice(2)) {
    const original = await Bun.file(path).text()
    const updated = original
        .replace(LIVE, '\n')
        .replace(EXAMPLE, (example, language: string, source: string) =>
            LANGUAGES.includes(language)
                ? `${example}\n<div class="mn-live" markdown="0"><pre><code class="language-${language}">${escape(source)}</code></pre></div>\n`
                : example
        )
    await Bun.write(path, updated)
    console.log(`${path}: ${(updated.match(LIVE) ?? []).length} live examples`)
}
