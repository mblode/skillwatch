# skillwatch

Daily macOS notifications when your installed agent skills have updates on GitHub.

## Install

```bash
npx skillwatch install
```

Runs daily at 09:00. Customise with `--hour 14 --minute 30`.

For frequent use, install globally with `npm install -g skillwatch`.

## Verify

```bash
npx skillwatch check-now
```

## Uninstall

```bash
npx skillwatch uninstall
```

## Troubleshooting

- **"No skill lock file found"** — run `npx skills` first so the lock file exists.
- **Node path changed** — rerun `npx skillwatch install` to update the LaunchAgent.

## License

[MIT](LICENSE.md)
