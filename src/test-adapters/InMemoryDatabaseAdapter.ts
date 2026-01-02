import type { DatabaseAdapter, RunResult } from "../core/abstractions/database.js";

/**
 * In-memory database adapter for testing.
 *
 * Simulates SQLite-like operations using JavaScript Maps.
 * Supports basic CRUD operations and simple WHERE clauses.
 */
export class InMemoryDatabaseAdapter implements DatabaseAdapter {
  private tables: Map<string, Map<number, Record<string, unknown>>> = new Map();
  private sequences: Map<string, number> = new Map();
  private ready = false;

  async initialize(): Promise<void> {
    this.ready = true;
  }

  async close(): Promise<void> {
    this.tables.clear();
    this.sequences.clear();
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready;
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const normalized = sql.trim().toUpperCase();

    if (normalized.startsWith("INSERT")) {
      return this.handleInsert(sql, params);
    } else if (normalized.startsWith("UPDATE")) {
      return this.handleUpdate(sql, params);
    } else if (normalized.startsWith("DELETE")) {
      return this.handleDelete(sql, params);
    }

    return { lastInsertRowid: 0, changes: 0 };
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const results = await this.all<T>(sql, params);
    return results[0] ?? null;
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const normalized = sql.trim().toUpperCase();

    if (!normalized.startsWith("SELECT")) {
      return [];
    }

    return this.handleSelect<T>(sql, params);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // Simple passthrough - no actual transaction support in memory
    return fn();
  }

  async exec(sql: string): Promise<void> {
    // Handle CREATE TABLE statements
    const createTableMatch = sql.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi
    );
    if (createTableMatch) {
      for (const match of createTableMatch) {
        const tableName = match
          .replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i, "")
          .trim();
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, new Map());
          this.sequences.set(tableName, 0);
        }
      }
    }
  }

  // --- Private helpers ---

  private handleInsert(sql: string, params: unknown[]): RunResult {
    // Parse: INSERT INTO table (col1, col2) VALUES (?, ?)
    const match = sql.match(
      /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i
    );
    if (!match) {
      return { lastInsertRowid: 0, changes: 0 };
    }

    const tableName = match[1];
    const columns = match[2].split(",").map((c) => c.trim());

    const table = this.tables.get(tableName);
    if (!table) {
      return { lastInsertRowid: 0, changes: 0 };
    }

    const id = (this.sequences.get(tableName) ?? 0) + 1;
    this.sequences.set(tableName, id);

    const row: Record<string, unknown> = { id };
    columns.forEach((col, i) => {
      row[col] = params[i];
    });

    table.set(id, row);

    return { lastInsertRowid: id, changes: 1 };
  }

  private handleUpdate(sql: string, params: unknown[]): RunResult {
    // Parse: UPDATE table SET col1 = ?, col2 = ? WHERE id = ?
    const match = sql.match(
      /UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i
    );
    if (!match) {
      return { lastInsertRowid: 0, changes: 0 };
    }

    const tableName = match[1];
    const setClause = match[2];
    const whereClause = match[3];

    const table = this.tables.get(tableName);
    if (!table) {
      return { lastInsertRowid: 0, changes: 0 };
    }

    // Parse SET clause
    const setParts = setClause.split(",").map((s) => s.trim());
    const setColumns: string[] = [];
    for (const part of setParts) {
      const colMatch = part.match(/(\w+)\s*=/);
      if (colMatch) {
        setColumns.push(colMatch[1]);
      }
    }

    // Parse WHERE clause for simple id = ? or compound conditions
    const whereValues = this.parseWhereClause(whereClause, params, setColumns.length);

    let changes = 0;
    for (const [_id, row] of table) {
      if (this.rowMatchesWhere(row, whereValues)) {
        setColumns.forEach((col, i) => {
          row[col] = params[i];
        });
        changes++;
      }
    }

    return { lastInsertRowid: 0, changes };
  }

  private handleDelete(sql: string, params: unknown[]): RunResult {
    // Parse: DELETE FROM table WHERE id = ?
    const match = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i);
    if (!match) {
      return { lastInsertRowid: 0, changes: 0 };
    }

    const tableName = match[1];
    const whereClause = match[2];

    const table = this.tables.get(tableName);
    if (!table) {
      return { lastInsertRowid: 0, changes: 0 };
    }

    const whereValues = this.parseWhereClause(whereClause, params, 0);

    let changes = 0;
    for (const [id, row] of table) {
      if (this.rowMatchesWhere(row, whereValues)) {
        table.delete(id);
        changes++;
      }
    }

    return { lastInsertRowid: 0, changes };
  }

  private handleSelect<T>(sql: string, params: unknown[]): T[] {
    // Parse: SELECT * FROM table WHERE ... ORDER BY ... LIMIT ...
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (!fromMatch) {
      return [];
    }

    const tableName = fromMatch[1];
    const table = this.tables.get(tableName);
    if (!table) {
      return [];
    }

    let results = Array.from(table.values());

    // Handle WHERE clause
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const whereValues = this.parseWhereClause(whereClause, params, 0);
      results = results.filter((row) => this.rowMatchesWhere(row, whereValues));
    }

    // Handle ORDER BY
    const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const orderCol = orderMatch[1];
      const orderDir = orderMatch[2]?.toUpperCase() === "DESC" ? -1 : 1;
      results.sort((a, b) => {
        const aVal = a[orderCol];
        const bVal = b[orderCol];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        return aVal < bVal ? -orderDir : orderDir;
      });
    }

    // Handle LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      results = results.slice(0, parseInt(limitMatch[1], 10));
    }

    return results as T[];
  }

  private parseWhereClause(
    whereClause: string,
    params: unknown[],
    paramOffset: number
  ): Map<string, unknown> {
    const conditions = new Map<string, unknown>();

    // Split by AND
    const parts = whereClause.split(/\s+AND\s+/i);
    let paramIndex = paramOffset;

    for (const part of parts) {
      // Handle: column = ?
      const eqMatch = part.match(/(\w+)\s*=\s*\?/);
      if (eqMatch) {
        conditions.set(eqMatch[1], params[paramIndex++]);
        continue;
      }

      // Handle: column IS NULL
      const nullMatch = part.match(/(\w+)\s+IS\s+NULL/i);
      if (nullMatch) {
        conditions.set(nullMatch[1], null);
        continue;
      }

      // Handle: column IS NOT NULL
      const notNullMatch = part.match(/(\w+)\s+IS\s+NOT\s+NULL/i);
      if (notNullMatch) {
        conditions.set(`${notNullMatch[1]}__NOT_NULL`, true);
      }
    }

    return conditions;
  }

  private rowMatchesWhere(
    row: Record<string, unknown>,
    conditions: Map<string, unknown>
  ): boolean {
    for (const [key, value] of conditions) {
      // Handle NOT NULL check
      if (key.endsWith("__NOT_NULL")) {
        const col = key.replace("__NOT_NULL", "");
        if (row[col] === null || row[col] === undefined) {
          return false;
        }
        continue;
      }

      if (row[key] !== value) {
        return false;
      }
    }
    return true;
  }

  // --- Test helpers ---

  /**
   * Get all rows from a table (for testing)
   */
  getTable(name: string): Record<string, unknown>[] {
    const table = this.tables.get(name);
    return table ? Array.from(table.values()) : [];
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    for (const table of this.tables.values()) {
      table.clear();
    }
    for (const key of this.sequences.keys()) {
      this.sequences.set(key, 0);
    }
  }
}
