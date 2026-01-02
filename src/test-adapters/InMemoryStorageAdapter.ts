import type { StorageAdapter } from "../core/abstractions/storage.js";

/**
 * In-memory storage adapter for testing.
 *
 * Simulates a file system using a JavaScript Map.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    // Root always exists
    this.directories.add("/");
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);
    return this.files.has(normalized) || this.directories.has(normalized);
  }

  async readFile(path: string): Promise<string> {
    const normalized = this.normalizePath(path);
    const content = this.files.get(normalized);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const normalized = this.normalizePath(path);
    // Ensure parent directory exists
    const dir = this.dirname(normalized);
    if (dir && dir !== "/" && !this.directories.has(dir)) {
      await this.createDir(dir);
    }
    this.files.set(normalized, content);
  }

  async deleteFile(path: string): Promise<void> {
    const normalized = this.normalizePath(path);
    if (!this.files.has(normalized)) {
      throw new Error(`File not found: ${path}`);
    }
    this.files.delete(normalized);
  }

  async createDir(path: string): Promise<void> {
    const normalized = this.normalizePath(path);
    // Create all parent directories
    const parts = normalized.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = `${current}/${part}`;
      this.directories.add(current);
    }
  }

  async readDir(path: string): Promise<string[]> {
    const normalized = this.normalizePath(path);
    const entries = new Set<string>();

    // Find files in this directory
    for (const filePath of this.files.keys()) {
      if (this.dirname(filePath) === normalized) {
        entries.add(this.basename(filePath));
      }
    }

    // Find subdirectories
    for (const dirPath of this.directories) {
      const parent = this.dirname(dirPath);
      if (parent === normalized && dirPath !== normalized) {
        entries.add(this.basename(dirPath));
      }
    }

    return Array.from(entries).sort();
  }

  async isDirectory(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);
    return this.directories.has(normalized);
  }

  join(...paths: string[]): string {
    return this.normalizePath(paths.join("/"));
  }

  dirname(path: string): string {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash <= 0) return "/";
    return normalized.slice(0, lastSlash);
  }

  basename(path: string): string {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf("/");
    return normalized.slice(lastSlash + 1);
  }

  // --- Private helpers ---

  private normalizePath(path: string): string {
    // Remove leading/trailing whitespace
    path = path.trim();

    // Handle empty path
    if (!path || path === ".") return "/";

    // Split and filter empty parts
    const parts = path.split("/").filter(Boolean);

    // Handle .. and .
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === "..") {
        resolved.pop();
      } else if (part !== ".") {
        resolved.push(part);
      }
    }

    return "/" + resolved.join("/");
  }

  // --- Test helpers ---

  /**
   * Get all files (for testing)
   */
  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add("/");
  }
}
