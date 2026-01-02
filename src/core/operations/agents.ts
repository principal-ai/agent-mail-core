import type { DatabaseAdapter } from "../abstractions/database.js";
import type { Agent, RegisterAgentInput, AgentRow } from "../models/agent.js";
import { agentFromRow } from "../models/agent.js";
import { generateAgentName, validateAgentName } from "../validation/agent-name.js";
import { now } from "../validation/slugify.js";
import type { AgentNameEnforcement } from "../types/enums.js";

/**
 * Agent operations for managing agent identities.
 */
export class AgentOperations {
  constructor(
    private db: DatabaseAdapter,
    private nameEnforcement: AgentNameEnforcement = "coerce"
  ) {}

  /**
   * Register a new agent in a project.
   *
   * If no name is provided, one will be auto-generated.
   * If the provided name is invalid (based on enforcement mode),
   * it will be handled according to the enforcement setting.
   */
  async registerAgent(input: RegisterAgentInput): Promise<Agent> {
    let name = input.name;

    // Handle name based on enforcement mode
    if (this.nameEnforcement === "always_auto" || !name) {
      name = await this.generateUniqueName(input.projectId);
    } else if (this.nameEnforcement === "strict") {
      if (!validateAgentName(name)) {
        throw new Error(
          `Invalid agent name "${name}". Must be a valid adjective+noun combination.`
        );
      }
      // Check uniqueness
      const existing = await this.getAgentByName(input.projectId, name);
      if (existing) {
        throw new Error(
          `Agent name "${name}" already exists in this project.`
        );
      }
    } else {
      // coerce mode - use provided name if valid, otherwise generate
      if (!validateAgentName(name)) {
        name = await this.generateUniqueName(input.projectId);
      } else {
        // Check uniqueness
        const existing = await this.getAgentByName(input.projectId, name);
        if (existing) {
          name = await this.generateUniqueName(input.projectId);
        }
      }
    }

    const timestamp = now();
    const result = await this.db.run(
      `INSERT INTO agents (
        project_id, name, program, model, task,
        inception_ts, last_active_ts, attachments_policy, contact_policy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.projectId,
        name,
        input.program,
        input.model,
        input.task ?? null,
        timestamp,
        timestamp,
        input.attachmentsPolicy ?? "accept",
        input.contactPolicy ?? "open",
      ]
    );

    return {
      id: Number(result.lastInsertRowid),
      projectId: input.projectId,
      name,
      program: input.program,
      model: input.model,
      task: input.task ?? null,
      inceptionTs: timestamp,
      lastActiveTs: timestamp,
      attachmentsPolicy: input.attachmentsPolicy ?? "accept",
      contactPolicy: input.contactPolicy ?? "open",
    };
  }

  /**
   * Get an agent by its ID.
   */
  async getAgent(id: number): Promise<Agent | null> {
    const row = await this.db.get<AgentRow>(
      "SELECT * FROM agents WHERE id = ?",
      [id]
    );
    return row ? agentFromRow(row) : null;
  }

  /**
   * Get an agent by name within a project.
   */
  async getAgentByName(projectId: number, name: string): Promise<Agent | null> {
    const row = await this.db.get<AgentRow>(
      "SELECT * FROM agents WHERE project_id = ? AND name = ?",
      [projectId, name]
    );
    return row ? agentFromRow(row) : null;
  }

  /**
   * Look up an agent's details (alias for getAgentByName).
   */
  async whois(projectId: number, name: string): Promise<Agent | null> {
    return this.getAgentByName(projectId, name);
  }

  /**
   * List all agents in a project.
   */
  async listAgents(projectId: number): Promise<Agent[]> {
    const rows = await this.db.all<AgentRow>(
      "SELECT * FROM agents WHERE project_id = ? ORDER BY inception_ts DESC",
      [projectId]
    );
    return rows.map(agentFromRow);
  }

  /**
   * Update an agent's last active timestamp.
   */
  async touchAgent(agentId: number): Promise<void> {
    await this.db.run(
      "UPDATE agents SET last_active_ts = ? WHERE id = ?",
      [now(), agentId]
    );
  }

  /**
   * Update an agent's task description.
   */
  async updateTask(agentId: number, task: string | null): Promise<void> {
    await this.db.run(
      "UPDATE agents SET task = ?, last_active_ts = ? WHERE id = ?",
      [task, now(), agentId]
    );
  }

  /**
   * Update an agent's contact policy.
   */
  async setContactPolicy(
    agentId: number,
    policy: Agent["contactPolicy"]
  ): Promise<void> {
    await this.db.run(
      "UPDATE agents SET contact_policy = ?, last_active_ts = ? WHERE id = ?",
      [policy, now(), agentId]
    );
  }

  /**
   * Delete an agent.
   */
  async deleteAgent(id: number): Promise<boolean> {
    const result = await this.db.run("DELETE FROM agents WHERE id = ?", [id]);
    return result.changes > 0;
  }

  /**
   * Generate a unique agent name for a project.
   */
  private async generateUniqueName(projectId: number): Promise<string> {
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const name = generateAgentName();
      const existing = await this.getAgentByName(projectId, name);
      if (!existing) {
        return name;
      }
    }
    throw new Error(
      "Could not generate unique agent name after 100 attempts"
    );
  }
}
