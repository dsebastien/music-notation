import css from './styles.css' with { type: 'text' }

/** The library's stylesheet, for hosts that inject it themselves. */
export const STYLES: string = css

const STYLE_ID = 'music-notation-styles'

/** Add the stylesheet to a document once. */
export function injectStyles(doc: Document): void {
    if (doc.getElementById(STYLE_ID)) return
    const style = doc.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLES
    doc.head.appendChild(style)
}
