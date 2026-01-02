import type { LockAdapter } from "../core/abstractions/lock.js";

/**
 * No-op lock adapter for testing.
 *
 * Always succeeds immediately - suitable for single-threaded test environments
 * where no actual locking is needed.
 */
export class NoOpLockAdapter implements LockAdapter {
  private locks: Set<string> = new Set();

  async acquire<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.locks.add(name);
    try {
      return await fn();
    } finally {
      this.locks.delete(name);
    }
  }

  async isLocked(name: string): Promise<boolean> {
    return this.locks.has(name);
  }

  // --- Test helpers ---

  /**
   * Get all currently held locks (for testing)
   */
  getHeldLocks(): string[] {
    return Array.from(this.locks);
  }
}
