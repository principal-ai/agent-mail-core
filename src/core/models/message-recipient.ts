import type { DeliveryKind } from "../types/enums.js";

/**
 * MessageRecipient entity - tracks per-recipient delivery state
 */
export interface MessageRecipient {
  id: number;
  messageId: number;
  agentId: number;
  /** Delivery type */
  kind: DeliveryKind;
  /** When the message was read (ISO string) */
  readTs: string | null;
  /** When the message was acknowledged (ISO string) */
  ackTs: string | null;
}

/**
 * Database row representation of a message recipient
 */
export interface MessageRecipientRow {
  id: number;
  message_id: number;
  agent_id: number;
  kind: string;
  read_ts: string | null;
  ack_ts: string | null;
}

/**
 * Convert a database row to a MessageRecipient entity
 */
export function messageRecipientFromRow(
  row: MessageRecipientRow
): MessageRecipient {
  return {
    id: row.id,
    messageId: row.message_id,
    agentId: row.agent_id,
    kind: row.kind as DeliveryKind,
    readTs: row.read_ts,
    ackTs: row.ack_ts,
  };
}
