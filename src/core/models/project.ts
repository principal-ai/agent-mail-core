import type { ProjectIdentityMode } from "../types/enums.js";

/**
 * Project entity - namespace container for agents and messages
 */
export interface Project {
  id: number;
  /** URL-safe unique identifier */
  slug: string;
  /** Human-readable name/path */
  humanKey: string;
  /** How project identity is determined */
  identityMode: ProjectIdentityMode;
  /** Creation timestamp (ISO string) */
  createdTs: string;
  /** Last update timestamp (ISO string) */
  updatedTs: string;
}

/**
 * Input for creating a new project
 */
export interface CreateProjectInput {
  slug: string;
  humanKey?: string;
  identityMode?: ProjectIdentityMode;
}

/**
 * Database row representation of a project
 */
export interface ProjectRow {
  id: number;
  slug: string;
  human_key: string;
  identity_mode: string;
  created_ts: string;
  updated_ts: string;
}

/**
 * Convert a database row to a Project entity
 */
export function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    humanKey: row.human_key,
    identityMode: row.identity_mode as ProjectIdentityMode,
    createdTs: row.created_ts,
    updatedTs: row.updated_ts,
  };
}
