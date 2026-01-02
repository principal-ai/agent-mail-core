import type { DatabaseAdapter } from "../abstractions/database.js";
import type {
  AgentLink,
  RequestLinkInput,
  CanSendResult,
  AgentLinkRow,
} from "../models/agent-link.js";
import { agentLinkFromRow } from "../models/agent-link.js";
import type { AgentRow } from "../models/agent.js";
import type { LinkStatus, ContactPolicy } from "../types/enums.js";
import { now } from "../validation/slugify.js";

/**
 * Agent link operations for managing contact relationships.
 */
export class LinkOperations {
  constructor(private db: DatabaseAdapter) {}

  /**
   * Request a link with another agent.
   *
   * Creates a pending link request that the responder can approve or block.
   * If a link already exists, returns the existing link.
   *
   * @returns The created or existing link
   */
  async requestLink(input: RequestLinkInput): Promise<AgentLink> {
    // Check if link already exists (in either direction)
    const existing = await this.getLinkBetween(input.requesterId, input.responderId);
    if (existing) {
      return existing;
    }

    // Check if reverse link exists
    const reverse = await this.getLinkBetween(input.responderId, input.requesterId);
    if (reverse) {
      return reverse;
    }

    // Get responder's contact policy to determine initial status
    const responder = await this.db.get<AgentRow>(
      "SELECT * FROM agents WHERE id = ?",
      [input.responderId]
    );
    if (!responder) {
      throw new Error(`Agent ${input.responderId} not found`);
    }

    // Get requester info for auto-approve check
    const requester = await this.db.get<AgentRow>(
      "SELECT * FROM agents WHERE id = ?",
      [input.requesterId]
    );
    if (!requester) {
      throw new Error(`Agent ${input.requesterId} not found`);
    }

    // Determine initial status based on contact policy
    let status: LinkStatus = "pending";
    const policy = responder.contact_policy as ContactPolicy;

    if (policy === "open") {
      status = "approved";
    } else if (policy === "auto" && requester.program === responder.program) {
      // Auto-approve agents from the same program
      status = "approved";
    } else if (policy === "block_all") {
      status = "blocked";
    }

    const timestamp = now();
    const result = await this.db.run(
      `INSERT INTO agent_links (requester_id, responder_id, status, created_ts, updated_ts)
       VALUES (?, ?, ?, ?, ?)`,
      [input.requesterId, input.responderId, status, timestamp, timestamp]
    );

    return {
      id: Number(result.lastInsertRowid),
      requesterId: input.requesterId,
      responderId: input.responderId,
      status,
      createdTs: timestamp,
      updatedTs: timestamp,
    };
  }

  /**
   * Approve a pending link request.
   *
   * @returns True if the link was approved
   */
  async approveLink(linkId: number): Promise<boolean> {
    const timestamp = now();
    const result = await this.db.run(
      "UPDATE agent_links SET status = ?, updated_ts = ? WHERE id = ? AND status = ?",
      ["approved", timestamp, linkId, "pending"]
    );
    return result.changes > 0;
  }

  /**
   * Approve a link by the responder agent ID.
   *
   * @returns True if the link was approved
   */
  async approveLinkFrom(responderId: number, requesterId: number): Promise<boolean> {
    const link = await this.getLinkBetween(requesterId, responderId);
    if (!link) {
      return false;
    }
    return this.approveLink(link.id);
  }

  /**
   * Block a link (reject pending or block existing).
   *
   * @returns True if the link was blocked
   */
  async blockLink(linkId: number): Promise<boolean> {
    const timestamp = now();
    const result = await this.db.run(
      "UPDATE agent_links SET status = ?, updated_ts = ? WHERE id = ?",
      ["blocked", timestamp, linkId]
    );
    return result.changes > 0;
  }

  /**
   * Block a link by the responder agent ID.
   *
   * @returns True if the link was blocked
   */
  async blockLinkFrom(responderId: number, requesterId: number): Promise<boolean> {
    const link = await this.getLinkBetween(requesterId, responderId);
    if (!link) {
      // Create a blocked link
      const timestamp = now();
      await this.db.run(
        `INSERT INTO agent_links (requester_id, responder_id, status, created_ts, updated_ts)
         VALUES (?, ?, ?, ?, ?)`,
        [requesterId, responderId, "blocked", timestamp, timestamp]
      );
      return true;
    }
    return this.blockLink(link.id);
  }

  /**
   * Unblock a previously blocked link (sets it back to pending).
   *
   * @returns True if the link was unblocked
   */
  async unblockLink(linkId: number): Promise<boolean> {
    const timestamp = now();
    const result = await this.db.run(
      "UPDATE agent_links SET status = ?, updated_ts = ? WHERE id = ? AND status = ?",
      ["pending", timestamp, linkId, "blocked"]
    );
    return result.changes > 0;
  }

  /**
   * Delete a link entirely.
   *
   * @returns True if the link was deleted
   */
  async deleteLink(linkId: number): Promise<boolean> {
    const result = await this.db.run(
      "DELETE FROM agent_links WHERE id = ?",
      [linkId]
    );
    return result.changes > 0;
  }

  /**
   * Get a link by ID.
   */
  async getLink(id: number): Promise<AgentLink | null> {
    const row = await this.db.get<AgentLinkRow>(
      "SELECT * FROM agent_links WHERE id = ?",
      [id]
    );
    return row ? agentLinkFromRow(row) : null;
  }

  /**
   * Get the link between two agents (if any).
   * Checks both directions.
   */
  async getLinkBetween(agentA: number, agentB: number): Promise<AgentLink | null> {
    // Check A -> B
    let row = await this.db.get<AgentLinkRow>(
      "SELECT * FROM agent_links WHERE requester_id = ? AND responder_id = ?",
      [agentA, agentB]
    );
    if (row) {
      return agentLinkFromRow(row);
    }

    // Check B -> A
    row = await this.db.get<AgentLinkRow>(
      "SELECT * FROM agent_links WHERE requester_id = ? AND responder_id = ?",
      [agentB, agentA]
    );
    return row ? agentLinkFromRow(row) : null;
  }

  /**
   * Get all links for an agent (both as requester and responder).
   */
  async getLinksForAgent(agentId: number): Promise<AgentLink[]> {
    const rows = await this.db.all<AgentLinkRow>(
      "SELECT * FROM agent_links WHERE requester_id = ? OR responder_id = ? ORDER BY updated_ts DESC",
      [agentId, agentId]
    );
    return rows.map(agentLinkFromRow);
  }

  /**
   * Get pending link requests for an agent (where they are the responder).
   */
  async getPendingRequestsForAgent(agentId: number): Promise<AgentLink[]> {
    const rows = await this.db.all<AgentLinkRow>(
      "SELECT * FROM agent_links WHERE responder_id = ? AND status = ? ORDER BY created_ts DESC",
      [agentId, "pending"]
    );
    return rows.map(agentLinkFromRow);
  }

  /**
   * Get approved contacts for an agent.
   */
  async getApprovedContacts(agentId: number): Promise<AgentLink[]> {
    const rows = await this.db.all<AgentLinkRow>(
      "SELECT * FROM agent_links WHERE (requester_id = ? OR responder_id = ?) AND status = ? ORDER BY updated_ts DESC",
      [agentId, agentId, "approved"]
    );
    return rows.map(agentLinkFromRow);
  }

  /**
   * Get blocked agents for an agent (where they blocked someone or were blocked).
   */
  async getBlockedLinks(agentId: number): Promise<AgentLink[]> {
    const rows = await this.db.all<AgentLinkRow>(
      "SELECT * FROM agent_links WHERE (requester_id = ? OR responder_id = ?) AND status = ? ORDER BY updated_ts DESC",
      [agentId, agentId, "blocked"]
    );
    return rows.map(agentLinkFromRow);
  }

  /**
   * Check if an agent can send a message to another agent.
   *
   * This checks the recipient's contact policy and any existing link status.
   * Explicit blocks always take priority over policies.
   */
  async canSend(senderId: number, recipientId: number): Promise<CanSendResult> {
    // Get recipient's contact policy
    const recipient = await this.db.get<AgentRow>(
      "SELECT * FROM agents WHERE id = ?",
      [recipientId]
    );
    if (!recipient) {
      return { allowed: false, reason: "blocked" };
    }

    const policy = recipient.contact_policy as ContactPolicy;

    // Check existing link first - explicit blocks take priority
    const link = await this.getLinkBetween(senderId, recipientId);
    if (link && link.status === "blocked") {
      return { allowed: false, reason: "blocked" };
    }

    // Block all policy - no messages allowed
    if (policy === "block_all") {
      return { allowed: false, reason: "block_all" };
    }

    // Open policy - allow all (unless explicitly blocked, checked above)
    if (policy === "open") {
      return { allowed: true, reason: "open" };
    }

    // Check for approved link
    if (link && link.status === "approved") {
      return { allowed: true, reason: "approved_contact" };
    }

    // Auto policy - check if same program
    if (policy === "auto") {
      const sender = await this.db.get<AgentRow>(
        "SELECT * FROM agents WHERE id = ?",
        [senderId]
      );
      if (sender && sender.program === recipient.program) {
        return { allowed: true, reason: "auto_approved" };
      }
      // Different program without approved link
      if (link && link.status === "pending") {
        return { allowed: false, reason: "pending" };
      }
      return { allowed: false, reason: "contacts_only" };
    }

    // Contacts only policy - need approved link
    if (policy === "contacts_only") {
      if (link && link.status === "pending") {
        return { allowed: false, reason: "pending" };
      }
      return { allowed: false, reason: "contacts_only" };
    }

    return { allowed: false, reason: "blocked" };
  }

  /**
   * Get the contact ID from a link for a given agent.
   * Returns the other agent's ID in the link.
   */
  getContactId(link: AgentLink, agentId: number): number {
    return link.requesterId === agentId ? link.responderId : link.requesterId;
  }
}
