import { describe, expect, it } from "vitest";

import { parseInteger } from "../cli.js";

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
});
