---
name: skillwatch
description: Install or operate the macOS notifier that checks GitHub-backed installed skills for updates once per day. Use when the user wants to install, uninstall, or run skillwatch.
---

# skillwatch

Install or operate the macOS LaunchAgent that checks for outdated installed skills.

## Commands

| Command                                      | What it does                                               |
| -------------------------------------------- | ---------------------------------------------------------- |
| `skillwatch install [--hour N] [--minute N]` | Install the daily LaunchAgent and checker script           |
| `skillwatch check-now`                       | Run the checker immediately                                |
| `skillwatch uninstall`                       | Remove the installed LaunchAgent, checker script, and logs |

## Behavior

- Reads the skills lock file from `~/.agents/.skill-lock.json` or `$XDG_STATE_HOME/skills/.skill-lock.json`
- Checks GitHub-backed skill installs by comparing the stored `skillFolderHash` with the current GitHub tree hash
- Sends a macOS notification through `osascript` when updates are available
- Deduplicates repeat alerts until the update set changes
