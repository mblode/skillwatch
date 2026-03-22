# skillwatch

Published npm package and macOS LaunchAgent installer for daily skill update notifications.

## Commands

- `npm install`
- `npm run build`
- `npm run typecheck`
- `npm run check`
- `npm run test`
- `npm run smoke`
- `npm run validate`
- `npm run pack:dry-run`
- `npx skillwatch install`
- `npx skillwatch check-now`
- `npx skillwatch uninstall`
- `node dist/cli.js install`
- `node dist/cli.js check-now`
- `node dist/cli.js uninstall`

## Gotchas

- macOS only. `launchctl`, `plutil`, and `osascript` are required.
- Published package and CLI command are both `skillwatch`.
- `src/checker.ts` is the runtime source of truth for GitHub lookups, hash comparison, dedupe state, and notifications. Keep install logic thin.
- The LaunchAgent stores `process.execPath` at install time. If the Node path changes later, rerun `install`.
- Keep the `build:before` normalization hook in `tsdown.config.ts`. `tsdown@0.12.9` passes `define` and `inject` as top-level rolldown input options, which triggers warnings unless they are moved into `transform`. The shebang banner must also be set via `buildOptions.output.banner` in this hook — tsdown silently ignores a top-level `banner` option.

## Conventions and Boundaries

- ESM only. Use `.js` extensions in relative imports under NodeNext.
- Keep importable modules side-effect free. `cli.ts` and `checker.ts` should only run `main()` when executed directly.
- Use `ultracite` for linting and formatting. Do not call `oxlint` or `oxfmt` directly.
- `tsdown` builds the distributable entrypoints, injects CLI package metadata, and inlines the LaunchAgent plist from `src/cli.ts`.
- The only source files under `src/` are `cli.ts`, `checker.ts`, and tests. Do not document non-existent shared `types.ts` or `utils.ts`.

## References

- Agent-facing skill: `skills/skillwatch/SKILL.md`
- Local Claude notes: `.claude/CLAUDE.md`
