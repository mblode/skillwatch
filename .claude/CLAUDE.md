# Local Agent Notes

Repo-specific overrides for local Claude sessions.

## Commands

- `npm run check` and `npm run fix` use Ultracite. Do not call `oxlint` or `oxfmt` directly.
- `npm run validate` is the full verification path.
- `npm run pack:dry-run` is the packaging check.
- Published CLI command is `skillwatch`.
- `./install.sh` auto-builds if `dist/cli.js` is missing. You still need `npm install` first.

## Boundaries

- `src/checker.ts` owns GitHub lookups, hash comparison, notification dedupe, and state writes.
- `src/cli.ts` owns install, uninstall, and `check-now`; keep it thin.
- `install.sh` is only a compatibility wrapper around `dist/cli.js`.
- The project is macOS-only. `launchctl`, `plutil`, and `osascript` are required.
