// Serves the library's dist folder and the harness pages on one origin.
const dist = '/home/dsebastien/wks/music-notation/dist'
const here = import.meta.dir
Bun.serve({
    port: Number(process.argv[2] ?? 4175),
    async fetch(req) {
        const path = new URL(req.url).pathname
        const file = Bun.file(path.startsWith('/dist/') ? dist + path.slice(5) : here + path)
        return (await file.exists())
            ? new Response(file)
            : new Response('not found', { status: 404 })
    }
})
console.log('ready')
