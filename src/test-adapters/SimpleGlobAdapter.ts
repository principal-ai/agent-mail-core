import type { GlobAdapter, GlobOptions } from "../core/abstractions/glob.js";

/**
 * Simple glob adapter for testing.
 *
 * Implements basic glob pattern matching without external dependencies.
 * Supports: *, **, ?, [abc], [!abc]
 */
export class SimpleGlobAdapter implements GlobAdapter {
  private files: string[] = [];

  constructor(files: string[] = []) {
    this.files = files;
  }

  async findFiles(patterns: string[], options?: GlobOptions): Promise<string[]> {
    const cwd = options?.cwd ?? "";
    const ignore = options?.ignore ?? [];
    const absolute = options?.absolute ?? false;

    const matches = new Set<string>();

    for (const file of this.files) {
      // Normalize path relative to cwd
      const relativePath = cwd && file.startsWith(cwd)
        ? file.slice(cwd.length).replace(/^\//, "")
        : file;

      // Check if matches any pattern
      let matchesPattern = false;
      for (const pattern of patterns) {
        // Handle negation patterns
        if (pattern.startsWith("!")) {
          if (this.matches(pattern.slice(1), relativePath)) {
            matchesPattern = false;
            break;
          }
        } else if (this.matches(pattern, relativePath)) {
          matchesPattern = true;
        }
      }

      // Check ignore patterns
      if (matchesPattern) {
        let ignored = false;
        for (const ignorePattern of ignore) {
          if (this.matches(ignorePattern, relativePath)) {
            ignored = true;
            break;
          }
        }

        if (!ignored) {
          matches.add(absolute ? file : relativePath);
        }
      }
    }

    return Array.from(matches).sort();
  }

  matches(pattern: string, path: string): boolean {
    const regex = this.patternToRegex(pattern);
    return regex.test(path);
  }

  // --- Private helpers ---

  private patternToRegex(pattern: string): RegExp {
    let regexStr = "^";
    let i = 0;

    while (i < pattern.length) {
      const char = pattern[i];

      if (char === "*") {
        // Check for **
        if (pattern[i + 1] === "*") {
          // ** matches any path including /
          if (pattern[i + 2] === "/") {
            regexStr += "(?:.*\\/)?";
            i += 3;
          } else {
            regexStr += ".*";
            i += 2;
          }
        } else {
          // * matches any non-/ characters
          regexStr += "[^\\/]*";
          i++;
        }
      } else if (char === "?") {
        // ? matches any single non-/ character
        regexStr += "[^\\/]";
        i++;
      } else if (char === "[") {
        // Character class
        let j = i + 1;
        let classContent = "";
        let negated = false;

        if (pattern[j] === "!" || pattern[j] === "^") {
          negated = true;
          j++;
        }

        while (j < pattern.length && pattern[j] !== "]") {
          classContent += pattern[j];
          j++;
        }

        if (negated) {
          regexStr += `[^${this.escapeRegex(classContent)}]`;
        } else {
          regexStr += `[${this.escapeRegex(classContent)}]`;
        }
        i = j + 1;
      } else if (char === "/") {
        regexStr += "\\/";
        i++;
      } else {
        // Escape special regex characters
        regexStr += this.escapeRegex(char);
        i++;
      }
    }

    regexStr += "$";
    return new RegExp(regexStr);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.+^${}()|\\]/g, "\\$&");
  }

  // --- Test helpers ---

  /**
   * Set the list of available files (for testing)
   */
  setFiles(files: string[]): void {
    this.files = files;
  }

  /**
   * Add files to the list (for testing)
   */
  addFiles(files: string[]): void {
    this.files.push(...files);
  }
}
