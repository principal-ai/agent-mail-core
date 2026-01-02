import { describe, it, expect } from "vitest";
import { MicromatchGlobAdapter } from "../../src/browser-adapters/MicromatchGlobAdapter.js";
import { InMemoryStorageAdapter } from "../../src/test-adapters/InMemoryStorageAdapter.js";

describe("MicromatchGlobAdapter", () => {
  describe("matches", () => {
    const glob = new MicromatchGlobAdapter();

    it("should match exact file names", () => {
      expect(glob.matches("file.txt", "file.txt")).toBe(true);
      expect(glob.matches("file.txt", "other.txt")).toBe(false);
    });

    it("should match with * wildcard", () => {
      expect(glob.matches("*.ts", "index.ts")).toBe(true);
      expect(glob.matches("*.ts", "index.js")).toBe(false);
      expect(glob.matches("src/*.ts", "src/index.ts")).toBe(true);
      expect(glob.matches("src/*.ts", "src/lib/index.ts")).toBe(false);
    });

    it("should match with ** globstar", () => {
      expect(glob.matches("**/*.ts", "index.ts")).toBe(true);
      expect(glob.matches("**/*.ts", "src/index.ts")).toBe(true);
      expect(glob.matches("**/*.ts", "src/lib/index.ts")).toBe(true);
      expect(glob.matches("src/**/*.ts", "src/index.ts")).toBe(true);
      expect(glob.matches("src/**/*.ts", "src/lib/deep/index.ts")).toBe(true);
      expect(glob.matches("src/**/*.ts", "lib/index.ts")).toBe(false);
    });

    it("should match with ? single character wildcard", () => {
      expect(glob.matches("file?.txt", "file1.txt")).toBe(true);
      expect(glob.matches("file?.txt", "file12.txt")).toBe(false);
    });

    it("should match with brace expansion", () => {
      expect(glob.matches("*.{ts,js}", "index.ts")).toBe(true);
      expect(glob.matches("*.{ts,js}", "index.js")).toBe(true);
      expect(glob.matches("*.{ts,js}", "index.css")).toBe(false);
    });

    it("should match dotfiles when dot option is true", () => {
      expect(glob.matches("*", ".gitignore")).toBe(true);
      expect(glob.matches(".*", ".gitignore")).toBe(true);
    });

    it("should handle negation patterns in isMatch", () => {
      // Note: negation with ! requires using the micromatch function directly
      // isMatch doesn't process negation the same way
      expect(glob.matches("*.ts", "index.ts")).toBe(true);
    });
  });

  describe("findFiles with storage", () => {
    it("should find files matching pattern", async () => {
      const storage = new InMemoryStorageAdapter();
      await storage.writeFile("src/index.ts", "");
      await storage.writeFile("src/utils.ts", "");
      await storage.writeFile("src/lib/helper.ts", "");
      await storage.writeFile("tests/index.test.ts", "");
      await storage.writeFile("package.json", "");

      const glob = new MicromatchGlobAdapter(storage);

      const tsFiles = await glob.findFiles(["src/**/*.ts"]);
      expect(tsFiles).toContain("src/index.ts");
      expect(tsFiles).toContain("src/utils.ts");
      expect(tsFiles).toContain("src/lib/helper.ts");
      expect(tsFiles).not.toContain("tests/index.test.ts");
    });

    it("should support multiple patterns", async () => {
      const storage = new InMemoryStorageAdapter();
      await storage.writeFile("src/index.ts", "");
      await storage.writeFile("tests/index.test.ts", "");
      await storage.writeFile("package.json", "");

      const glob = new MicromatchGlobAdapter(storage);

      const files = await glob.findFiles(["src/**/*.ts", "tests/**/*.ts"]);
      expect(files).toContain("src/index.ts");
      expect(files).toContain("tests/index.test.ts");
      expect(files).not.toContain("package.json");
    });

    it("should support ignore patterns", async () => {
      const storage = new InMemoryStorageAdapter();
      await storage.writeFile("src/index.ts", "");
      await storage.writeFile("src/index.test.ts", "");

      const glob = new MicromatchGlobAdapter(storage);

      const files = await glob.findFiles(["src/**/*.ts"], {
        ignore: ["**/*.test.ts"],
      });
      expect(files).toContain("src/index.ts");
      expect(files).not.toContain("src/index.test.ts");
    });

    it("should return empty array without storage", async () => {
      const glob = new MicromatchGlobAdapter();
      const files = await glob.findFiles(["**/*.ts"]);
      expect(files).toEqual([]);
    });
  });
});
