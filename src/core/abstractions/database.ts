/**
 * Result from a database run operation (INSERT, UPDATE, DELETE)
 */
export interface RunResult {
  /** The rowid of the last inserted row */
  lastInsertRowid: number | bigint;
  /** Number of rows affected by the operation */
  changes: number;
}

/**
 * Database adapter interface for SQLite-like operations.
 *
 * Implementations:
 * - InMemoryDatabaseAdapter (test)
 * - SqlJsAdapter (browser)
 * - BetterSqlite3Adapter (node)
 */
export interface DatabaseAdapter {
  /**
   * Initialize the database connection and ensure schema exists
   */
  initialize(): Promise<void>;

  /**
   * Close the database connection
   */
  close(): Promise<void>;

  /**
   * Check if the database is ready for operations
   */
  isReady(): boolean;

  /**
   * Execute a SQL statement that modifies data (INSERT, UPDATE, DELETE)
   * @param sql - SQL statement with ? placeholders
   * @param params - Parameter values to bind
   * @returns Run result with lastInsertRowid and changes count
   */
  run(sql: string, params?: unknown[]): Promise<RunResult>;

  /**
   * Execute a SQL query and return the first matching row
   * @param sql - SQL SELECT statement with ? placeholders
   * @param params - Parameter values to bind
   * @returns First matching row or null
   */
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;

  /**
   * Execute a SQL query and return all matching rows
   * @param sql - SQL SELECT statement with ? placeholders
   * @param params - Parameter values to bind
   * @returns Array of matching rows
   */
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Execute multiple SQL statements within a transaction
   * @param fn - Async function containing database operations
   * @returns Result of the transaction function
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Execute raw SQL (typically for schema creation)
   * @param sql - SQL statement(s) to execute
   */
  exec(sql: string): Promise<void>;
}
