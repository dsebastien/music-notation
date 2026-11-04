// Serves the #58 prototypes: `bun "documentation/design/58 playback bar/server.ts"`, then open
// http://127.0.0.1:8770/. The pages load the library bundle from this folder: copy it first with
// `cp dist/music-notation.publish.min.js dist/music-notation.css "documentation/design/58 playback bar/"`
// after `bun run build` (the copies are not committed).
const root = import.meta.dir
Bun.serve({
    port: 8770,
    hostname: '127.0.0.1',
    fetch(req) {
        let p = new URL(req.url).pathname
        if (p === '/') p = '/index.html'
        const f = Bun.file(root + decodeURIComponent(p))
        return f.size ? new Response(f) : new Response('not found', { status: 404 })
    }
})
console.log('serving ' + root + ' on http://127.0.0.1:8770')
