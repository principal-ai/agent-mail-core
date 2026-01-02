import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestCore,
  validateAgentName,
  type AgentMailCore,
} from "../../src/index.js";

describe("Agent Operations", () => {
  let core: AgentMailCore;
  let projectId: number;

  beforeEach(async () => {
    core = createTestCore();
    await core.initialize();
    const project = await core.ensureProject({ slug: "test-project" });
    projectId = project.id;
  });

  it("should register an agent with auto-generated name", async () => {
    const agent = await core.registerAgent({
      projectId,
      program: "claude-code",
      model: "opus-4",
    });

    expect(agent.id).toBe(1);
    expect(agent.projectId).toBe(projectId);
    expect(validateAgentName(agent.name)).toBe(true);
    expect(agent.program).toBe("claude-code");
    expect(agent.model).toBe("opus-4");
    expect(agent.contactPolicy).toBe("open");
  });

  it("should register an agent with provided valid name", async () => {
    const agent = await core.registerAgent({
      projectId,
      name: "GreenLake",
      program: "codex",
      model: "gpt-5",
    });

    expect(agent.name).toBe("GreenLake");
  });

  it("should auto-generate name if provided name is invalid (coerce mode)", async () => {
    const agent = await core.registerAgent({
      projectId,
      name: "InvalidName",
      program: "cursor",
      model: "claude-3",
    });

    expect(agent.name).not.toBe("InvalidName");
    expect(validateAgentName(agent.name)).toBe(true);
  });

  it("should get agent by ID", async () => {
    const created = await core.registerAgent({
      projectId,
      program: "test",
      model: "test",
    });

    const fetched = await core.getAgent(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe(created.name);
  });

  it("should get agent by name (whois)", async () => {
    const created = await core.registerAgent({
      projectId,
      name: "BlueFox",
      program: "test",
      model: "test",
    });

    const fetched = await core.whois(projectId, "BlueFox");
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
  });

  it("should return null for non-existent agent", async () => {
    const agent = await core.getAgent(999);
    expect(agent).toBeNull();
  });

  it("should list all agents in a project", async () => {
    await core.registerAgent({ projectId, program: "agent1", model: "m1" });
    await core.registerAgent({ projectId, program: "agent2", model: "m2" });
    await core.registerAgent({ projectId, program: "agent3", model: "m3" });

    const agents = await core.listAgents(projectId);
    expect(agents.length).toBe(3);
  });

  it("should update agent task", async () => {
    const agent = await core.registerAgent({
      projectId,
      program: "test",
      model: "test",
    });

    await core.updateAgentTask(agent.id, "Working on feature X");

    const updated = await core.getAgent(agent.id);
    expect(updated!.task).toBe("Working on feature X");
  });

  it("should generate unique names for multiple agents", async () => {
    const names = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const agent = await core.registerAgent({
        projectId,
        program: "test",
        model: "test",
      });
      names.add(agent.name);
    }

    expect(names.size).toBe(20);
  });
});
