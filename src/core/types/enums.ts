/**
 * Message importance levels
 */
export type ImportanceLevel = "low" | "normal" | "high" | "urgent";

/**
 * Message delivery kind (recipient type)
 */
export type DeliveryKind = "to" | "cc" | "bcc";

/**
 * Agent contact policy for incoming messages
 */
export type ContactPolicy =
  | "open" // Accept all messages
  | "auto" // Auto-approve known programs
  | "contacts_only" // Only approved contacts
  | "block_all"; // No incoming messages

/**
 * Status of an agent link (contact request)
 */
export type LinkStatus = "pending" | "approved" | "blocked";

/**
 * How project identity is determined
 */
export type ProjectIdentityMode =
  | "dir" // Use directory name
  | "git-remote" // Use git remote URL
  | "git-common-dir" // Use git common directory
  | "git-toplevel"; // Use git top-level directory

/**
 * Agent attachment handling policy
 */
export type AttachmentsPolicy =
  | "accept" // Accept all attachments
  | "reject" // Reject all attachments
  | "ask"; // Ask before accepting

/**
 * Agent name enforcement mode
 */
export type AgentNameEnforcement =
  | "strict" // Reject invalid names
  | "coerce" // Auto-generate if invalid
  | "always_auto"; // Always auto-generate
