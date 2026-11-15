/**
 * One soundfont per instrument (#108, #124): a folder made by `scripts/sounds/split-soundfont.ts`
 * holds a small soundfont for each General MIDI program (`p025.sf3`), the drum kit, the
 * metronome's click alone, and an `index.json` that names them. A score, or the diagrams' player,
 * loads only the files of what it plays: a chord diagram one guitar (about 110 KB with
 * GeneralUser GS), where a whole bank is megabytes.
 *
 * Nothing here knows alphaTab: `instrumentSounds` finds and reads the files, its caller loads them.
 */

/**
 * Where the instrument files are: the URL of their folder (web pages), or a function that reads
 * one of them by its name, `index.json` included (an app that ships them or keeps them in a
 * vault); it gives null for a file it doesn't have.
 */
export type InstrumentSource = string | ((file: string) => Promise<Uint8Array | null>)

/** The folder's `index.json`, as far as playing needs it. */
export interface InstrumentIndex {
    /** By General MIDI program, 0 to 127. */
    programs: Record<string, { file: string } | undefined>
    drums?: { file: string } | null
    /** The kit's metronome click alone, for scores without drums. */
    click?: { file: string } | null
}

/** What something plays: its programs, and whether it has drums. */
export interface Sounds {
    programs: number[]
    drums: boolean
}

/** The programs and the drums of a score's tracks. */
export function soundsOfScore(score: {
    tracks: { isPercussion: boolean; playbackInfo: { program: number } }[]
}): Sounds {
    const programs = new Set<number>()
    let drums = false
    for (const track of score.tracks) {
        if (track.isPercussion) drums = true
        else programs.add(track.playbackInfo.program)
    }
    return { programs: [...programs].sort((a, b) => a - b), drums }
}

/**
 * The files `sounds` needs, in the order they load: each program's, then the drum kit, or the
 * click alone when nothing plays drums (the metronome and the count-in need it). Null when the
 * folder lacks one of the programs or the kit: the whole soundfont plays then.
 */
export function filesOf(index: InstrumentIndex, sounds: Sounds): string[] | null {
    const files: string[] = []
    for (const program of sounds.programs) {
        const entry = index.programs[String(program)]
        if (!entry?.file) return null
        files.push(entry.file)
    }
    if (sounds.drums) {
        if (!index.drums?.file) return null
        files.push(index.drums.file)
    } else if (index.click?.file) files.push(index.click.file)
    return files.length ? files : null
}

interface Cache {
    index: Promise<InstrumentIndex | null> | null
    files: Map<string, Promise<Uint8Array | null>>
}

/**
 * One cache per source and window: two blocks of a page download a guitar once. Not named
 * `caches`: that is a browser global, and in a bundle loaded as a plain script it won over this one.
 */
const soundCaches = new WeakMap<Window, Map<InstrumentSource, Cache>>()

const isIndex = (value: unknown): value is InstrumentIndex =>
    typeof value === 'object' &&
    value !== null &&
    'programs' in value &&
    typeof value.programs === 'object' &&
    value.programs !== null

/**
 * Reads the instrument files of `source` for `sounds`: the bytes of each, in loading order. Null
 * when the index or one file can't be read, or the folder lacks a sound: nothing is half loaded,
 * the caller plays its whole soundfont. Never throws.
 */
export async function instrumentSounds(
    source: InstrumentSource,
    sounds: Sounds,
    win: Window
): Promise<Uint8Array[] | null> {
    let perWindow = soundCaches.get(win)
    if (!perWindow) soundCaches.set(win, (perWindow = new Map<InstrumentSource, Cache>()))
    let cache = perWindow.get(source)
    if (!cache) perWindow.set(source, (cache = { index: null, files: new Map() }))
    const read = async (file: string): Promise<Uint8Array | null> => {
        try {
            if (typeof source === 'function') return await source(file)
            const response = await win.fetch(`${source.replace(/\/+$/, '')}/${file}`)
            return response.ok ? new Uint8Array(await response.arrayBuffer()) : null
        } catch {
            return null
        }
    }
    const fileOf = (file: string) => {
        let bytes = cache.files.get(file)
        if (!bytes) {
            bytes = read(file)
            cache.files.set(file, bytes)
            // A failed read is tried again next time (the network came back).
            void bytes.then((b) => {
                if (!b) cache.files.delete(file)
            })
        }
        return bytes
    }
    cache.index ??= read('index.json').then((bytes) => {
        if (!bytes) return null
        try {
            const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
            return isIndex(value) ? value : null
        } catch {
            return null
        }
    })
    const index = await cache.index
    if (!index) {
        cache.index = null
        return null
    }
    const files = filesOf(index, sounds)
    if (!files) return null
    const all = await Promise.all(files.map(fileOf))
    return all.every((b): b is Uint8Array => b !== null) ? all : null
}
