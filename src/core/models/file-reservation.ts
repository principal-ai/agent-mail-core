/**
 * FileReservation entity - advisory file leases for coordinating concurrent access
 */
export interface FileReservation {
  id: number;
  projectId: number;
  agentId: number;
  /** Glob pattern for reserved files (e.g., src/**\/*.ts) */
  pathPattern: string;
  /** Whether this is an exclusive (blocking) reservation */
  exclusive: boolean;
  /** Reason for the reservation */
  reason: string | null;
  /** Creation timestamp (ISO string) */
  createdTs: string;
  /** Expiration timestamp (ISO string) */
  expiresTs: string;
  /** Release timestamp if manually released (ISO string) */
  releasedTs: string | null;
}

/**
 * Input for creating file reservations
 */
export interface ReserveFilesInput {
  agentId: number;
  /** Glob patterns for files to reserve */
  patterns: string[];
  /** Whether reservations are exclusive (default: true) */
  exclusive?: boolean;
  /** Reason for the reservation */
  reason?: string;
  /** TTL in seconds (default: 1800 = 30 minutes) */
  ttlSeconds?: number;
}

/**
 * Conflict information when reservation fails
 */
export interface ReservationConflict {
  /** The pattern that conflicts */
  pattern: string;
  /** The existing reservation that blocks this one */
  existingReservation: FileReservation;
  /** The agent holding the existing reservation */
  agentId: number;
  /** Name of the agent holding the reservation */
  agentName: string;
}

/**
 * Result of checking for conflicts
 */
export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: ReservationConflict[];
}

/**
 * Database row representation of a file reservation
 */
export interface FileReservationRow {
  id: number;
  project_id: number;
  agent_id: number;
  path_pattern: string;
  exclusive: number;
  reason: string | null;
  created_ts: string;
  expires_ts: string;
  released_ts: string | null;
}

/**
 * Convert a database row to a FileReservation entity
 */
export function fileReservationFromRow(row: FileReservationRow): FileReservation {
  return {
    id: row.id,
    projectId: row.project_id,
    agentId: row.agent_id,
    pathPattern: row.path_pattern,
    exclusive: row.exclusive === 1,
    reason: row.reason,
    createdTs: row.created_ts,
    expiresTs: row.expires_ts,
    releasedTs: row.released_ts,
  };
}

/**
 * Check if a reservation is currently active (not expired and not released)
 */
export function isReservationActive(reservation: FileReservation): boolean {
  if (reservation.releasedTs !== null) {
    return false;
  }
  const now = new Date();
  const expires = new Date(reservation.expiresTs);
  return expires > now;
}
