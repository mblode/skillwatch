import { describe, expect, it } from "vitest";

import {
  buildNotificationBody,
  buildSignature,
  findFolderHashInTree,
  getRepoId,
  groupUpdatesByRepo,
} from "../checker.js";

describe("getRepoId", () => {
  it("extracts owner/repo from source field", () => {
    expect(getRepoId({ source: "owner/repo" })).toBe("owner/repo");
  });

  it("strips .git suffix from source field", () => {
    expect(getRepoId({ source: "owner/repo.git" })).toBe("owner/repo");
  });

  it("extracts from SSH sourceUrl", () => {
    expect(getRepoId({ sourceUrl: "git@github.com:owner/repo.git" })).toBe(
      "owner/repo"
    );
  });

  it("extracts from SSH sourceUrl without .git", () => {
    expect(getRepoId({ sourceUrl: "git@github.com:owner/repo" })).toBe(
      "owner/repo"
    );
  });

  it("extracts from HTTPS sourceUrl", () => {
    expect(getRepoId({ sourceUrl: "https://github.com/owner/repo.git" })).toBe(
      "owner/repo"
    );
  });

  it("extracts from HTTPS sourceUrl without .git", () => {
    expect(getRepoId({ sourceUrl: "https://github.com/owner/repo" })).toBe(
      "owner/repo"
    );
  });

  it("returns null for missing fields", () => {
    expect(getRepoId({})).toBeNull();
  });

  it("returns null for source without slash", () => {
    expect(getRepoId({ source: "noslash" })).toBeNull();
  });

  it("returns null for malformed sourceUrl", () => {
    expect(getRepoId({ sourceUrl: "not-a-url" })).toBeNull();
  });

  it("prefers source over sourceUrl", () => {
    expect(
      getRepoId({
        source: "owner/from-source",
        sourceUrl: "git@github.com:owner/from-url.git",
      })
    ).toBe("owner/from-source");
  });
});

describe("findFolderHashInTree", () => {
  const mockTree = {
    sha: "root-sha",
    tree: [
      { path: "skills/my-skill", sha: "abc123", type: "tree" },
      { path: "skills/other", sha: "def456", type: "tree" },
      { path: "README.md", sha: "readme-sha", type: "blob" },
    ],
  };

  it("returns sha for matching folder path", () => {
    expect(findFolderHashInTree(mockTree, "skills/my-skill")).toBe("abc123");
  });

  it("returns null for non-matching folder path", () => {
    expect(findFolderHashInTree(mockTree, "skills/nonexistent")).toBeNull();
  });

  it("returns root sha for empty folder path", () => {
    expect(findFolderHashInTree(mockTree, "")).toBe("root-sha");
  });

  it("strips SKILL.md suffix before matching", () => {
    expect(findFolderHashInTree(mockTree, "skills/my-skill/SKILL.md")).toBe(
      "abc123"
    );
  });

  it("returns null for null treeData", () => {
    expect(findFolderHashInTree(null, "skills/my-skill")).toBeNull();
  });

  it("returns null when tree array is missing", () => {
    expect(
      findFolderHashInTree(
        { sha: "abc" } as unknown as Parameters<typeof findFolderHashInTree>[0],
        "some/path"
      )
    ).toBeNull();
  });

  it("does not match blob entries", () => {
    expect(findFolderHashInTree(mockTree, "README.md")).toBeNull();
  });
});

describe("groupUpdatesByRepo", () => {
  it("groups updates by repoId", () => {
    const updates = [
      {
        localHash: "abc",
        remoteHash: "def",
        repoId: "a/b",
        skillName: "skill2",
      },
      {
        localHash: "abc",
        remoteHash: "def",
        repoId: "a/b",
        skillName: "skill1",
      },
      {
        localHash: "abc",
        remoteHash: "def",
        repoId: "c/d",
        skillName: "skill3",
      },
    ];

    const result = groupUpdatesByRepo(updates);

    expect(result).toEqual([
      { repoId: "a/b", skillNames: ["skill1", "skill2"] },
      { repoId: "c/d", skillNames: ["skill3"] },
    ]);
  });

  it("returns empty array for no updates", () => {
    expect(groupUpdatesByRepo([])).toEqual([]);
  });

  it("sorts repos alphabetically", () => {
    const updates = [
      {
        localHash: "abc",
        remoteHash: "def",
        repoId: "z/repo",
        skillName: "s1",
      },
      {
        localHash: "abc",
        remoteHash: "def",
        repoId: "a/repo",
        skillName: "s2",
      },
    ];

    const result = groupUpdatesByRepo(updates);

    expect(result[0].repoId).toBe("a/repo");
    expect(result[1].repoId).toBe("z/repo");
  });
});

describe("buildNotificationBody", () => {
  it("shows single repo", () => {
    const grouped = [{ repoId: "a/b", skillNames: ["s1", "s2"] }];
    expect(buildNotificationBody(grouped)).toBe("a/b (2)");
  });

  it("shows up to 3 repos", () => {
    const grouped = [
      { repoId: "a/b", skillNames: ["s1"] },
      { repoId: "c/d", skillNames: ["s2", "s3"] },
      { repoId: "e/f", skillNames: ["s4"] },
    ];
    expect(buildNotificationBody(grouped)).toBe("a/b (1), c/d (2), e/f (1)");
  });

  it("shows +N more for >3 repos", () => {
    const grouped = [
      { repoId: "a/b", skillNames: ["s1"] },
      { repoId: "c/d", skillNames: ["s2"] },
      { repoId: "e/f", skillNames: ["s3"] },
      { repoId: "g/h", skillNames: ["s4"] },
      { repoId: "i/j", skillNames: ["s5"] },
    ];
    expect(buildNotificationBody(grouped)).toBe(
      "a/b (1), c/d (1), e/f (1), +2 more"
    );
  });
});

describe("buildSignature", () => {
  it("returns deterministic hash", () => {
    const grouped = [{ repoId: "a/b", skillNames: ["s1"] }];
    const sig1 = buildSignature(grouped);
    const sig2 = buildSignature(grouped);
    expect(sig1).toBe(sig2);
  });

  it("returns different hash for different input", () => {
    const a = buildSignature([{ repoId: "a/b", skillNames: ["s1"] }]);
    const b = buildSignature([{ repoId: "c/d", skillNames: ["s2"] }]);
    expect(a).not.toBe(b);
  });

  it("returns a 64-char hex string", () => {
    const sig = buildSignature([{ repoId: "a/b", skillNames: ["s1"] }]);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});
