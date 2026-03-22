import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as p from "@clack/prompts";
import pc from "picocolors";

declare const __SKILLWATCH_PACKAGE_NAME__: string | undefined;
declare const __SKILLWATCH_PACKAGE_VERSION__: string | undefined;

const PACKAGE_NAME =
  typeof __SKILLWATCH_PACKAGE_NAME__ === "string"
    ? __SKILLWATCH_PACKAGE_NAME__
    : (process.env.npm_package_name ?? "skillwatch");
const PACKAGE_VERSION =
  typeof __SKILLWATCH_PACKAGE_VERSION__ === "string"
    ? __SKILLWATCH_PACKAGE_VERSION__
    : (process.env.npm_package_version ?? "0.0.0");

const ENTRYPOINT_PATH = fileURLToPath(import.meta.url);
const PACKAGE_DIR = dirname(ENTRYPOINT_PATH);
const CHECKER_SOURCE_PATH = join(PACKAGE_DIR, "checker.js");
const COMMAND_NAME = PACKAGE_NAME.split("/").at(-1) ?? "skillwatch";
const APP_DIR_NAME = "skillwatch";
const LEGACY_APP_DIR_NAME = "skills-update-notifier";

// --- Utilities ---

const fail = (message: string): never => {
  p.cancel(message);
  process.exit(1);
};

export const parseInteger = (
  value: string,
  flagName: string,
  min: number,
  max: number
): number => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    fail(`${flagName} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
};

// --- LaunchAgent management ---

interface InstallOptions {
  hour: number;
  minute: number;
}

interface PlistPaths {
  checkerTargetPath: string;
  stdoutPath: string;
  stderrPath: string;
}

const LABEL = "com.mblode.skillwatch";
const LEGACY_LABEL = "com.mblode.skills-check";

const getSupportDir = (dirName: string): string =>
  join(homedir(), "Library", "Application Support", dirName);

const getAppDir = (): string => getSupportDir(APP_DIR_NAME);

const getLegacyAppDir = (): string => getSupportDir(LEGACY_APP_DIR_NAME);

const getLogDirForName = (dirName: string): string =>
  join(homedir(), "Library", "Logs", dirName);

const getLogDir = (): string => getLogDirForName(APP_DIR_NAME);

const getLegacyLogDir = (): string => getLogDirForName(LEGACY_APP_DIR_NAME);

const getPlistTargetPath = (label = LABEL): string =>
  join(homedir(), "Library", "LaunchAgents", `${label}.plist`);

const assertMacOS = (): void => {
  if (process.platform !== "darwin") {
    fail(
      `${COMMAND_NAME} only supports macOS because it uses launchd and osascript.`
    );
  }
};

const requireCommand = (command: string): void => {
  try {
    execFileSync("which", [command], {
      stdio: "ignore",
    });
  } catch {
    fail(`Missing required command: ${command}`);
  }
};

const getUid = (): number => {
  if (typeof process.getuid !== "function") {
    fail("Could not determine the current user id.");
  }

  // Safe: guarded above, fail() returns never
  return (process.getuid as () => number)();
};

export const renderPlist = (
  options: InstallOptions,
  paths: PlistPaths,
  nodePath = process.execPath
): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
      <string>${nodePath}</string>
      <string>${paths.checkerTargetPath}</string>
    </array>

    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key>
      <integer>${options.hour}</integer>
      <key>Minute</key>
      <integer>${options.minute}</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>${paths.stdoutPath}</string>

    <key>StandardErrorPath</key>
    <string>${paths.stderrPath}</string>
  </dict>
</plist>
`;

const writePlist = async (
  options: InstallOptions,
  paths: PlistPaths
): Promise<void> => {
  const plistTargetPath = getPlistTargetPath();
  const content = renderPlist(options, paths);

  await mkdir(dirname(plistTargetPath), { recursive: true });
  await writeFile(plistTargetPath, content, "utf8");
};

const lintPlist = (): void => {
  execFileSync("plutil", ["-lint", getPlistTargetPath()], {
    stdio: "ignore",
  });
};

const bootoutIfLoaded = (label = LABEL): void => {
  try {
    execFileSync("launchctl", ["bootout", `gui/${getUid()}/${label}`], {
      stdio: "ignore",
    });
  } catch {
    // Ignore when the agent is not loaded.
  }
};

const bootstrapAgent = (): void => {
  execFileSync(
    "launchctl",
    ["bootstrap", `gui/${getUid()}`, getPlistTargetPath()],
    {
      stdio: "inherit",
    }
  );
};

// --- CLI commands ---

const printUsage = (): void => {
  p.intro(`${pc.bold(PACKAGE_NAME)} ${pc.dim(`v${PACKAGE_VERSION}`)}`);
  p.note(
    [
      `${pc.bold("Usage")}`,
      `  ${COMMAND_NAME} install [--hour 9] [--minute 0]`,
      `  ${COMMAND_NAME} uninstall`,
      `  ${COMMAND_NAME} check-now`,
      `  ${COMMAND_NAME} --help`,
      `  ${COMMAND_NAME} --version`,
      "",
      `${pc.bold("Commands")}`,
      `  install      Install the daily LaunchAgent and checker script`,
      `  uninstall    Remove the LaunchAgent, checker script, and logs`,
      `  check-now    Run the checker immediately`,
      "",
      `${pc.bold("Options for install")}`,
      `  --hour <0-23>     Daily check hour ${pc.dim("(default 9)")}`,
      `  --minute <0-59>   Daily check minute ${pc.dim("(default 0)")}`,
    ].join("\n"),
    "Help"
  );
};

const parseInstallOptions = (args: string[]): InstallOptions => {
  const options: InstallOptions = {
    hour: parseInteger(process.env.CHECK_HOUR ?? "9", "CHECK_HOUR", 0, 23),
    minute: parseInteger(
      process.env.CHECK_MINUTE ?? "0",
      "CHECK_MINUTE",
      0,
      59
    ),
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];

    if (current === "--help" || current === "-h") {
      printUsage();
      process.exit(0);
    }

    if (current === "--hour") {
      index += 1;
      options.hour = parseInteger(args[index] ?? "", "--hour", 0, 23);
      continue;
    }

    if (current === "--minute") {
      index += 1;
      options.minute = parseInteger(args[index] ?? "", "--minute", 0, 59);
      continue;
    }

    fail(`Unknown install option: ${current}`);
  }

  return options;
};

const installCommand = async (args: string[]): Promise<void> => {
  p.intro(`${pc.bold(COMMAND_NAME)} ${pc.dim("install")}`);
  assertMacOS();
  requireCommand("launchctl");
  requireCommand("plutil");

  const options = parseInstallOptions(args);
  const appDir = getAppDir();
  const logDir = getLogDir();
  const checkerTargetPath = join(appDir, "checker.js");

  await mkdir(appDir, { recursive: true });
  await mkdir(logDir, { recursive: true });

  const distFiles = await readdir(PACKAGE_DIR);

  await Promise.all(
    distFiles
      .filter((f) => f.endsWith(".js"))
      .map((f) => copyFile(join(PACKAGE_DIR, f), join(appDir, f)))
  );
  await writePlist(options, {
    checkerTargetPath,
    stderrPath: join(logDir, "stderr.log"),
    stdoutPath: join(logDir, "stdout.log"),
  });
  lintPlist();

  bootoutIfLoaded();
  bootstrapAgent();

  p.note(
    [
      `${pc.dim("agent")}   ${getPlistTargetPath()}`,
      `${pc.dim("script")}  ${checkerTargetPath}`,
      `${pc.dim("logs")}    ${logDir}`,
    ].join("\n"),
    "Installed files"
  );
  p.outro(
    `Run ${pc.bold(`npx ${COMMAND_NAME} check-now`)} to check immediately`
  );
};

const uninstallCommand = async (): Promise<void> => {
  p.intro(`${pc.bold(COMMAND_NAME)} ${pc.dim("uninstall")}`);
  assertMacOS();
  requireCommand("launchctl");

  bootoutIfLoaded();
  bootoutIfLoaded(LEGACY_LABEL);
  await rm(getPlistTargetPath(), { force: true });
  await rm(getPlistTargetPath(LEGACY_LABEL), { force: true });
  await rm(getAppDir(), { force: true, recursive: true });
  await rm(getLegacyAppDir(), { force: true, recursive: true });
  await rm(getLogDir(), { force: true, recursive: true });
  await rm(getLegacyLogDir(), { force: true, recursive: true });

  p.outro(`${COMMAND_NAME} has been uninstalled`);
};

const checkNowCommand = (): void => {
  assertMacOS();
  const appDir = getAppDir();
  const installedChecker = join(appDir, "checker.js");
  const checkerPath = existsSync(installedChecker)
    ? installedChecker
    : CHECKER_SOURCE_PATH;

  execFileSync(process.execPath, [checkerPath], {
    env: process.env,
    stdio: "inherit",
  });
};

const main = async (): Promise<void> => {
  const [rawCommand, ...rest] = process.argv.slice(2);
  const command = rawCommand === "--uninstall" ? "uninstall" : rawCommand;

  if (
    !command ||
    command === "--help" ||
    command === "-h" ||
    command === "help"
  ) {
    printUsage();
    return;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    console.log(PACKAGE_VERSION);
    return;
  }

  if (command === "install") {
    await installCommand(rest);
    return;
  }

  if (command === "uninstall") {
    await uninstallCommand();
    return;
  }

  if (command === "check-now") {
    checkNowCommand();
    return;
  }

  fail(`Unknown command: ${command}`);
};

const isExecutedDirectly = (): boolean => {
  const [, entryArg] = process.argv;

  return (
    entryArg !== undefined &&
    realpathSync(resolve(entryArg)) === ENTRYPOINT_PATH
  );
};

if (isExecutedDirectly()) {
  try {
    await main();
  } catch (error: unknown) {
    fail(error instanceof Error ? error.stack || error.message : String(error));
  }
}
