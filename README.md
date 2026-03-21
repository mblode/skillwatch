# skillwatch

Daily macOS notifications when installed GitHub-backed skills have updates.

- Compares each installed skill's `skillFolderHash` with the current GitHub tree hash for that folder
- Installs a per-user LaunchAgent that runs once per day
- Deduplicates notifications until the update set changes

## Requirements

- macOS
- Node.js 22 or newer
- An existing skills lock file at `~/.agents/.skill-lock.json` or `$XDG_STATE_HOME/skills/.skill-lock.json`

## Install

```bash
npx skillwatch install
```

Default schedule is daily at `09:00` local time.

If you want the command installed permanently:

```bash
npm install -g skillwatch
skillwatch install
```

## Verify

```bash
npx skillwatch check-now
```

## Uninstall

```bash
npx skillwatch uninstall
```

If you installed the CLI globally and want to remove that too:

```bash
npm uninstall -g skillwatch
```

This removes the LaunchAgent, installed support files, state, and logs. The global uninstall only removes the CLI package.

## Custom Time

```bash
npx skillwatch install --hour 14 --minute 30
```

## What Gets Installed

- LaunchAgent: `~/Library/LaunchAgents/com.mblode.skillwatch.plist`
- Checker: `~/Library/Application Support/skillwatch/checker.js`
- State: `~/Library/Application Support/skillwatch/state.json`
- Logs: `~/Library/Logs/skillwatch/`

## Troubleshooting

- If you see `No skill lock file found`, run `skills` or `npx skills` first so the lock file exists.
- If your Node path changes later, rerun `npx skillwatch install` so the LaunchAgent points at the new `node` binary.
- This project is macOS-only and requires `launchctl`, `plutil`, and `osascript`.

## Local Development

Use the repo wrapper if you are working from source:

```bash
git clone https://github.com/mblode/update-skills.git
cd update-skills
npm install
./install.sh
```

`./install.sh` auto-builds `dist/` if needed and forwards to the built CLI.

Use the built CLI directly if you want to test the package output:

```bash
npm run build
node dist/cli.js install
node dist/cli.js check-now
node dist/cli.js uninstall
```

Install command options from `--help`:

```text
--hour <0-23>                    Daily check hour, default 9
--minute <0-59>                  Daily check minute, default 0
```

## Development

```bash
npm run validate
npm run pack:dry-run
```

## License

[MIT](LICENSE.md)
