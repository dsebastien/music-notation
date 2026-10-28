// Stylesheets are imported as text (Bun `with { type: 'text' }`) and injected at runtime.
declare module '*.css' {
    const css: string
    export default css
}
