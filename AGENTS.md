# AGENTS.md

`@dsebastien/music-notation`: parsers and renderers for music notation blocks (chord diagrams, keyboards, fretboards, ChordPro charts; tabs and scores with alphaTab in 0.2). Consumed by the Music Practice Obsidian plugin (`github.com/dsebastien/obsidian-music-practice`) through npm, and by Obsidian Publish sites through the browser bundle on jsDelivr.

## Session-start checklist

1. `documentation/Business Rules.md`: invariants. Never break one without the user's approval.
2. The latest `documentation/history/yyyy-mm-dd.md`.
3. Active plans in `documentation/plans/`.

## Documentation surfaces

- `README.md`: npm and GitHub landing page.
- `docs/`: user guide on GitHub Pages (block syntax, Publish, API). Keep in sync with every syntax change.
- `documentation/`: technical docs (business rules, architecture, plans, history). Plans never contain timing.

## Definition of done

- `bun run tsc`, `bun run lint` (zero warnings), `bun run test`, `bun run build` pass; new logic has `.spec.ts` coverage next to it.
- `docs/` and `README.md` reflect any change to block syntax or the API.
- Today's history file is updated.
- Visual changes are checked in a real Obsidian window (render through the bundle or the plugin's dev build) with a clipped screenshot; agents state when that check wasn't done.

## Rules

- No framework, no Obsidian dependency. Renderers take a `Document` (or a host element) and never touch the global `document` (lint enforces it): Obsidian popout windows and Publish need that.
- `renderBlock` never throws; user mistakes become an inline message saying what to write instead.
- Dependencies must be MIT-compatible, except alphaTab (MPL-2.0), which is used unmodified as a dependency. GPL packages (chordsheetjs, chordpro-parser) are excluded.
- Keep the core light: heavy data or engines (voicings, alphaTab) live behind their own entry points so consumers opt in.
- Commits: Conventional Commits, scopes `all`, `build`, `deps`, `docs`, `lib`, `release`. Never bypass hooks. End agent commits with the session line the harness provides.
- Hooks: `bun run setup` once per clone (config-based Git hooks: Prettier on staged files, commitlint).

## Releasing

1. Write the version's section in `CHANGELOG.md` (`## X.Y.Z (yyyy-mm-dd)`, plain language for users), commit, push, wait for CI to be green.
2. `gh workflow run release.yml -f version=X.Y.Z`: bumps `package.json`, commits `chore(release): X.Y.Z`, tags, publishes to npm with provenance (trusted publishing, no token) and creates the GitHub release with the browser bundle.
3. Publish sites pin the version in their `publish.js`: bump it there to roll out.

0.1.0 was published by hand (`npm publish --access public`): trusted publishing needs the package to exist. `prepublishOnly` validates and builds.
