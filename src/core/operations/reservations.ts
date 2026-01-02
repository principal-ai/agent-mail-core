import type { DatabaseAdapter } from "../abstractions/database.js";
import type { GlobAdapter } from "../abstractions/glob.js";
import type {
  FileReservation,
  ReserveFilesInput,
  ConflictCheckResult,
  ReservationConflict,
  FileReservationRow,
} from "../models/file-reservation.js";
import { fileReservationFromRow } from "../models/file-reservation.js";
import type { AgentRow } from "../models/agent.js";
import { now } from "../validation/slugify.js";

/**
 * Default TTL for file reservations (30 minutes)
 */
export const DEFAULT_RESERVATION_TTL_SECONDS = 1800;

/**
 * File reservation operations for coordinating concurrent file access.
 */
export class ReservationOperations {
  constructor(
    private db: DatabaseAdapter,
    private glob: GlobAdapter
  ) {}

  /**
   * Reserve files for an agent.
   *
   * Creates reservations for the given glob patterns. If exclusive mode is enabled
   * and there are conflicts with existing reservations, the operation will fail.
   *
   * @returns Array of created reservations
   * @throws Error if there are conflicts with exclusive reservations
   */
  async reserveFiles(input: ReserveFilesInput): Promise<FileReservation[]> {
    const exclusive = input.exclusive ?? true;
    const ttlSeconds = input.ttlSeconds ?? DEFAULT_RESERVATION_TTL_SECONDS;

    // Get the agent's project
    const agent = await this.db.get<{ project_id: number }>(
      "SELECT project_id FROM agents WHERE id = ?",
      [input.agentId]
    );
    if (!agent) {
      throw new Error(`Agent ${input.agentId} not found`);
    }

    // Check for conflicts
    const conflictCheck = await this.checkConflicts(
      agent.project_id,
      input.agentId,
      input.patterns
    );

    if (conflictCheck.hasConflicts && exclusive) {
      const conflictDetails = conflictCheck.conflicts
        .map((c) => `"${c.pattern}" conflicts with ${c.agentName}'s reservation on "${c.existingReservation.pathPattern}"`)
        .join("; ");
      throw new Error(`File reservation conflicts: ${conflictDetails}`);
    }

    // Create reservations
    const timestamp = now();
    const expiresTs = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const reservations: FileReservation[] = [];

    for (const pattern of input.patterns) {
      const result = await this.db.run(
        `INSERT INTO file_reservations (
          project_id, agent_id, path_pattern, exclusive, reason,
          created_ts, expires_ts, released_ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          agent.project_id,
          input.agentId,
          pattern,
          exclusive ? 1 : 0,
          input.reason ?? null,
          timestamp,
          expiresTs,
          null,
        ]
      );

      reservations.push({
        id: Number(result.lastInsertRowid),
        projectId: agent.project_id,
        agentId: input.agentId,
        pathPattern: pattern,
        exclusive,
        reason: input.reason ?? null,
        createdTs: timestamp,
        expiresTs,
        releasedTs: null,
      });
    }

    return reservations;
  }

  /**
   * Release reservations by their IDs.
   */
  async releaseReservations(reservationIds: number[]): Promise<number> {
    const timestamp = now();
    let released = 0;

    for (const id of reservationIds) {
      const result = await this.db.run(
        "UPDATE file_reservations SET released_ts = ? WHERE id = ? AND released_ts IS NULL",
        [timestamp, id]
      );
      released += result.changes;
    }

    return released;
  }

  /**
   * Release all reservations for an agent.
   */
  async releaseAllForAgent(agentId: number): Promise<number> {
    const timestamp = now();
    const result = await this.db.run(
      "UPDATE file_reservations SET released_ts = ? WHERE agent_id = ? AND released_ts IS NULL",
      [timestamp, agentId]
    );
    return result.changes;
  }

  /**
   * Force release a reservation (admin operation).
   */
  async forceRelease(reservationId: number): Promise<boolean> {
    const timestamp = now();
    const result = await this.db.run(
      "UPDATE file_reservations SET released_ts = ? WHERE id = ?",
      [timestamp, reservationId]
    );
    return result.changes > 0;
  }

  /**
   * Renew reservations by extending their TTL.
   */
  async renewReservations(
    reservationIds: number[],
    ttlSeconds: number = DEFAULT_RESERVATION_TTL_SECONDS
  ): Promise<number> {
    const newExpiresTs = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    let renewed = 0;

    for (const id of reservationIds) {
      const result = await this.db.run(
        "UPDATE file_reservations SET expires_ts = ? WHERE id = ? AND released_ts IS NULL",
        [newExpiresTs, id]
      );
      renewed += result.changes;
    }

    return renewed;
  }

  /**
   * Check for conflicts between new patterns and existing reservations.
   */
  async checkConflicts(
    projectId: number,
    agentId: number,
    patterns: string[]
  ): Promise<ConflictCheckResult> {
    const conflicts: ReservationConflict[] = [];

    // Get all active reservations in the project (excluding this agent's)
    const activeReservations = await this.getActiveReservations(projectId);
    const otherReservations = activeReservations.filter(
      (r) => r.agentId !== agentId && r.exclusive
    );

    for (const pattern of patterns) {
      for (const existing of otherReservations) {
        // Check if patterns overlap
        if (this.patternsOverlap(pattern, existing.pathPattern)) {
          // Get agent name
          const agent = await this.db.get<AgentRow>(
            "SELECT * FROM agents WHERE id = ?",
            [existing.agentId]
          );

          conflicts.push({
            pattern,
            existingReservation: existing,
            agentId: existing.agentId,
            agentName: agent?.name ?? "Unknown",
          });
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Get a reservation by ID.
   */
  async getReservation(id: number): Promise<FileReservation | null> {
    const row = await this.db.get<FileReservationRow>(
      "SELECT * FROM file_reservations WHERE id = ?",
      [id]
    );
    return row ? fileReservationFromRow(row) : null;
  }

  /**
   * Get all active reservations in a project.
   * Active = not released and not expired.
   */
  async getActiveReservations(projectId: number): Promise<FileReservation[]> {
    const currentTime = now();
    const rows = await this.db.all<FileReservationRow>(
      "SELECT * FROM file_reservations WHERE project_id = ? AND released_ts IS NULL",
      [projectId]
    );

    // Filter out expired reservations in memory
    return rows
      .map(fileReservationFromRow)
      .filter((r) => r.expiresTs > currentTime);
  }

  /**
   * Get all reservations for an agent.
   */
  async getReservationsForAgent(agentId: number): Promise<FileReservation[]> {
    const rows = await this.db.all<FileReservationRow>(
      "SELECT * FROM file_reservations WHERE agent_id = ? ORDER BY created_ts DESC",
      [agentId]
    );
    return rows.map(fileReservationFromRow);
  }

  /**
   * Get active reservations for an agent.
   */
  async getActiveReservationsForAgent(agentId: number): Promise<FileReservation[]> {
    const currentTime = now();
    const rows = await this.db.all<FileReservationRow>(
      "SELECT * FROM file_reservations WHERE agent_id = ? AND released_ts IS NULL",
      [agentId]
    );

    return rows
      .map(fileReservationFromRow)
      .filter((r) => r.expiresTs > currentTime);
  }

  /**
   * Expire stale reservations (background cleanup task).
   * Returns the number of reservations expired.
   */
  async expireStaleReservations(): Promise<number> {
    const currentTime = now();

    // Get all expired but not-yet-released reservations
    const rows = await this.db.all<FileReservationRow>(
      "SELECT * FROM file_reservations WHERE released_ts IS NULL"
    );

    const expired = rows.filter((r) => r.expires_ts < currentTime);

    // Mark them as released
    for (const row of expired) {
      await this.db.run(
        "UPDATE file_reservations SET released_ts = ? WHERE id = ?",
        [currentTime, row.id]
      );
    }

    return expired.length;
  }

  /**
   * Check if a specific file path is reserved by another agent.
   */
  async isFileReserved(
    projectId: number,
    agentId: number,
    filePath: string
  ): Promise<{ reserved: boolean; reservedBy?: FileReservation }> {
    const activeReservations = await this.getActiveReservations(projectId);
    const otherReservations = activeReservations.filter(
      (r) => r.agentId !== agentId && r.exclusive
    );

    for (const reservation of otherReservations) {
      if (this.glob.matches(reservation.pathPattern, filePath)) {
        return { reserved: true, reservedBy: reservation };
      }
    }

    return { reserved: false };
  }

  /**
   * Check if two glob patterns potentially overlap.
   *
   * This is a conservative check - it may return true for patterns that
   * don't actually overlap, but will never return false for patterns that do.
   */
  private patternsOverlap(pattern1: string, pattern2: string): boolean {
    // If either pattern contains **, they could potentially overlap
    if (pattern1.includes("**") || pattern2.includes("**")) {
      // Check if they share a common base path
      const base1 = this.getBasePath(pattern1);
      const base2 = this.getBasePath(pattern2);

      // If one base is prefix of the other, they might overlap
      if (base1.startsWith(base2) || base2.startsWith(base1)) {
        return true;
      }
    }

    // Check if one pattern matches the other literally
    if (this.glob.matches(pattern1, pattern2) || this.glob.matches(pattern2, pattern1)) {
      return true;
    }

    // Check for same directory with overlapping file patterns
    const dir1 = this.getDirectory(pattern1);
    const dir2 = this.getDirectory(pattern2);

    if (dir1 === dir2) {
      // Same directory - check if file patterns could overlap
      const file1 = this.getFileName(pattern1);
      const file2 = this.getFileName(pattern2);

      // If either has wildcards, they could overlap
      if (file1.includes("*") || file2.includes("*")) {
        return true;
      }

      // Same file
      if (file1 === file2) {
        return true;
      }
    }

    return false;
  }

  private getBasePath(pattern: string): string {
    const parts = pattern.split("/");
    const staticParts: string[] = [];
    for (const part of parts) {
      if (part.includes("*") || part.includes("?") || part.includes("[")) {
        break;
      }
      staticParts.push(part);
    }
    return staticParts.join("/");
  }

  private getDirectory(pattern: string): string {
    const lastSlash = pattern.lastIndexOf("/");
    return lastSlash > 0 ? pattern.slice(0, lastSlash) : "";
  }

  private getFileName(pattern: string): string {
    const lastSlash = pattern.lastIndexOf("/");
    return lastSlash >= 0 ? pattern.slice(lastSlash + 1) : pattern;
  }
}
