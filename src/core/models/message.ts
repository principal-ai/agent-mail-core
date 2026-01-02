import type { ImportanceLevel } from "../types/enums.js";

/**
 * Attachment metadata
 */
export interface Attachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** Storage mode */
  storage: "file" | "inline";
  /** Path for file storage */
  path?: string;
  /** Base64 data for inline storage */
  data?: string;
}

/**
 * Message entity - core communication unit
 */
export interface Message {
  id: number;
  projectId: number;
  senderId: number;
  /** Thread grouping UUID */
  threadId: string;
  subject: string;
  /** Markdown body content */
  body: string;
  importance: ImportanceLevel;
  /** Whether acknowledgement is required */
  requiresAck: boolean;
  /** ACK deadline in seconds (from creation) */
  ackTtlSeconds: number | null;
  /** Attached files */
  attachments: Attachment[];
  /** Creation timestamp (ISO string) */
  createdTs: string;
}

/**
 * Input for sending a new message
 */
export interface SendMessageInput {
  senderId: number;
  recipients: Array<{
    agentId: number;
    kind: "to" | "cc" | "bcc";
  }>;
  subject: string;
  body: string;
  /** Optional thread ID - auto-generated if not provided */
  threadId?: string;
  importance?: ImportanceLevel;
  requiresAck?: boolean;
  ackTtlSeconds?: number;
  attachments?: Attachment[];
  /** Check contact policies before sending (default: false) */
  enforceContactPolicy?: boolean;
}

/**
 * Result when a recipient is blocked by contact policy
 */
export interface BlockedRecipient {
  agentId: number;
  reason: string;
}

/**
 * Result of sending a message with policy enforcement
 */
export interface SendMessageResult {
  /** The sent message (if any recipients were valid) */
  message: Message | null;
  /** Recipients who were blocked by policy */
  blockedRecipients: BlockedRecipient[];
  /** Whether the message was sent to at least one recipient */
  sent: boolean;
}

/**
 * Database row representation of a message
 */
export interface MessageRow {
  id: number;
  project_id: number;
  sender_id: number;
  thread_id: string;
  subject: string;
  body: string;
  importance: string;
  requires_ack: number;
  ack_ttl_seconds: number | null;
  attachments: string;
  created_ts: string;
}

/**
 * Convert a database row to a Message entity
 */
export function messageFromRow(row: MessageRow): Message {
  return {
    id: row.id,
    projectId: row.project_id,
    senderId: row.sender_id,
    threadId: row.thread_id,
    subject: row.subject,
    body: row.body,
    importance: row.importance as ImportanceLevel,
    requiresAck: row.requires_ack === 1,
    ackTtlSeconds: row.ack_ttl_seconds,
    attachments: JSON.parse(row.attachments || "[]"),
    createdTs: row.created_ts,
  };
}
