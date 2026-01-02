import { openDB, type IDBPDatabase } from "idb";
import type { StorageAdapter } from "../core/abstractions/storage.js";

/**
 * Schema for the IndexedDB storage database
 */
interface StorageDB {
  files: {
    key: string;
    value: {
      path: string;
      content: string;
      isDirectory: boolean;
      createdAt: number;
      updatedAt: number;
    };
  };
}

/**
 * IndexedDB-based storage adapter for browser environments.
 *
 * Provides a virtual file system stored in IndexedDB.
 */
export class IdbStorageAdapter implements StorageAdapter {
  private db: IDBPDatabase<StorageDB> | null = null;
  private dbName: string;

  constructor(dbName: string = "agent-mail-storage") {
    this.dbName = dbName;
  }

  /**
   * Initialize the IndexedDB database.
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<StorageDB>(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("files")) {
          const store = db.createObjectStore("files", { keyPath: "path" });
          store.createIndex("byPath", "path", { unique: true });
        }
      },
    });
  }

  /**
   * Close the database connection.
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async exists(path: string): Promise<boolean> {
    this.assertReady();
    const normalized = this.normalizePath(path);
    const entry = await this.db!.get("files", normalized);
    return entry !== undefined;
  }

  async readFile(path: string): Promise<string> {
    this.assertReady();
    const normalized = this.normalizePath(path);
    const entry = await this.db!.get("files", normalized);

    if (!entry) {
      throw new Error(`File not found: ${path}`);
    }
    if (entry.isDirectory) {
      throw new Error(`Cannot read directory as file: ${path}`);
    }

    return entry.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.assertReady();
    const normalized = this.normalizePath(path);

    // Ensure parent directory exists
    const parentDir = this.dirname(normalized);
    if (parentDir && parentDir !== normalized) {
      await this.createDir(parentDir);
    }

    const now = Date.now();
    const existing = await this.db!.get("files", normalized);

    await this.db!.put("files", {
      path: normalized,
      content,
      isDirectory: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async deleteFile(path: string): Promise<void> {
    this.assertReady();
    const normalized = this.normalizePath(path);
    await this.db!.delete("files", normalized);
  }

  async createDir(path: string): Promise<void> {
    this.assertReady();
    const normalized = this.normalizePath(path);

    // Create all parent directories
    const parts = normalized.split("/").filter(Boolean);
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = await this.db!.get("files", currentPath);

      if (!existing) {
        const now = Date.now();
        await this.db!.put("files", {
          path: currentPath,
          content: "",
          isDirectory: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  async readDir(path: string): Promise<string[]> {
    this.assertReady();
    const normalized = this.normalizePath(path);
    const prefix = normalized ? `${normalized}/` : "";

    const allEntries = await this.db!.getAll("files");
    const children: Set<string> = new Set();

    for (const entry of allEntries) {
      if (entry.path.startsWith(prefix) && entry.path !== normalized) {
        // Get the immediate child name
        const relativePath = entry.path.slice(prefix.length);
        const childName = relativePath.split("/")[0];
        if (childName) {
          children.add(childName);
        }
      }
    }

    return Array.from(children).sort();
  }

  async isDirectory(path: string): Promise<boolean> {
    this.assertReady();
    const normalized = this.normalizePath(path);
    const entry = await this.db!.get("files", normalized);
    return entry?.isDirectory ?? false;
  }

  join(...paths: string[]): string {
    return paths
      .map((p) => p.replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/");
  }

  dirname(path: string): string {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf("/");
    return lastSlash > 0 ? normalized.slice(0, lastSlash) : "";
  }

  basename(path: string): string {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf("/");
    return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  }

  /**
   * Clear all data (useful for testing).
   */
  async clear(): Promise<void> {
    this.assertReady();
    await this.db!.clear("files");
  }

  private normalizePath(path: string): string {
    return path.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
  }

  private assertReady(): void {
    if (!this.db) {
      throw new Error("Storage not initialized. Call initialize() first.");
    }
  }
}
