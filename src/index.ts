// ============================================
// Main Entry Point
// ============================================

export { AgentMailCore, type AgentMailCoreOptions } from "./core/AgentMailCore.js";

// ============================================
// Abstractions (interfaces)
// ============================================

export type {
  DatabaseAdapter,
  RunResult,
} from "./core/abstractions/database.js";

export type { StorageAdapter } from "./core/abstractions/storage.js";

export type { LockAdapter } from "./core/abstractions/lock.js";

export type { GlobAdapter, GlobOptions } from "./core/abstractions/glob.js";

// ============================================
// Models
// ============================================

export type {
  Project,
  CreateProjectInput,
} from "./core/models/project.js";

export type {
  Agent,
  RegisterAgentInput,
} from "./core/models/agent.js";

export type {
  Message,
  SendMessageInput,
  Attachment,
  BlockedRecipient,
  SendMessageResult,
} from "./core/models/message.js";

export type { MessageRecipient } from "./core/models/message-recipient.js";

export type {
  FileReservation,
  ReserveFilesInput,
  ReservationConflict,
  ConflictCheckResult,
} from "./core/models/file-reservation.js";
export { isReservationActive } from "./core/models/file-reservation.js";

export type {
  AgentLink,
  RequestLinkInput,
  CanSendResult,
} from "./core/models/agent-link.js";
export { agentLinkFromRow } from "./core/models/agent-link.js";

// ============================================
// Types & Enums
// ============================================

export type {
  ImportanceLevel,
  DeliveryKind,
  ContactPolicy,
  LinkStatus,
  ProjectIdentityMode,
  AttachmentsPolicy,
  AgentNameEnforcement,
} from "./core/types/enums.js";

export type { AgentMailConfig } from "./core/types/config.js";
export { DEFAULT_CONFIG, resolveConfig } from "./core/types/config.js";

// ============================================
// Validation Utilities
// ============================================

export {
  ADJECTIVES,
  NOUNS,
  generateAgentName,
  validateAgentName,
  parseAgentName,
} from "./core/validation/agent-name.js";

export { slugify, generateUUID, now } from "./core/validation/slugify.js";

// ============================================
// Operations (for advanced usage)
// ============================================

export { ProjectOperations } from "./core/operations/projects.js";
export { AgentOperations } from "./core/operations/agents.js";
export {
  MessageOperations,
  type FetchInboxOptions,
  type MessageWithMeta,
} from "./core/operations/messages.js";
export {
  ReservationOperations,
  DEFAULT_RESERVATION_TTL_SECONDS,
} from "./core/operations/reservations.js";
export { LinkOperations } from "./core/operations/links.js";

// ============================================
// Schema
// ============================================

export { SCHEMA, applySchema } from "./core/schema.js";

// ============================================
// Test Adapters
// ============================================

export { InMemoryDatabaseAdapter } from "./test-adapters/InMemoryDatabaseAdapter.js";
export { SqlJsDatabaseAdapter } from "./test-adapters/SqlJsDatabaseAdapter.js";
export { InMemoryStorageAdapter } from "./test-adapters/InMemoryStorageAdapter.js";
export { NoOpLockAdapter } from "./test-adapters/NoOpLockAdapter.js";
export { SimpleGlobAdapter } from "./test-adapters/SimpleGlobAdapter.js";

// ============================================
// Browser Adapters
// ============================================

export { IdbStorageAdapter } from "./browser-adapters/IdbStorageAdapter.js";
export { MicromatchGlobAdapter } from "./browser-adapters/MicromatchGlobAdapter.js";

// ============================================
// Convenience factory for testing
// ============================================

import { AgentMailCore } from "./core/AgentMailCore.js";
import { SqlJsDatabaseAdapter } from "./test-adapters/SqlJsDatabaseAdapter.js";
import { InMemoryStorageAdapter } from "./test-adapters/InMemoryStorageAdapter.js";
import { NoOpLockAdapter } from "./test-adapters/NoOpLockAdapter.js";
import { SimpleGlobAdapter } from "./test-adapters/SimpleGlobAdapter.js";

/**
 * Create an AgentMailCore instance with sql.js and in-memory adapters for testing.
 *
 * @example
 * ```typescript
 * const core = createTestCore();
 * await core.initialize();
 * ```
 */
export function createTestCore(
  config?: Partial<import("./core/types/config.js").AgentMailConfig>
): AgentMailCore {
  return new AgentMailCore({
    database: new SqlJsDatabaseAdapter(),
    storage: new InMemoryStorageAdapter(),
    lock: new NoOpLockAdapter(),
    glob: new SimpleGlobAdapter(),
    config,
  });
}
