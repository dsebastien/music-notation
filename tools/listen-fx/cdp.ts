// A small DevTools-protocol driver: opens a page in headless Chrome, runs steps, lists requests.
// Usage: bun cdp.ts <url> <steps.js>   (steps.js exports default async (page) => result)
const [url, stepsFile] = process.argv.slice(2)
const port = 9300 + Math.floor(Math.random() * 500)
const chrome = Bun.spawn(
    [
        'google-chrome-stable',
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--autoplay-policy=no-user-gesture-required',
        '--no-first-run',
        ...(process.env.MN_SOUND ? [] : ['--mute-audio']),
        `--user-data-dir=/tmp/mn-harness-profile-${port}`,
        '--window-size=1200,900',
        'about:blank'
    ],
    { stdout: 'ignore', stderr: 'ignore' }
)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
let target: { webSocketDebuggerUrl: string } | undefined
for (let i = 0; i < 50 && !target; i++) {
    await wait(200)
    try {
        const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
            type: string
            webSocketDebuggerUrl: string
        }[]
        target = list.find((t) => t.type === 'page')
    } catch {}
}
if (!target) throw new Error('Chrome did not start')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map<number, (v: any) => void>()
const requests: string[] = []
const errors: string[] = []
ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data))
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)!(msg.result ?? msg.error)
    if (msg.method === 'Network.requestWillBeSent') requests.push(msg.params.request.url)
    if (msg.method === 'Runtime.exceptionThrown')
        errors.push(msg.params.exceptionDetails?.exception?.description ?? 'exception')
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error')
        errors.push(msg.params.args.map((a: any) => a.value ?? a.description).join(' '))
}
const send = (method: string, params: object = {}) =>
    new Promise<any>((resolve) => {
        pending.set(++id, resolve)
        ws.send(JSON.stringify({ id, method, params }))
    })
await send('Network.enable')
await send('Runtime.enable')
await send('Page.enable')
await send('Page.navigate', { url })
await wait(2500)
const page = {
    wait,
    requests,
    errors,
    eval: async (expression: string) => {
        const r = await send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true
        })
        return r?.result?.value ?? r?.exceptionDetails?.exception?.description
    },
    /** Writes a PNG of the page (or of the element a selector finds) to a file. */
    shot: async (file: string, selector?: string) => {
        let clip: object | undefined
        if (selector) {
            const r = await send('Runtime.evaluate', {
                expression: `(() => { const b = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return b ? JSON.stringify({ x: Math.max(0, b.x - 8), y: Math.max(0, b.y + scrollY - 8), width: b.width + 16, height: b.height + 16, scale: 2 }) : '' })()`,
                returnByValue: true
            })
            if (r?.result?.value) clip = JSON.parse(r.result.value)
        }
        const shot = await send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: true,
            ...(clip ? { clip } : {})
        })
        await Bun.write(file, Buffer.from(shot.data, 'base64'))
        return file
    },
    mark: () => requests.length,
    since: (from: number) => requests.slice(from).map((u) => u.split('/').slice(-1)[0])
}
try {
    const steps = (await import(stepsFile!)).default
    console.log(JSON.stringify(await steps(page), null, 1))
} finally {
    ws.close()
    chrome.kill()
}
