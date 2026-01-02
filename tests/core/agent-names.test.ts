import { describe, it, expect } from "vitest";
import {
  generateAgentName,
  validateAgentName,
  parseAgentName,
  ADJECTIVES,
  NOUNS,
} from "../../src/index.js";

describe("Agent Name Generation", () => {
  it("should generate a valid agent name", () => {
    const name = generateAgentName();
    expect(validateAgentName(name)).toBe(true);
  });

  it("should generate different names on multiple calls", () => {
    const names = new Set<string>();
    for (let i = 0; i < 100; i++) {
      names.add(generateAgentName());
    }
    // Should have generated at least 50 unique names in 100 tries
    expect(names.size).toBeGreaterThan(50);
  });

  it("should have 62 adjectives", () => {
    expect(ADJECTIVES.length).toBe(62);
  });

  it("should have 69 nouns", () => {
    expect(NOUNS.length).toBe(69);
  });

  it("should have 4,278 total combinations", () => {
    expect(ADJECTIVES.length * NOUNS.length).toBe(4278);
  });
});

describe("Agent Name Validation", () => {
  it("should validate correct names", () => {
    expect(validateAgentName("GreenLake")).toBe(true);
    expect(validateAgentName("SwiftFox")).toBe(true);
    expect(validateAgentName("RedMountain")).toBe(true);
    expect(validateAgentName("Stormy Storm")).toBe(false); // Space not allowed
  });

  it("should reject invalid names", () => {
    expect(validateAgentName("lowercase")).toBe(false);
    expect(validateAgentName("UPPERCASE")).toBe(false);
    expect(validateAgentName("Invalid Name")).toBe(false);
    expect(validateAgentName("Invalid123")).toBe(false);
    expect(validateAgentName("")).toBe(false);
  });

  it("should reject names with invalid adjective/noun combos", () => {
    expect(validateAgentName("BlueComputer")).toBe(false);
    expect(validateAgentName("HappyLake")).toBe(false);
  });
});

describe("Agent Name Parsing", () => {
  it("should parse valid names", () => {
    const result = parseAgentName("GreenLake");
    expect(result).toEqual({ adjective: "Green", noun: "Lake" });
  });

  it("should parse names with longer components", () => {
    const result = parseAgentName("CrimsonMountain");
    expect(result).toEqual({ adjective: "Crimson", noun: "Mountain" });
  });

  it("should return null for invalid names", () => {
    expect(parseAgentName("InvalidName")).toBeNull();
    expect(parseAgentName("lowercase")).toBeNull();
  });
});
