/**
 * Example Library — Pure functions (no pi API dependency)
 *
 * FOR PRODUCTION PLUGINS: Separate your business logic into a lib.ts
 * file that has NO dependency on @earendil-works/pi-coding-agent.
 * This makes your code:
 *
 * 1. Testable — pure functions can be unit-tested without mocking pi
 * 2. Reusable — logic can be used outside the plugin context
 * 3. Cleaner — index.ts only handles pi registration/glue code
 *
 * See pi-github/tools/pi-github/lib.ts for a production example.
 *
 * Run tests: npx vitest run
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// =============================================================================
// Types
// =============================================================================

export interface ExampleConfig {
  apiKey: string;
  endpoint: string;
}

// =============================================================================
// Constants
// =============================================================================

const CONFIG_FILE = path.join(os.homedir(), ".pi", "agent", "example-config.json");

// =============================================================================
// Config Persistence
// =============================================================================

/** Load config from disk. Returns empty config if file doesn't exist. */
export function loadConfig(): ExampleConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Corrupted config — return defaults
  }
  return { apiKey: "", endpoint: "https://api.example.com" };
}

/** Save config to disk. Parent directories are created if needed. */
export function saveConfig(config: ExampleConfig): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

// =============================================================================
// Validation
// =============================================================================

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate an email address. Returns error message or null. */
export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) return "Email is required";
  if (!EMAIL_PATTERN.test(email)) return `Invalid email format: "${email}"`;
  return null;
}

// =============================================================================
// Business Logic
// =============================================================================

/** Process a query — your actual domain logic goes here. */
export function processQuery(
  query: string,
  options?: { uppercase?: boolean; reverse?: boolean },
): { result: string; timestamp: number } {
  let result = query.trim();

  if (options?.uppercase) result = result.toUpperCase();
  if (options?.reverse) result = result.split("").reverse().join("");

  return {
    result,
    timestamp: Date.now(),
  };
}

/** Format a duration in milliseconds to a human-readable string. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);

  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
