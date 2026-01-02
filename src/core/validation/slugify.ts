/**
 * Convert a string to a URL-safe slug.
 *
 * - Converts to lowercase
 * - Replaces non-alphanumeric characters with hyphens
 * - Removes leading/trailing hyphens
 * - Collapses multiple hyphens
 * - Truncates to 64 characters
 *
 * @param input - String to slugify
 * @returns URL-safe slug
 *
 * @example
 * slugify("My Project Name")  // "my-project-name"
 * slugify("Hello, World!")    // "hello-world"
 * slugify("/path/to/repo")    // "path-to-repo"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

/**
 * Generate a UUID v4.
 *
 * Uses crypto.randomUUID if available, falls back to manual generation.
 *
 * @returns UUID v4 string
 */
export function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers and Node.js 19+)
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto?.randomUUID
  ) {
    return globalThis.crypto.randomUUID();
  }

  // Fallback implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current timestamp as ISO string.
 */
export function now(): string {
  return new Date().toISOString();
}
