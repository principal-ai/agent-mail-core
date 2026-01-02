import type { AttachmentsPolicy, ContactPolicy } from "../types/enums.js";

/**
 * Agent entity - represents a coding agent (Claude Code, Codex, etc.)
 */
export interface Agent {
  id: number;
  projectId: number;
  /** Memorable auto-generated name (e.g., "GreenLake") */
  name: string;
  /** Agent program type (e.g., "claude-code", "codex") */
  program: string;
  /** Model identifier (e.g., "opus-4", "gpt-5") */
  model: string;
  /** Current task description */
  task: string | null;
  /** Registration timestamp (ISO string) */
  inceptionTs: string;
  /** Last activity timestamp (ISO string) */
  lastActiveTs: string;
  /** Attachment handling policy */
  attachmentsPolicy: AttachmentsPolicy;
  /** Contact/messaging policy */
  contactPolicy: ContactPolicy;
}

/**
 * Input for registering a new agent
 */
export interface RegisterAgentInput {
  projectId: number;
  /** Optional name - auto-generated if not provided */
  name?: string;
  program: string;
  model: string;
  task?: string;
  attachmentsPolicy?: AttachmentsPolicy;
  contactPolicy?: ContactPolicy;
}

/**
 * Database row representation of an agent
 */
export interface AgentRow {
  id: number;
  project_id: number;
  name: string;
  program: string;
  model: string;
  task: string | null;
  inception_ts: string;
  last_active_ts: string;
  attachments_policy: string;
  contact_policy: string;
}

/**
 * Convert a database row to an Agent entity
 */
export function agentFromRow(row: AgentRow): Agent {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    program: row.program,
    model: row.model,
    task: row.task,
    inceptionTs: row.inception_ts,
    lastActiveTs: row.last_active_ts,
    attachmentsPolicy: row.attachments_policy as AttachmentsPolicy,
    contactPolicy: row.contact_policy as ContactPolicy,
  };
}
