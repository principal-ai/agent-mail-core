import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { IdbStorageAdapter } from "../../src/browser-adapters/IdbStorageAdapter.js";

describe("IdbStorageAdapter", () => {
  let storage: IdbStorageAdapter;

  beforeEach(async () => {
    storage = new IdbStorageAdapter("test-storage");
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.clear();
    await storage.close();
  });

  describe("writeFile / readFile", () => {
    it("should write and read a file", async () => {
      await storage.writeFile("test.txt", "Hello, World!");
      const content = await storage.readFile("test.txt");
      expect(content).toBe("Hello, World!");
    });

    it("should write and read a file in subdirectory", async () => {
      await storage.writeFile("src/index.ts", "export const x = 1;");
      const content = await storage.readFile("src/index.ts");
      expect(content).toBe("export const x = 1;");
    });

    it("should throw when reading non-existent file", async () => {
      await expect(storage.readFile("nonexistent.txt")).rejects.toThrow(
        /not found/
      );
    });

    it("should overwrite existing file", async () => {
      await storage.writeFile("test.txt", "First");
      await storage.writeFile("test.txt", "Second");
      const content = await storage.readFile("test.txt");
      expect(content).toBe("Second");
    });
  });

  describe("exists", () => {
    it("should return true for existing file", async () => {
      await storage.writeFile("test.txt", "content");
      expect(await storage.exists("test.txt")).toBe(true);
    });

    it("should return false for non-existent file", async () => {
      expect(await storage.exists("nonexistent.txt")).toBe(false);
    });

    it("should return true for existing directory", async () => {
      await storage.createDir("src/utils");
      expect(await storage.exists("src")).toBe(true);
      expect(await storage.exists("src/utils")).toBe(true);
    });
  });

  describe("deleteFile", () => {
    it("should delete a file", async () => {
      await storage.writeFile("test.txt", "content");
      await storage.deleteFile("test.txt");
      expect(await storage.exists("test.txt")).toBe(false);
    });
  });

  describe("createDir", () => {
    it("should create a directory", async () => {
      await storage.createDir("mydir");
      expect(await storage.exists("mydir")).toBe(true);
      expect(await storage.isDirectory("mydir")).toBe(true);
    });

    it("should create nested directories", async () => {
      await storage.createDir("a/b/c");
      expect(await storage.exists("a")).toBe(true);
      expect(await storage.exists("a/b")).toBe(true);
      expect(await storage.exists("a/b/c")).toBe(true);
    });
  });

  describe("readDir", () => {
    it("should list directory contents", async () => {
      await storage.writeFile("src/index.ts", "");
      await storage.writeFile("src/utils.ts", "");
      await storage.writeFile("src/lib/helper.ts", "");

      const entries = await storage.readDir("src");
      expect(entries).toContain("index.ts");
      expect(entries).toContain("utils.ts");
      expect(entries).toContain("lib");
    });

    it("should return empty array for empty directory", async () => {
      await storage.createDir("empty");
      const entries = await storage.readDir("empty");
      expect(entries).toEqual([]);
    });
  });

  describe("isDirectory", () => {
    it("should return true for directory", async () => {
      await storage.createDir("mydir");
      expect(await storage.isDirectory("mydir")).toBe(true);
    });

    it("should return false for file", async () => {
      await storage.writeFile("file.txt", "content");
      expect(await storage.isDirectory("file.txt")).toBe(false);
    });

    it("should return false for non-existent path", async () => {
      expect(await storage.isDirectory("nonexistent")).toBe(false);
    });
  });

  describe("join", () => {
    it("should join path segments", () => {
      expect(storage.join("a", "b", "c")).toBe("a/b/c");
    });

    it("should handle leading/trailing slashes", () => {
      expect(storage.join("/a/", "/b/", "/c/")).toBe("a/b/c");
    });

    it("should filter empty segments", () => {
      expect(storage.join("a", "", "b")).toBe("a/b");
    });
  });

  describe("dirname", () => {
    it("should return directory portion of path", () => {
      expect(storage.dirname("a/b/c.txt")).toBe("a/b");
    });

    it("should return empty string for root-level file", () => {
      expect(storage.dirname("file.txt")).toBe("");
    });
  });

  describe("basename", () => {
    it("should return filename portion of path", () => {
      expect(storage.basename("a/b/c.txt")).toBe("c.txt");
    });

    it("should return file itself for root-level file", () => {
      expect(storage.basename("file.txt")).toBe("file.txt");
    });
  });
});
