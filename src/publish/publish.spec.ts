import { afterEach, describe, expect, it } from 'bun:test'
import { autoRender, renderAll } from './index.js'

const block = (language: string, source: string) => {
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.className = `language-${language}`
    code.textContent = source
    pre.appendChild(code)
    return pre
}

afterEach(() => {
    document.body.innerHTML = ''
})

describe('renderAll', () => {
    it('renders notation blocks once and hides their source', () => {
        const pre = block('chord', 'A x02220')
        document.body.append(pre, block('js', 'let a = 1'))
        expect(renderAll(document)).toBe(1)
        expect(pre.style.display).toBe('none')
        expect(pre.dataset['mpRendered']).toBe('done')
        expect(pre.nextElementSibling?.classList.contains('mn-block-chord')).toBe(true)
        expect(renderAll(document)).toBe(0)
        expect(document.querySelectorAll('.mn-block')).toHaveLength(1)
    })

    it('keeps the source visible when a block has an error', () => {
        const pre = block('chord', 'A')
        document.body.append(pre)
        expect(renderAll(document)).toBe(0)
        expect(pre.style.display).toBe('')
        expect(pre.dataset['mpRendered']).toBe('error')
        expect(document.querySelector('.mn-error')).not.toBeNull()
        renderAll(document)
        expect(document.querySelectorAll('.mn-error')).toHaveLength(1)
    })

    it('draws a row with a broken diagram and keeps its source visible', () => {
        const pre = block('chord', 'G 320003\n---\nC x3201a\n---\nD xx0232')
        document.body.append(pre)
        expect(renderAll(document)).toBe(0)
        expect(pre.style.display).toBe('')
        expect(pre.dataset['mpRendered']).toBe('error')
        expect(document.querySelectorAll('.mn-row .mn-guitar-chord')).toHaveLength(2)
    })

    it('passes the layout defaults on', () => {
        document.body.append(block('fretboard', 'C major\nfrets: 0-3'))
        renderAll(document, { orientation: { fretboard: 'vertical' } })
        const [, , w, h] = document
            .querySelector('.mn-fretboard')!
            .getAttribute('viewBox')!
            .split(' ')
            .map(Number)
        expect(h).toBeGreaterThan(w!)
    })
})

describe('renderAll after the page changed', () => {
    it('renders again when its rendering was removed', () => {
        const pre = block('chord', 'A x02220')
        document.body.append(pre)
        renderAll(document)
        document.querySelector('.mn-block')!.remove()
        expect(renderAll(document)).toBe(1)
        expect(document.querySelectorAll('.mn-block')).toHaveLength(1)
    })

    it('renders again when the source changed in place', () => {
        const pre = block('chord', 'A x02220')
        document.body.append(pre)
        renderAll(document)
        pre.querySelector('code')!.textContent = 'D xx0232'
        expect(renderAll(document)).toBe(1)
        expect(document.querySelectorAll('.mn-block')).toHaveLength(1)
        expect(document.querySelector('.mn-title')?.textContent).toBe('D')
    })

    it('shows the source again when an edit breaks the block', () => {
        const pre = block('chord', 'A x02220')
        document.body.append(pre)
        renderAll(document)
        pre.querySelector('code')!.textContent = 'A'
        renderAll(document)
        expect(pre.style.display).toBe('')
        expect(document.querySelectorAll('.mn-block')).toHaveLength(1)
    })
})

describe('autoRender', () => {
    it('renders blocks added later', async () => {
        const stop = autoRender(document)
        const pre = block('keyboard', 'chord: C')
        document.body.append(pre)
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(pre.dataset['mpRendered']).toBe('done')
        stop()
        const late = block('keyboard', 'chord: D')
        document.body.append(late)
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(late.dataset['mpRendered']).toBeUndefined()
    })
})
