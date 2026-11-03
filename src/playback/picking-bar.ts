/**
 * The play bar of a picking pattern (#51): play / stop, loop, count-in, click, tempo, volume and
 * sound, as on strumming patterns. What plays is read from the drawing (each slot's
 * `data-mn-notes`, each bar's chord), so any page that drew the pattern can play it.
 */
import { pickingEvents, type PickingScore } from '../picking/play.js'
import type { PickedNote } from '../picking/voicing.js'
import { isCompound } from '../strum/pattern.js'
import type { PlayOptions } from './controls.js'
import type { ProgressionSettings } from './progression.js'
import { timedBarFor } from './strum-bar.js'

/** The score of a drawn picking pattern; null when it has no slots. */
export function pickingScoreFromDrawing(drawing: Element): PickingScore | null {
    const cells = [...drawing.querySelectorAll('[data-mn-beat]')].sort(
        (a, b) => Number(a.getAttribute('data-mn-beat')) - Number(b.getAttribute('data-mn-beat'))
    )
    if (!cells.length) return null
    const time = /^(\d+)\/(\d+)$/.exec(drawing.getAttribute('data-mn-time') ?? '')
    const beatsPerBar = Number(time?.[1]) > 0 ? Number(time![1]) : 4
    const beatUnit = Number(time?.[2]) > 0 ? Number(time![2]) : 4
    const perBeat = Number(drawing.getAttribute('data-mn-slots-per-beat'))
    const slotsPerBeat = Number.isInteger(perBeat) && perBeat > 0 ? perBeat : 2
    const perBar = slotsPerBeat * beatsPerBar
    const chords: (string | null)[] = []
    const slots = cells.map((cell, i) => {
        const bar = Math.floor(i / perBar)
        if (chords.length <= bar)
            chords.push(cell.getAttribute('data-mn-chord') ?? chords[bar - 1] ?? null)
        const notes: PickedNote[] = []
        const thumb: boolean[] = []
        for (const part of (cell.getAttribute('data-mn-notes') ?? '').split(' ').filter(Boolean)) {
            const [string, fret, midi, p] = part.split(':')
            const note = { string: Number(string), fret: Number(fret), midi: Number(midi) }
            if (![note.string, note.fret, note.midi].every(Number.isFinite)) continue
            notes.push(note)
            thumb.push(p === 'p')
        }
        return { notes, thumb }
    })
    const swing = Number(drawing.getAttribute('data-mn-swing'))
    return {
        slots,
        slotsPerBeat,
        beatsPerBar,
        slotsPerPulse: isCompound(beatsPerBar, beatUnit) ? slotsPerBeat * 3 : slotsPerBeat,
        swing: swing > 0.5 && swing < 1 && slotsPerBeat % 2 === 0 ? swing : null,
        chords
    }
}

export function pickingBarFor(
    doc: Document,
    win: Window,
    drawing: Element,
    options: PlayOptions
): () => void {
    const score = pickingScoreFromDrawing(drawing)
    if (!score) return () => {}
    return timedBarFor(doc, win, drawing, options, {
        cls: 'mn-strum-playable mn-picking-playable',
        label: 'Play the picking pattern',
        compound: score.slotsPerPulse > score.slotsPerBeat,
        click: false,
        make: (s, first, id) =>
            pickingEvents(score, {
                bpm: s.bpm,
                countIn: first && s.countIn,
                click: (s as ProgressionSettings).click,
                tail: s.loop ? 0 : 1.2,
                seed: id
            })
    })
}
