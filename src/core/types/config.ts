import type { AgentNameEnforcement } from "./enums.js";

/**
 * Configuration options for AgentMailCore
 */
export interface AgentMailConfig {
  /**
   * Default TTL for file reservations in seconds
   * @default 1800 (30 minutes)
   */
  fileReservationTtlSeconds?: number;

  /**
   * Default TTL for acknowledgement requirements in seconds
   * @default 86400 (24 hours)
   */
  ackTtlSeconds?: number;

  /**
   * How to handle agent name validation
   * @default "coerce"
   */
  agentNameEnforcement?: AgentNameEnforcement;

  /**
   * Automatically register unknown recipients when sending messages
   * @default false
   */
  autoRegisterRecipients?: boolean;

  /**
   * Storage root path for git archives
   * @default "~/.agent-mail"
   */
  storageRoot?: string;

  /**
   * Git author name for commits
   * @default "agent-mail"
   */
  gitAuthorName?: string;

  /**
   * Git author email for commits
   * @default "agent-mail@localhost"
   */
  gitAuthorEmail?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<AgentMailConfig> = {
  fileReservationTtlSeconds: 1800,
  ackTtlSeconds: 86400,
  agentNameEnforcement: "coerce",
  autoRegisterRecipients: false,
  storageRoot: "~/.agent-mail",
  gitAuthorName: "agent-mail",
  gitAuthorEmail: "agent-mail@localhost",
};

/**
 * Merge user config with defaults
 */
export function resolveConfig(
  config?: Partial<AgentMailConfig>
): Required<AgentMailConfig> {
  return { ...DEFAULT_CONFIG, ...config };
}
