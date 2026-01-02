import type { LinkStatus } from "../types/enums.js";

/**
 * AgentLink entity - represents a contact relationship between two agents.
 *
 * Links are directional: the requester initiates contact, and the responder
 * can approve or block the request based on their contact policy.
 */
export interface AgentLink {
  id: number;
  /** Agent who requested the link */
  requesterId: number;
  /** Agent who received the link request */
  responderId: number;
  /** Current status: pending, approved, or blocked */
  status: LinkStatus;
  /** When the link was created (ISO string) */
  createdTs: string;
  /** When the link was last updated (ISO string) */
  updatedTs: string;
}

/**
 * Input for creating a link request
 */
export interface RequestLinkInput {
  /** Agent requesting the link */
  requesterId: number;
  /** Agent to link with */
  responderId: number;
}

/**
 * Result of checking if an agent can send to another
 */
export interface CanSendResult {
  allowed: boolean;
  reason?: "open" | "approved_contact" | "auto_approved" | "blocked" | "contacts_only" | "block_all" | "pending";
}

/**
 * Database row representation of an agent link
 */
export interface AgentLinkRow {
  id: number;
  requester_id: number;
  responder_id: number;
  status: string;
  created_ts: string;
  updated_ts: string;
}

/**
 * Convert a database row to an AgentLink entity
 */
export function agentLinkFromRow(row: AgentLinkRow): AgentLink {
  return {
    id: row.id,
    requesterId: row.requester_id,
    responderId: row.responder_id,
    status: row.status as LinkStatus,
    createdTs: row.created_ts,
    updatedTs: row.updated_ts,
  };
}
