import type { DatabaseAdapter } from "../abstractions/database.js";
import type {
  Message,
  SendMessageInput,
  MessageRow,
} from "../models/message.js";
import { messageFromRow } from "../models/message.js";
import type { MessageRecipient, MessageRecipientRow } from "../models/message-recipient.js";
import { messageRecipientFromRow } from "../models/message-recipient.js";
import { generateUUID, now } from "../validation/slugify.js";

/**
 * Options for fetching inbox messages.
 */
export interface FetchInboxOptions {
  /** Only return unread messages */
  unreadOnly?: boolean;
  /** Maximum number of messages to return */
  limit?: number;
  /** Number of messages to skip */
  offset?: number;
  /** Only return messages after this date */
  since?: string;
  /** Filter by thread ID */
  threadId?: string;
  /** Filter by importance level */
  importance?: Message["importance"];
}

/**
 * Extended message with sender and recipient info.
 */
export interface MessageWithMeta extends Message {
  senderName?: string;
  recipients?: Array<{
    agentId: number;
    agentName: string;
    kind: MessageRecipient["kind"];
    readTs: string | null;
    ackTs: string | null;
  }>;
}

/**
 * Message operations for sending and receiving messages.
 */
export class MessageOperations {
  constructor(private db: DatabaseAdapter) {}

  /**
   * Send a message to one or more recipients.
   */
  async sendMessage(input: SendMessageInput): Promise<Message> {
    const threadId = input.threadId ?? generateUUID();
    const timestamp = now();

    // Get sender's project ID
    const sender = await this.db.get<{ project_id: number }>(
      "SELECT project_id FROM agents WHERE id = ?",
      [input.senderId]
    );
    if (!sender) {
      throw new Error(`Sender agent ${input.senderId} not found`);
    }

    // Validate all recipients exist
    for (const recipient of input.recipients) {
      const agent = await this.db.get<{ id: number }>(
        "SELECT id FROM agents WHERE id = ?",
        [recipient.agentId]
      );
      if (!agent) {
        throw new Error(`Recipient agent ${recipient.agentId} not found`);
      }
    }

    // Create the message
    const result = await this.db.run(
      `INSERT INTO messages (
        project_id, sender_id, thread_id, subject, body,
        importance, requires_ack, ack_ttl_seconds, attachments, created_ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sender.project_id,
        input.senderId,
        threadId,
        input.subject,
        input.body,
        input.importance ?? "normal",
        input.requiresAck ? 1 : 0,
        input.ackTtlSeconds ?? null,
        JSON.stringify(input.attachments ?? []),
        timestamp,
      ]
    );

    const messageId = Number(result.lastInsertRowid);

    // Create recipient records
    for (const recipient of input.recipients) {
      await this.db.run(
        `INSERT INTO message_recipients (message_id, agent_id, kind, read_ts, ack_ts)
         VALUES (?, ?, ?, ?, ?)`,
        [messageId, recipient.agentId, recipient.kind, null, null]
      );
    }

    return {
      id: messageId,
      projectId: sender.project_id,
      senderId: input.senderId,
      threadId,
      subject: input.subject,
      body: input.body,
      importance: input.importance ?? "normal",
      requiresAck: input.requiresAck ?? false,
      ackTtlSeconds: input.ackTtlSeconds ?? null,
      attachments: input.attachments ?? [],
      createdTs: timestamp,
    };
  }

  /**
   * Reply to an existing message within the same thread.
   */
  async replyMessage(
    originalMessageId: number,
    senderId: number,
    body: string,
    options?: {
      attachments?: Message["attachments"];
    }
  ): Promise<Message> {
    const original = await this.getMessage(originalMessageId);
    if (!original) {
      throw new Error(`Original message ${originalMessageId} not found`);
    }

    // Get all recipients of the original message plus the original sender
    const recipients = await this.getRecipients(originalMessageId);
    const replyRecipients: SendMessageInput["recipients"] = [];

    // Add original sender as recipient (if not the current sender)
    if (original.senderId !== senderId) {
      replyRecipients.push({ agentId: original.senderId, kind: "to" });
    }

    // Add other recipients (excluding current sender)
    for (const r of recipients) {
      if (r.agentId !== senderId) {
        replyRecipients.push({ agentId: r.agentId, kind: r.kind });
      }
    }

    return this.sendMessage({
      senderId,
      recipients: replyRecipients,
      subject: `Re: ${original.subject}`,
      body,
      threadId: original.threadId,
      importance: original.importance,
      attachments: options?.attachments,
    });
  }

  /**
   * Fetch inbox messages for an agent.
   */
  async fetchInbox(
    agentId: number,
    options?: FetchInboxOptions
  ): Promise<Message[]> {
    // First, get message IDs for this agent from recipients table
    let recipientSql = "SELECT message_id, read_ts FROM message_recipients WHERE agent_id = ?";
    const recipientParams: unknown[] = [agentId];

    if (options?.unreadOnly) {
      recipientSql += " AND read_ts IS NULL";
    }

    const recipientRows = await this.db.all<{ message_id: number; read_ts: string | null }>(
      recipientSql,
      recipientParams
    );

    if (recipientRows.length === 0) {
      return [];
    }

    const messageIds = recipientRows.map((r) => r.message_id);

    // Fetch all messages
    const allMessages = await this.db.all<MessageRow>(
      "SELECT * FROM messages ORDER BY created_ts DESC"
    );

    // Filter messages by IDs and options
    let messages = allMessages
      .filter((m) => messageIds.includes(m.id))
      .map(messageFromRow);

    // Apply additional filters
    if (options?.since) {
      messages = messages.filter((m) => m.createdTs > options.since!);
    }

    if (options?.threadId) {
      messages = messages.filter((m) => m.threadId === options.threadId);
    }

    if (options?.importance) {
      messages = messages.filter((m) => m.importance === options.importance);
    }

    // Apply limit
    if (options?.limit) {
      messages = messages.slice(0, options.limit);
    }

    return messages;
  }

  /**
   * Get a single message by ID.
   */
  async getMessage(id: number): Promise<Message | null> {
    const row = await this.db.get<MessageRow>(
      "SELECT * FROM messages WHERE id = ?",
      [id]
    );
    return row ? messageFromRow(row) : null;
  }

  /**
   * Get all messages in a thread.
   */
  async getThread(threadId: string): Promise<Message[]> {
    const rows = await this.db.all<MessageRow>(
      "SELECT * FROM messages WHERE thread_id = ? ORDER BY created_ts ASC",
      [threadId]
    );
    return rows.map(messageFromRow);
  }

  /**
   * Get recipients of a message.
   */
  async getRecipients(messageId: number): Promise<MessageRecipient[]> {
    const rows = await this.db.all<MessageRecipientRow>(
      "SELECT * FROM message_recipients WHERE message_id = ?",
      [messageId]
    );
    return rows.map(messageRecipientFromRow);
  }

  /**
   * Mark a message as read for a specific agent.
   */
  async markRead(messageId: number, agentId: number): Promise<void> {
    await this.db.run(
      `UPDATE message_recipients SET read_ts = ?
       WHERE message_id = ? AND agent_id = ? AND read_ts IS NULL`,
      [now(), messageId, agentId]
    );
  }

  /**
   * Acknowledge a message for a specific agent.
   */
  async acknowledge(messageId: number, agentId: number): Promise<void> {
    const timestamp = now();
    await this.db.run(
      `UPDATE message_recipients SET ack_ts = ?, read_ts = COALESCE(read_ts, ?)
       WHERE message_id = ? AND agent_id = ?`,
      [timestamp, timestamp, messageId, agentId]
    );
  }

  /**
   * Check if a message has been read by a specific agent.
   */
  async isRead(messageId: number, agentId: number): Promise<boolean> {
    const row = await this.db.get<{ read_ts: string | null }>(
      "SELECT read_ts FROM message_recipients WHERE message_id = ? AND agent_id = ?",
      [messageId, agentId]
    );
    return row?.read_ts !== null;
  }

  /**
   * Check if a message has been acknowledged by a specific agent.
   */
  async isAcknowledged(messageId: number, agentId: number): Promise<boolean> {
    const row = await this.db.get<{ ack_ts: string | null }>(
      "SELECT ack_ts FROM message_recipients WHERE message_id = ? AND agent_id = ?",
      [messageId, agentId]
    );
    return row?.ack_ts !== null;
  }

  /**
   * Count unread messages for an agent.
   */
  async countUnread(agentId: number): Promise<number> {
    const rows = await this.db.all<{ id: number }>(
      "SELECT id FROM message_recipients WHERE agent_id = ? AND read_ts IS NULL",
      [agentId]
    );
    return rows.length;
  }

  /**
   * Delete a message and its recipients.
   */
  async deleteMessage(id: number): Promise<boolean> {
    await this.db.run("DELETE FROM message_recipients WHERE message_id = ?", [id]);
    const result = await this.db.run("DELETE FROM messages WHERE id = ?", [id]);
    return result.changes > 0;
  }
}
