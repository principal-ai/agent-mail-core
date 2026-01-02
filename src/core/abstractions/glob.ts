/**
 * Options for glob file matching
 */
export interface GlobOptions {
  /** Working directory for relative patterns */
  cwd?: string;
  /** Patterns to exclude from results */
  ignore?: string[];
  /** Return absolute paths instead of relative */
  absolute?: boolean;
}

/**
 * Glob adapter interface for file pattern matching.
 *
 * Provides glob pattern matching for file reservations
 * and other file-based operations.
 *
 * Implementations:
 * - SimpleGlobAdapter (test) - Basic pattern matching
 * - MicromatchAdapter (browser) - micromatch library
 * - FastGlobAdapter (node) - fast-glob library
 */
export interface GlobAdapter {
  /**
   * Find files matching the given glob patterns
   *
   * @param patterns - Array of glob patterns (e.g., ["src/**\/*.ts", "!**\/test/**"])
   * @param options - Glob options
   * @returns Array of matching file paths
   *
   * @example
   * ```typescript
   * const files = await glob.findFiles(['src/**\/*.ts'], { cwd: '/project' });
   * // Returns: ['src/index.ts', 'src/utils/helper.ts', ...]
   * ```
   */
  findFiles(patterns: string[], options?: GlobOptions): Promise<string[]>;

  /**
   * Check if a path matches a glob pattern
   *
   * @param pattern - Glob pattern to test
   * @param path - File path to match against
   * @returns true if the path matches the pattern
   *
   * @example
   * ```typescript
   * glob.matches('src/**\/*.ts', 'src/index.ts'); // true
   * glob.matches('src/**\/*.ts', 'lib/index.ts'); // false
   * ```
   */
  matches(pattern: string, path: string): boolean;
}
