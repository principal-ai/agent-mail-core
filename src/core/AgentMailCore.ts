import type { DatabaseAdapter } from "./abstractions/database.js";
import type { StorageAdapter } from "./abstractions/storage.js";
import type { LockAdapter } from "./abstractions/lock.js";
import type { GlobAdapter } from "./abstractions/glob.js";
import type { AgentMailConfig } from "./types/config.js";
import { resolveConfig } from "./types/config.js";
import type { Project, CreateProjectInput } from "./models/project.js";
import type { Agent, RegisterAgentInput } from "./models/agent.js";
import type { Message, SendMessageInput, SendMessageResult, BlockedRecipient } from "./models/message.js";
import type {
  FileReservation,
  ReserveFilesInput,
  ConflictCheckResult,
} from "./models/file-reservation.js";
import type {
  AgentLink,
  RequestLinkInput,
  CanSendResult,
} from "./models/agent-link.js";
import { ProjectOperations } from "./operations/projects.js";
import { AgentOperations } from "./operations/agents.js";
import { MessageOperations, type FetchInboxOptions } from "./operations/messages.js";
import { ReservationOperations, DEFAULT_RESERVATION_TTL_SECONDS } from "./operations/reservations.js";
import { LinkOperations } from "./operations/links.js";
import { applySchema } from "./schema.js";

/**
 * Options for creating an AgentMailCore instance.
 */
export interface AgentMailCoreOptions {
  /** Database adapter for persistence */
  database: DatabaseAdapter;
  /** Storage adapter for file operations */
  storage: StorageAdapter;
  /** Lock adapter for concurrency control */
  lock: LockAdapter;
  /** Glob adapter for pattern matching */
  glob: GlobAdapter;
  /** Configuration options */
  config?: Partial<AgentMailConfig>;
}

/**
 * Main entry class for Agent Mail Core.
 *
 * Provides a unified API for all agent mail operations with
 * dependency injection for adapters.
 *
 * @example
 * ```typescript
 * import { AgentMailCore } from '@principal-ai/agent-mail-core';
 * import {
 *   InMemoryDatabaseAdapter,
 *   InMemoryStorageAdapter,
 *   NoOpLockAdapter,
 *   SimpleGlobAdapter
 * } from '@principal-ai/agent-mail-core';
 *
 * const core = new AgentMailCore({
 *   database: new InMemoryDatabaseAdapter(),
 *   storage: new InMemoryStorageAdapter(),
 *   lock: new NoOpLockAdapter(),
 *   glob: new SimpleGlobAdapter()
 * });
 *
 * await core.initialize();
 *
 * // Create a project
 * const project = await core.ensureProject({ slug: 'my-project' });
 *
 * // Register an agent
 * const agent = await core.registerAgent({
 *   projectId: project.id,
 *   program: 'claude-code',
 *   model: 'opus-4'
 * });
 *
 * console.log(`Agent ${agent.name} registered!`);
 * ```
 */
export class AgentMailCore {
  private db: DatabaseAdapter;
  private storage: StorageAdapter;
  private lock: LockAdapter;
  private glob: GlobAdapter;
  private config: Required<AgentMailConfig>;

  private projectOps: ProjectOperations;
  private agentOps: AgentOperations;
  private messageOps: MessageOperations;
  private reservationOps: ReservationOperations;
  private linkOps: LinkOperations;

  private initialized = false;

  constructor(options: AgentMailCoreOptions) {
    this.db = options.database;
    this.storage = options.storage;
    this.lock = options.lock;
    this.glob = options.glob;
    this.config = resolveConfig(options.config);

    // Initialize operation classes
    this.projectOps = new ProjectOperations(this.db);
    this.agentOps = new AgentOperations(this.db, this.config.agentNameEnforcement);
    this.messageOps = new MessageOperations(this.db);
    this.reservationOps = new ReservationOperations(this.db, this.glob);
    this.linkOps = new LinkOperations(this.db);
  }

  /**
   * Initialize the core (database schema, etc.).
   * Must be called before using any operations.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.db.initialize();
    await applySchema(this.db);
    this.initialized = true;
  }

  /**
   * Close the core and release resources.
   */
  async close(): Promise<void> {
    await this.db.close();
    this.initialized = false;
  }

  /**
   * Check if the core is initialized and ready.
   */
  isReady(): boolean {
    return this.initialized && this.db.isReady();
  }

  // ============================================
  // Project Operations
  // ============================================

  /**
   * Create or retrieve a project by slug.
   */
  async ensureProject(input: CreateProjectInput): Promise<Project> {
    this.assertReady();
    return this.projectOps.ensureProject(input);
  }

  /**
   * Get a project by ID.
   */
  async getProject(id: number): Promise<Project | null> {
    this.assertReady();
    return this.projectOps.getProject(id);
  }

  /**
   * Get a project by slug.
   */
  async getProjectBySlug(slug: string): Promise<Project | null> {
    this.assertReady();
    return this.projectOps.getProjectBySlug(slug);
  }

  /**
   * List all projects.
   */
  async listProjects(): Promise<Project[]> {
    this.assertReady();
    return this.projectOps.listProjects();
  }

  // ============================================
  // Agent Operations
  // ============================================

  /**
   * Register a new agent in a project.
   * Name is auto-generated if not provided.
   */
  async registerAgent(input: RegisterAgentInput): Promise<Agent> {
    this.assertReady();
    return this.agentOps.registerAgent(input);
  }

  /**
   * Get an agent by ID.
   */
  async getAgent(id: number): Promise<Agent | null> {
    this.assertReady();
    return this.agentOps.getAgent(id);
  }

  /**
   * Get an agent by name within a project.
   */
  async getAgentByName(projectId: number, name: string): Promise<Agent | null> {
    this.assertReady();
    return this.agentOps.getAgentByName(projectId, name);
  }

  /**
   * Look up an agent's profile (alias for getAgentByName).
   */
  async whois(projectId: number, name: string): Promise<Agent | null> {
    this.assertReady();
    return this.agentOps.whois(projectId, name);
  }

  /**
   * List all agents in a project.
   */
  async listAgents(projectId: number): Promise<Agent[]> {
    this.assertReady();
    return this.agentOps.listAgents(projectId);
  }

  /**
   * Update an agent's last active timestamp.
   */
  async touchAgent(agentId: number): Promise<void> {
    this.assertReady();
    return this.agentOps.touchAgent(agentId);
  }

  /**
   * Update an agent's current task description.
   */
  async updateAgentTask(agentId: number, task: string | null): Promise<void> {
    this.assertReady();
    return this.agentOps.updateTask(agentId, task);
  }

  // ============================================
  // Message Operations
  // ============================================

  /**
   * Send a message to one or more recipients.
   *
   * If enforceContactPolicy is true, recipients who block the sender
   * will be filtered out. Throws if all recipients are blocked.
   */
  async sendMessage(input: SendMessageInput): Promise<Message> {
    this.assertReady();

    // If policy enforcement is enabled, filter recipients
    if (input.enforceContactPolicy) {
      const allowedRecipients: typeof input.recipients = [];
      const blockedRecipients: BlockedRecipient[] = [];

      for (const recipient of input.recipients) {
        const result = await this.linkOps.canSend(input.senderId, recipient.agentId);
        if (result.allowed) {
          allowedRecipients.push(recipient);
        } else {
          blockedRecipients.push({
            agentId: recipient.agentId,
            reason: result.reason ?? "blocked",
          });
        }
      }

      if (allowedRecipients.length === 0) {
        const reasons = blockedRecipients.map((b) => `${b.agentId}: ${b.reason}`).join(", ");
        throw new Error(`All recipients blocked by contact policy: ${reasons}`);
      }

      // Send to allowed recipients only
      const filteredInput = { ...input, recipients: allowedRecipients };
      return this.lock.acquire("messages", () => this.messageOps.sendMessage(filteredInput));
    }

    return this.lock.acquire("messages", () => this.messageOps.sendMessage(input));
  }

  /**
   * Send a message with detailed result including blocked recipients.
   *
   * Unlike sendMessage, this never throws for blocked recipients.
   * Instead, it returns information about which recipients were blocked.
   */
  async sendMessageWithPolicyCheck(input: SendMessageInput): Promise<SendMessageResult> {
    this.assertReady();

    const allowedRecipients: typeof input.recipients = [];
    const blockedRecipients: BlockedRecipient[] = [];

    for (const recipient of input.recipients) {
      const result = await this.linkOps.canSend(input.senderId, recipient.agentId);
      if (result.allowed) {
        allowedRecipients.push(recipient);
      } else {
        blockedRecipients.push({
          agentId: recipient.agentId,
          reason: result.reason ?? "blocked",
        });
      }
    }

    if (allowedRecipients.length === 0) {
      return {
        message: null,
        blockedRecipients,
        sent: false,
      };
    }

    const filteredInput = { ...input, recipients: allowedRecipients };
    const message = await this.lock.acquire("messages", () =>
      this.messageOps.sendMessage(filteredInput)
    );

    return {
      message,
      blockedRecipients,
      sent: true,
    };
  }

  /**
   * Reply to a message within the same thread.
   */
  async replyMessage(
    originalMessageId: number,
    senderId: number,
    body: string
  ): Promise<Message> {
    this.assertReady();
    return this.lock.acquire("messages", () =>
      this.messageOps.replyMessage(originalMessageId, senderId, body)
    );
  }

  /**
   * Fetch inbox messages for an agent.
   */
  async fetchInbox(agentId: number, options?: FetchInboxOptions): Promise<Message[]> {
    this.assertReady();
    return this.messageOps.fetchInbox(agentId, options);
  }

  /**
   * Get a single message by ID.
   */
  async getMessage(id: number): Promise<Message | null> {
    this.assertReady();
    return this.messageOps.getMessage(id);
  }

  /**
   * Get all messages in a thread.
   */
  async getThread(threadId: string): Promise<Message[]> {
    this.assertReady();
    return this.messageOps.getThread(threadId);
  }

  /**
   * Mark a message as read for an agent.
   */
  async markRead(messageId: number, agentId: number): Promise<void> {
    this.assertReady();
    return this.messageOps.markRead(messageId, agentId);
  }

  /**
   * Acknowledge a message for an agent.
   */
  async acknowledge(messageId: number, agentId: number): Promise<void> {
    this.assertReady();
    return this.messageOps.acknowledge(messageId, agentId);
  }

  /**
   * Count unread messages for an agent.
   */
  async countUnread(agentId: number): Promise<number> {
    this.assertReady();
    return this.messageOps.countUnread(agentId);
  }

  // ============================================
  // File Reservation Operations
  // ============================================

  /**
   * Reserve files for an agent.
   *
   * Creates reservations for the given glob patterns. If exclusive mode is enabled
   * and there are conflicts with existing reservations, the operation will fail.
   *
   * @throws Error if there are conflicts with exclusive reservations
   */
  async reserveFiles(input: ReserveFilesInput): Promise<FileReservation[]> {
    this.assertReady();
    return this.lock.acquire("reservations", () => this.reservationOps.reserveFiles(input));
  }

  /**
   * Release reservations by their IDs.
   *
   * @returns Number of reservations released
   */
  async releaseReservations(reservationIds: number[]): Promise<number> {
    this.assertReady();
    return this.lock.acquire("reservations", () =>
      this.reservationOps.releaseReservations(reservationIds)
    );
  }

  /**
   * Release all reservations for an agent.
   *
   * @returns Number of reservations released
   */
  async releaseAllReservationsForAgent(agentId: number): Promise<number> {
    this.assertReady();
    return this.lock.acquire("reservations", () =>
      this.reservationOps.releaseAllForAgent(agentId)
    );
  }

  /**
   * Force release a reservation (admin operation).
   *
   * @returns True if the reservation was found and released
   */
  async forceReleaseReservation(reservationId: number): Promise<boolean> {
    this.assertReady();
    return this.lock.acquire("reservations", () =>
      this.reservationOps.forceRelease(reservationId)
    );
  }

  /**
   * Renew reservations by extending their TTL.
   *
   * @returns Number of reservations renewed
   */
  async renewReservations(
    reservationIds: number[],
    ttlSeconds: number = DEFAULT_RESERVATION_TTL_SECONDS
  ): Promise<number> {
    this.assertReady();
    return this.lock.acquire("reservations", () =>
      this.reservationOps.renewReservations(reservationIds, ttlSeconds)
    );
  }

  /**
   * Check for conflicts between patterns and existing reservations.
   */
  async checkReservationConflicts(
    projectId: number,
    agentId: number,
    patterns: string[]
  ): Promise<ConflictCheckResult> {
    this.assertReady();
    return this.reservationOps.checkConflicts(projectId, agentId, patterns);
  }

  /**
   * Get a reservation by ID.
   */
  async getReservation(id: number): Promise<FileReservation | null> {
    this.assertReady();
    return this.reservationOps.getReservation(id);
  }

  /**
   * Get all active reservations in a project.
   * Active = not released and not expired.
   */
  async getActiveReservations(projectId: number): Promise<FileReservation[]> {
    this.assertReady();
    return this.reservationOps.getActiveReservations(projectId);
  }

  /**
   * Get all reservations for an agent (including expired/released).
   */
  async getReservationsForAgent(agentId: number): Promise<FileReservation[]> {
    this.assertReady();
    return this.reservationOps.getReservationsForAgent(agentId);
  }

  /**
   * Get active reservations for an agent.
   */
  async getActiveReservationsForAgent(agentId: number): Promise<FileReservation[]> {
    this.assertReady();
    return this.reservationOps.getActiveReservationsForAgent(agentId);
  }

  /**
   * Expire stale reservations (background cleanup task).
   *
   * @returns Number of reservations expired
   */
  async expireStaleReservations(): Promise<number> {
    this.assertReady();
    return this.reservationOps.expireStaleReservations();
  }

  /**
   * Check if a specific file path is reserved by another agent.
   */
  async isFileReserved(
    projectId: number,
    agentId: number,
    filePath: string
  ): Promise<{ reserved: boolean; reservedBy?: FileReservation }> {
    this.assertReady();
    return this.reservationOps.isFileReserved(projectId, agentId, filePath);
  }

  // ============================================
  // Agent Link Operations
  // ============================================

  /**
   * Request a link with another agent.
   *
   * Creates a pending link request that the responder can approve or block.
   * The initial status depends on the responder's contact policy:
   * - open: auto-approved
   * - auto: auto-approved if same program
   * - contacts_only: pending
   * - block_all: auto-blocked
   */
  async requestLink(input: RequestLinkInput): Promise<AgentLink> {
    this.assertReady();
    return this.linkOps.requestLink(input);
  }

  /**
   * Approve a pending link request by link ID.
   *
   * @returns True if the link was approved
   */
  async approveLink(linkId: number): Promise<boolean> {
    this.assertReady();
    return this.linkOps.approveLink(linkId);
  }

  /**
   * Approve a link request from a specific agent.
   *
   * @param responderId - The agent approving (the responder)
   * @param requesterId - The agent who requested the link
   * @returns True if the link was approved
   */
  async approveLinkFrom(responderId: number, requesterId: number): Promise<boolean> {
    this.assertReady();
    return this.linkOps.approveLinkFrom(responderId, requesterId);
  }

  /**
   * Block a link by link ID.
   *
   * @returns True if the link was blocked
   */
  async blockLink(linkId: number): Promise<boolean> {
    this.assertReady();
    return this.linkOps.blockLink(linkId);
  }

  /**
   * Block a link from a specific agent.
   * Creates a blocked link if none exists.
   *
   * @param responderId - The agent blocking (the responder)
   * @param requesterId - The agent to block
   * @returns True if the link was blocked
   */
  async blockLinkFrom(responderId: number, requesterId: number): Promise<boolean> {
    this.assertReady();
    return this.linkOps.blockLinkFrom(responderId, requesterId);
  }

  /**
   * Unblock a previously blocked link.
   *
   * @returns True if the link was unblocked
   */
  async unblockLink(linkId: number): Promise<boolean> {
    this.assertReady();
    return this.linkOps.unblockLink(linkId);
  }

  /**
   * Delete a link entirely.
   *
   * @returns True if the link was deleted
   */
  async deleteLink(linkId: number): Promise<boolean> {
    this.assertReady();
    return this.linkOps.deleteLink(linkId);
  }

  /**
   * Get a link by ID.
   */
  async getLink(id: number): Promise<AgentLink | null> {
    this.assertReady();
    return this.linkOps.getLink(id);
  }

  /**
   * Get the link between two agents (if any).
   */
  async getLinkBetween(agentA: number, agentB: number): Promise<AgentLink | null> {
    this.assertReady();
    return this.linkOps.getLinkBetween(agentA, agentB);
  }

  /**
   * Get all links for an agent.
   */
  async getLinksForAgent(agentId: number): Promise<AgentLink[]> {
    this.assertReady();
    return this.linkOps.getLinksForAgent(agentId);
  }

  /**
   * Get pending link requests for an agent.
   */
  async getPendingLinkRequests(agentId: number): Promise<AgentLink[]> {
    this.assertReady();
    return this.linkOps.getPendingRequestsForAgent(agentId);
  }

  /**
   * Get approved contacts for an agent.
   */
  async getApprovedContacts(agentId: number): Promise<AgentLink[]> {
    this.assertReady();
    return this.linkOps.getApprovedContacts(agentId);
  }

  /**
   * Get blocked links for an agent.
   */
  async getBlockedLinks(agentId: number): Promise<AgentLink[]> {
    this.assertReady();
    return this.linkOps.getBlockedLinks(agentId);
  }

  /**
   * Check if an agent can send a message to another agent.
   *
   * This checks the recipient's contact policy and any existing link status.
   */
  async canSend(senderId: number, recipientId: number): Promise<CanSendResult> {
    this.assertReady();
    return this.linkOps.canSend(senderId, recipientId);
  }

  // ============================================
  // Internal Helpers
  // ============================================

  private assertReady(): void {
    if (!this.initialized) {
      throw new Error("AgentMailCore not initialized. Call initialize() first.");
    }
  }

  // ============================================
  // Accessors for Advanced Usage
  // ============================================

  /** Get the database adapter (for advanced operations) */
  get database(): DatabaseAdapter {
    return this.db;
  }

  /** Get the storage adapter (for advanced operations) */
  get storageAdapter(): StorageAdapter {
    return this.storage;
  }

  /** Get the lock adapter (for advanced operations) */
  get lockAdapter(): LockAdapter {
    return this.lock;
  }

  /** Get the glob adapter (for advanced operations) */
  get globAdapter(): GlobAdapter {
    return this.glob;
  }

  /** Get the resolved configuration */
  get configuration(): Required<AgentMailConfig> {
    return this.config;
  }
}
