import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as p from "@clack/prompts";
import pc from "picocolors";

// --- Types ---

interface LockFileEntry {
  sourceType?: string;
  source?: string;
  sourceUrl?: string;
  skillPath?: string;
  skillFolderHash?: string;
}

interface LockFile {
  skills?: Record<string, LockFileEntry>;
}

interface TrackedSkill {
  skillName: string;
  repoId: string;
  skillPath: string;
  localHash: string;
}

interface UpdateResult {
  repoId: string;
  skillName: string;
  localHash: string;
  remoteHash: string;
}

interface CheckError {
  repoId: string;
  skillName: string;
  reason: string;
}

interface CheckResult {
  trackedSkills: TrackedSkill[];
  updates: UpdateResult[];
  errors: CheckError[];
}

interface GroupedUpdate {
  repoId: string;
  skillNames: string[];
}

interface GitHubTreeEntry {
  path: string;
  type: string;
  sha: string;
}

interface GitHubTreeResponse {
  sha?: string;
  tree?: GitHubTreeEntry[];
}

interface GitHubRepoResponse {
  default_branch?: string;
}

// --- Utilities ---

const log = (message: string): void => {
  console.log(message);
};

const readJson = async <T>(path: string, fallback: T): Promise<T> => {
  try {
    const content = await readFile(path, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const normalizeSkillFolderPath = (skillPath: string): string =>
  skillPath
    .replaceAll("\\", "/")
    .replace(/\/?SKILL\.md$/, "")
    .replace(/\/$/, "");

// --- Config ---

const DEFAULT_STATE_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "skillwatch"
);
const ENTRYPOINT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_STATE_PATH = join(DEFAULT_STATE_DIR, "state.json");
const DEFAULT_LOCK_PATH = process.env.XDG_STATE_HOME
  ? join(process.env.XDG_STATE_HOME, "skills", ".skill-lock.json")
  : join(homedir(), ".agents", ".skill-lock.json");

const STATE_PATH = process.env.SKILLS_CHECK_STATE_PATH || DEFAULT_STATE_PATH;
const LOCK_PATH = process.env.SKILLS_CHECK_LOCK_PATH || DEFAULT_LOCK_PATH;

// --- GitHub API helpers ---

const getRepoId = (entry: LockFileEntry): string | null => {
  if (typeof entry?.source === "string" && entry.source.includes("/")) {
    return entry.source.replace(/\.git$/, "");
  }

  if (typeof entry?.sourceUrl === "string") {
    const sshMatch = entry.sourceUrl.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
    if (sshMatch?.[1]) {
      return sshMatch[1];
    }

    try {
      const pathname = new URL(entry.sourceUrl).pathname
        .replace(/^\/+/, "")
        .replace(/\.git$/, "");
      if (pathname.includes("/")) {
        return pathname;
      }
    } catch {
      // Ignore parse failures and fall through.
    }
  }

  return null;
};

const getGitHubToken = (): string | null => {
  const envToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (envToken) {
    return envToken;
  }

  const ghCandidates = [
    process.env.GH_PATH,
    "/opt/homebrew/bin/gh",
    "/usr/local/bin/gh",
    "gh",
  ].filter(Boolean) as string[];

  for (const candidate of ghCandidates) {
    try {
      const token = execFileSync(candidate, ["auth", "token"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      if (token) {
        return token;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
};

const fetchGitHubJson = async (
  url: string,
  token: string | null
): Promise<unknown> => {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skillwatch",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
};

const fetchRepoTree = async (
  ownerRepo: string,
  token: string | null
): Promise<GitHubTreeResponse | null> => {
  const repoData = (await fetchGitHubJson(
    `https://api.github.com/repos/${ownerRepo}`,
    token
  )) as GitHubRepoResponse | null;

  const branches = [repoData?.default_branch, "main", "master"].filter(
    Boolean
  ) as string[];
  const uniqueBranches = [...new Set(branches)];

  for (const branch of uniqueBranches) {
    const treeData = (await fetchGitHubJson(
      `https://api.github.com/repos/${ownerRepo}/git/trees/${branch}?recursive=1`,
      token
    )) as GitHubTreeResponse | null;

    if (treeData) {
      return treeData;
    }
  }

  return null;
};

const findFolderHashInTree = (
  treeData: GitHubTreeResponse | null,
  skillPath: string
): string | null => {
  const folderPath = normalizeSkillFolderPath(skillPath);

  if (!folderPath) {
    return treeData?.sha ?? null;
  }

  if (!Array.isArray(treeData?.tree)) {
    return null;
  }

  const folderEntry = treeData.tree.find(
    (entry: GitHubTreeEntry) =>
      entry.type === "tree" && entry.path === folderPath
  );
  return folderEntry?.sha ?? null;
};

// --- Notification helpers ---

const groupUpdatesByRepo = (updates: UpdateResult[]): GroupedUpdate[] => {
  const grouped = new Map<string, string[]>();

  for (const update of updates) {
    const existing = grouped.get(update.repoId) ?? [];
    existing.push(update.skillName);
    grouped.set(update.repoId, existing);
  }

  return [...grouped.entries()]
    .map(([repoId, skillNames]) => ({
      repoId,
      skillNames: skillNames.toSorted(),
    }))
    .toSorted((a, b) => a.repoId.localeCompare(b.repoId));
};

const buildNotificationBody = (grouped: GroupedUpdate[]): string => {
  const preview = grouped
    .slice(0, 3)
    .map(({ repoId, skillNames }) => `${repoId} (${skillNames.length})`);

  if (grouped.length > 3) {
    preview.push(`+${grouped.length - 3} more`);
  }

  return preview.join(", ");
};

const buildSignature = (grouped: GroupedUpdate[]): string =>
  createHash("sha256").update(JSON.stringify(grouped)).digest("hex");

const escapeAppleScript = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const sendNotification = (title: string, body: string): void => {
  execFileSync(
    "/usr/bin/osascript",
    [
      "-e",
      `display notification "${escapeAppleScript(body)}" with title "${escapeAppleScript(title)}"`,
    ],
    {
      stdio: "ignore",
    }
  );
};

const writeState = async (
  signature: string | null,
  grouped?: GroupedUpdate[]
): Promise<void> => {
  await writeJson(STATE_PATH, {
    lastCheckedAt: new Date().toISOString(),
    lastNotifiedSignature: signature,
    ...(grouped ? { updates: grouped } : {}),
  });
};

// --- Core checker logic ---

// Exported for tests
export {
  buildNotificationBody,
  buildSignature,
  findFolderHashInTree,
  getRepoId,
  groupUpdatesByRepo,
};

const getTrackedSkills = async (): Promise<TrackedSkill[]> => {
  const lockFile = await readJson<LockFile>(LOCK_PATH, { skills: {} });
  const tracked: TrackedSkill[] = [];

  for (const [skillName, entry] of Object.entries(lockFile.skills ?? {})) {
    if (entry?.sourceType !== "github") {
      continue;
    }

    if (!entry.skillPath || !entry.skillFolderHash) {
      continue;
    }

    const repoId = getRepoId(entry);
    if (!repoId) {
      continue;
    }

    tracked.push({
      localHash: entry.skillFolderHash,
      repoId,
      skillName,
      skillPath: entry.skillPath,
    });
  }

  return tracked;
};

const findUpdates = async (): Promise<CheckResult> => {
  const trackedSkills = await getTrackedSkills();
  const token = getGitHubToken();
  const updates: UpdateResult[] = [];
  const errors: CheckError[] = [];
  const treeCache = new Map<
    string,
    Awaited<ReturnType<typeof fetchRepoTree>>
  >();

  for (const tracked of trackedSkills) {
    let treeData = treeCache.get(tracked.repoId);

    if (treeData === undefined) {
      treeData = await fetchRepoTree(tracked.repoId, token);
      treeCache.set(tracked.repoId, treeData);
    }

    const remoteHash = treeData
      ? findFolderHashInTree(treeData, tracked.skillPath)
      : null;

    if (!remoteHash) {
      errors.push({
        reason: "Could not fetch remote folder hash",
        repoId: tracked.repoId,
        skillName: tracked.skillName,
      });
      continue;
    }

    if (remoteHash !== tracked.localHash) {
      updates.push({
        localHash: tracked.localHash,
        remoteHash,
        repoId: tracked.repoId,
        skillName: tracked.skillName,
      });
    }
  }

  return { errors, trackedSkills, updates };
};

const promptAndUpdate = async (
  signature: string,
  grouped: GroupedUpdate[]
): Promise<void> => {
  const shouldUpdate = await p.confirm({
    message: "Update skills now?",
  });

  if (p.isCancel(shouldUpdate)) {
    p.cancel("Cancelled");
    await writeState(signature, grouped);
    process.exitCode = 0;
    return;
  }

  if (shouldUpdate) {
    const updateSpinner = p.spinner();
    updateSpinner.start("Updating skills...");

    try {
      execFileSync("npx", ["skills", "update"], { stdio: "pipe" });
      updateSpinner.stop("Skills updated successfully");
    } catch {
      updateSpinner.stop("Update failed");
      p.log.error(`Run manually: ${pc.bold("npx skills update")}`);
    }

    await writeState(null);
    p.outro("Done");
    return;
  }

  sendNotification("Skill updates available", buildNotificationBody(grouped));
  await writeState(signature, grouped);
  p.outro("Done");
};

const main = async (): Promise<void> => {
  const tty = p.isTTY(process.stdout);

  if (tty) {
    p.intro(pc.bold("skillwatch"));
  }

  const info = tty ? (m: string) => p.log.info(m) : log;
  const warn = tty
    ? (m: string) => p.log.warn(m)
    : (m: string) => log(`Warning: ${m}`);
  const success = tty ? (m: string) => p.log.success(m) : log;

  info(`Lock file: ${pc.dim(LOCK_PATH)}`);
  info(`State file: ${pc.dim(STATE_PATH)}`);

  if (!existsSync(LOCK_PATH)) {
    warn("No skill lock file found. Nothing to check.");
    if (tty) {
      p.outro("Done");
    }
    process.exitCode = 0;
    return;
  }

  const s = tty ? p.spinner() : null;
  s?.start("Checking for skill updates...");

  const { trackedSkills, updates, errors } = await findUpdates();
  const grouped: GroupedUpdate[] = groupUpdatesByRepo(updates);

  if (tty) {
    s?.stop(
      `Tracked ${pc.bold(String(trackedSkills.length))} GitHub-backed skill(s)`
    );
  } else {
    log(`Tracked ${trackedSkills.length} GitHub-backed skill(s).`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      warn(`${error.repoId}/${error.skillName} - ${error.reason}`);
    }
  }

  if (grouped.length === 0) {
    success("No updates available.");
    await writeState(null);
    if (tty) {
      p.outro("All skills are up to date");
    }
    process.exitCode = 0;
    return;
  }

  for (const repo of grouped) {
    info(
      `Update available: ${pc.bold(repo.repoId)} ${pc.dim("->")} ${repo.skillNames.join(", ")}`
    );
  }

  const signature = buildSignature(grouped);

  if (tty) {
    await promptAndUpdate(signature, grouped);
    return;
  }

  const state = await readJson<{ lastNotifiedSignature?: string }>(
    STATE_PATH,
    {}
  );

  if (state.lastNotifiedSignature === signature) {
    log("Updates already notified. Skipping duplicate notification.");
    await writeState(signature, grouped);
    process.exitCode = 0;
    return;
  }

  const body = buildNotificationBody(grouped);

  sendNotification("Skill updates available", body);
  log(`Notification sent: ${body}`);
  log("To update installed skills, run: npx skills update");

  await writeState(signature, grouped);
};

const isExecutedDirectly = (): boolean => {
  const [, entryArg] = process.argv;

  return entryArg !== undefined && resolve(entryArg) === ENTRYPOINT_PATH;
};

if (isExecutedDirectly()) {
  try {
    await main();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.stack || error.message : String(error);

    if (p.isTTY(process.stdout)) {
      p.log.error(message);
      p.outro("Check failed");
    } else {
      log(`Fatal error: ${message}`);
    }

    process.exitCode = 1;
  }
}
