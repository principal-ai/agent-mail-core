/**
 * Storage adapter interface for file system operations.
 *
 * Provides an abstraction over file storage that works
 * across different environments (Node.js fs, IndexedDB, memory).
 *
 * Implementations:
 * - InMemoryStorageAdapter (test)
 * - IndexedDBStorageAdapter (browser)
 * - NodeStorageAdapter (node)
 */
export interface StorageAdapter {
  /**
   * Check if a file or directory exists at the given path
   */
  exists(path: string): Promise<boolean>;

  /**
   * Read the contents of a file as a string
   * @throws Error if file does not exist
   */
  readFile(path: string): Promise<string>;

  /**
   * Write content to a file, creating parent directories if needed
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Delete a file
   * @throws Error if file does not exist
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Create a directory and any necessary parent directories
   */
  createDir(path: string): Promise<void>;

  /**
   * List entries in a directory
   * @returns Array of filenames (not full paths)
   */
  readDir(path: string): Promise<string[]>;

  /**
   * Check if a path is a directory
   */
  isDirectory(path: string): Promise<boolean>;

  /**
   * Join path segments together
   */
  join(...paths: string[]): string;

  /**
   * Get the directory portion of a path
   */
  dirname(path: string): string;

  /**
   * Get the filename portion of a path
   */
  basename(path: string): string;
}
