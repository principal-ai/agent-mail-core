import initSqlJs, { type Database } from "sql.js";
import type { DatabaseAdapter, RunResult } from "../core/abstractions/database.js";

/**
 * sql.js database adapter for testing.
 *
 * Uses WebAssembly SQLite for full SQL compatibility.
 */
export class SqlJsDatabaseAdapter implements DatabaseAdapter {
  private db: Database | null = null;
  private ready = false;

  async initialize(): Promise<void> {
    if (this.ready) return;

    const SQL = await initSqlJs();
    this.db = new SQL.Database();
    this.ready = true;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready && this.db !== null;
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    this.assertReady();

    try {
      this.db!.run(sql, params as (string | number | null | Uint8Array)[]);

      // Get last insert rowid and changes
      const lastIdResult = this.db!.exec("SELECT last_insert_rowid() as id");
      const changesResult = this.db!.exec("SELECT changes() as changes");

      const lastInsertRowid = lastIdResult[0]?.values[0]?.[0] as number ?? 0;
      const changes = changesResult[0]?.values[0]?.[0] as number ?? 0;

      return { lastInsertRowid, changes };
    } catch (error) {
      throw new Error(`SQL error: ${(error as Error).message}\nQuery: ${sql}`);
    }
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const results = await this.all<T>(sql, params);
    return results[0] ?? null;
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.assertReady();

    try {
      const result = this.db!.exec(sql, params as (string | number | null | Uint8Array)[]);

      if (result.length === 0) {
        return [];
      }

      const { columns, values } = result[0];
      return values.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj as T;
      });
    } catch (error) {
      throw new Error(`SQL error: ${(error as Error).message}\nQuery: ${sql}`);
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    this.assertReady();

    this.db!.run("BEGIN TRANSACTION");
    try {
      const result = await fn();
      this.db!.run("COMMIT");
      return result;
    } catch (error) {
      this.db!.run("ROLLBACK");
      throw error;
    }
  }

  async exec(sql: string): Promise<void> {
    this.assertReady();

    try {
      this.db!.run(sql);
    } catch (error) {
      throw new Error(`SQL error: ${(error as Error).message}\nQuery: ${sql}`);
    }
  }

  private assertReady(): void {
    if (!this.ready || !this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
  }
}
