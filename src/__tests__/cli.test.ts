import { describe, expect, it } from "vitest";

import { parseInteger, renderPlist } from "../cli.js";

describe("parseInteger", () => {
  it("parses valid integer", () => {
    expect(parseInteger("9", "--hour", 0, 23)).toBe(9);
  });

  it("parses zero", () => {
    expect(parseInteger("0", "--hour", 0, 23)).toBe(0);
  });

  it("parses max boundary", () => {
    expect(parseInteger("23", "--hour", 0, 23)).toBe(23);
  });

  it("parses minute range correctly", () => {
    expect(parseInteger("30", "--minute", 0, 59)).toBe(30);
  });

  it("renders a plist with the configured schedule and paths", () => {
    const plist = renderPlist(
      { hour: 14, minute: 30 },
      {
        checkerTargetPath: "/tmp/skillwatch/checker.js",
        stderrPath: "/tmp/skillwatch/stderr.log",
        stdoutPath: "/tmp/skillwatch/stdout.log",
      },
      "/usr/local/bin/node"
    );

    expect(plist).toContain("<string>com.mblode.skillwatch</string>");
    expect(plist).toContain("<string>/usr/local/bin/node</string>");
    expect(plist).toContain("<string>/tmp/skillwatch/checker.js</string>");
    expect(plist).toContain("<integer>14</integer>");
    expect(plist).toContain("<integer>30</integer>");
    expect(plist).not.toContain("__NODE_BIN__");
  });
});
