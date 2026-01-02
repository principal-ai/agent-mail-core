/**
 * Lock adapter interface for concurrent access control.
 *
 * Provides a simple mutex-style lock for coordinating
 * access to shared resources across async operations.
 *
 * Implementations:
 * - NoOpLockAdapter (test) - Always succeeds immediately
 * - NavigatorLocksAdapter (browser) - Uses Web Locks API
 * - ProperLockfileAdapter (node) - Uses file-based locks
 */
export interface LockAdapter {
  /**
   * Acquire a named lock and execute a function while holding it.
   *
   * The lock is automatically released when the function completes
   * (successfully or with an error).
   *
   * @param name - Unique identifier for the lock
   * @param fn - Async function to execute while holding the lock
   * @returns Result of the function
   *
   * @example
   * ```typescript
   * const result = await lock.acquire('messages', async () => {
   *   // Critical section - only one caller at a time
   *   return await sendMessage(data);
   * });
   * ```
   */
  acquire<T>(name: string, fn: () => Promise<T>): Promise<T>;

  /**
   * Check if a lock is currently held
   * @param name - Lock identifier to check
   */
  isLocked(name: string): Promise<boolean>;
}
