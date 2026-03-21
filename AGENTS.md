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
- `./install.sh`
- `./install.sh --uninstall`

## Gotchas

- macOS only. `launchctl`, `plutil`, and `osascript` are required.
- `./install.sh` auto-builds if `dist/cli.js` is missing. You still need `npm install` first.
- Published package and CLI command are both `skillwatch`.
- `src/checker.ts` is the runtime source of truth for GitHub lookups, hash comparison, dedupe state, and notifications. Keep install logic thin.
- The LaunchAgent stores `process.execPath` at install time. If the Node path changes later, rerun `install`.
- `install.sh` is a compatibility wrapper around `dist/cli.js`; document behavior in the CLI, not in the shell script.
- Keep the `build:before` normalization hook in `tsdown.config.ts`. `tsdown@0.12.9` passes `define` and `inject` as top-level rolldown input options, which triggers warnings unless they are moved into `transform`.

## Conventions and Boundaries

- ESM only. Use `.js` extensions in relative imports under NodeNext.
- Keep importable modules side-effect free. `cli.ts` and `checker.ts` should only run `main()` when executed directly.
- Use `ultracite` for linting and formatting. Do not call `oxlint` or `oxfmt` directly.
- `tsdown` builds the distributable entrypoints and copies the LaunchAgent template into `dist/`.
- The only source files under `src/` are `cli.ts`, `checker.ts`, and tests. Do not document non-existent shared `types.ts` or `utils.ts`.

## References

- Agent-facing skill: `skills/skillwatch/SKILL.md`
- Local Claude notes: `.claude/CLAUDE.md`
