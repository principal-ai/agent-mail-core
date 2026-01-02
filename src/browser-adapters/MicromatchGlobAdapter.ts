import micromatch from "micromatch";
import type { GlobAdapter, GlobOptions } from "../core/abstractions/glob.js";
import type { StorageAdapter } from "../core/abstractions/storage.js";

/**
 * Micromatch-based glob adapter for browser environments.
 *
 * Uses the micromatch library for full glob pattern support.
 * Since browsers can't walk the filesystem directly, this adapter
 * can optionally work with a StorageAdapter to find files.
 */
export class MicromatchGlobAdapter implements GlobAdapter {
  private storage: StorageAdapter | null;

  /**
   * Create a new MicromatchGlobAdapter.
   *
   * @param storage - Optional storage adapter for findFiles functionality.
   *                  If not provided, findFiles will return an empty array.
   */
  constructor(storage?: StorageAdapter) {
    this.storage = storage ?? null;
  }

  async findFiles(patterns: string[], options?: GlobOptions): Promise<string[]> {
    if (!this.storage) {
      // Without storage, we can't enumerate files
      return [];
    }

    const cwd = options?.cwd ?? "";
    const ignore = options?.ignore ?? [];

    // Recursively get all files from storage
    const allFiles = await this.getAllFiles(cwd);

    // Filter files by patterns
    const matched = micromatch(allFiles, patterns, {
      ignore,
      dot: true,
    });

    if (options?.absolute && cwd) {
      return matched.map((f) => `${cwd}/${f}`);
    }

    return matched;
  }

  matches(pattern: string, path: string): boolean {
    return micromatch.isMatch(path, pattern, { dot: true });
  }

  /**
   * Recursively get all files from storage.
   */
  private async getAllFiles(dir: string, prefix: string = ""): Promise<string[]> {
    if (!this.storage) return [];

    const files: string[] = [];

    try {
      // Use "." for root if dir is empty
      const entries = await this.storage.readDir(dir || ".");

      for (const entry of entries) {
        const fullPath = this.storage.join(dir || ".", entry);
        const relativePath = prefix ? `${prefix}/${entry}` : entry;

        // Check if it's a directory
        const isDir = await this.storage.isDirectory(fullPath);
        if (isDir) {
          const subFiles = await this.getAllFiles(fullPath, relativePath);
          files.push(...subFiles);
        } else {
          files.push(relativePath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return files;
  }
}
