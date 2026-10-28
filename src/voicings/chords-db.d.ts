// Types for the guitar data of @tombatossals/chords-db (MIT), which ships plain JSON.
declare module '@tombatossals/chords-db/lib/guitar.json' {
    interface Position {
        /** Relative to baseFret; -1 = muted. */
        frets: number[]
        fingers: number[]
        baseFret: number
        barres: number[]
        capo?: boolean
        midi: number[]
    }
    interface Chord {
        key: string
        suffix: string
        positions: Position[]
    }
    const db: {
        keys: string[]
        suffixes: string[]
        chords: Record<string, Chord[]>
    }
    export default db
}
