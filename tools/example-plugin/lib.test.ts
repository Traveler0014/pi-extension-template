/**
 * Unit tests for example plugin library
 *
 * Demonstrates the testing strategy for pi extensions:
 * - Pure functions tested without any pi mock
 * - Integration tests (optional) gated behind env vars
 * - Vitest is the recommended test runner
 *
 * Run: npx vitest run
 */

import { describe, expect, it } from "vitest";
import {
  loadConfig,
  validateEmail,
  processQuery,
  formatDuration,
} from "./lib";

// =============================================================================
// validateEmail
// =============================================================================

describe("validateEmail", () => {
  it("returns null for valid emails", () => {
    expect(validateEmail("user@example.com")).toBeNull();
    expect(validateEmail("a@b.co")).toBeNull();
    expect(validateEmail("test.user+tag@domain.io")).toBeNull();
  });

  it("returns error for empty email", () => {
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("   ")).toBe("Email is required");
  });

  it("returns error for invalid format", () => {
    expect(validateEmail("not-an-email")).toContain("Invalid email");
    expect(validateEmail("@missing-user.com")).toContain("Invalid email");
    expect(validateEmail("missing-domain@")).toContain("Invalid email");
  });
});

// =============================================================================
// processQuery
// =============================================================================

describe("processQuery", () => {
  it("returns trimmed input by default", () => {
    const { result } = processQuery("  hello  ");
    expect(result).toBe("hello");
  });

  it("uppercases when flag is set", () => {
    const { result } = processQuery("hello", { uppercase: true });
    expect(result).toBe("HELLO");
  });

  it("reverses when flag is set", () => {
    const { result } = processQuery("abc", { reverse: true });
    expect(result).toBe("cba");
  });

  it("can combine options", () => {
    const { result } = processQuery("hello", {
      uppercase: true,
      reverse: true,
    });
    expect(result).toBe("OLLEH");
  });

  it("includes timestamp in result", () => {
    const before = Date.now();
    const { timestamp } = processQuery("test");
    const after = Date.now();
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// =============================================================================
// formatDuration
// =============================================================================

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(65000)).toBe("1m 5s");
  });

  it("formats hours", () => {
    expect(formatDuration(3661000)).toBe("1h 1m 1s");
  });
});

// =============================================================================
// loadConfig
// =============================================================================

describe("loadConfig", () => {
  it("returns default config when file does not exist", () => {
    const config = loadConfig();
    expect(config).toHaveProperty("apiKey");
    expect(config).toHaveProperty("endpoint");
    expect(config.endpoint).toBe("https://api.example.com");
  });
});
