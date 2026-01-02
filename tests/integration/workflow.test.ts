import { describe, it, expect, beforeEach } from "vitest";
import { createTestCore, type AgentMailCore } from "../../src/index.js";

describe("End-to-End Workflow", () => {
  let core: AgentMailCore;

  beforeEach(async () => {
    core = createTestCore();
    await core.initialize();
  });

  it("should support a complete agent communication workflow", async () => {
    // 1. Create a project
    const project = await core.ensureProject({
      slug: "my-awesome-project",
      humanKey: "/home/user/projects/my-awesome-project",
    });
    expect(project.slug).toBe("my-awesome-project");

    // 2. Register two agents
    const alice = await core.registerAgent({
      projectId: project.id,
      program: "claude-code",
      model: "opus-4",
      task: "Implementing authentication",
    });

    const bob = await core.registerAgent({
      projectId: project.id,
      program: "codex",
      model: "gpt-5",
      task: "Writing tests",
    });

    expect(alice.name).toBeDefined();
    expect(bob.name).toBeDefined();
    expect(alice.name).not.toBe(bob.name);

    // 3. Alice sends a message to Bob
    const message = await core.sendMessage({
      senderId: alice.id,
      recipients: [{ agentId: bob.id, kind: "to" }],
      subject: "Authentication module ready",
      body: `Hey ${bob.name},

I've finished the authentication module. The main files are:
- src/auth/login.ts
- src/auth/session.ts

Can you write tests for these?

Thanks!`,
      importance: "high",
      requiresAck: true,
    });

    expect(message.threadId).toBeDefined();

    // 4. Bob checks his inbox
    const bobInbox = await core.fetchInbox(bob.id);
    expect(bobInbox.length).toBe(1);
    expect(bobInbox[0].subject).toBe("Authentication module ready");

    // 5. Bob reads and acknowledges the message
    await core.markRead(message.id, bob.id);
    await core.acknowledge(message.id, bob.id);

    // 6. Bob replies
    const reply = await core.replyMessage(
      message.id,
      bob.id,
      `Thanks ${alice.name}!

I'll start working on the tests now. Expected completion in about an hour.`
    );

    expect(reply.threadId).toBe(message.threadId);

    // 7. Alice checks her inbox
    const aliceInbox = await core.fetchInbox(alice.id);
    expect(aliceInbox.length).toBe(1);

    // 8. Get the full thread
    const thread = await core.getThread(message.threadId);
    expect(thread.length).toBe(2);
    expect(thread[0].senderId).toBe(alice.id);
    expect(thread[1].senderId).toBe(bob.id);

    // 9. Verify agents can be looked up
    const foundAlice = await core.whois(project.id, alice.name);
    expect(foundAlice).not.toBeNull();
    expect(foundAlice!.task).toBe("Implementing authentication");
  });

  it("should support multi-project scenarios", async () => {
    // Create two projects
    const frontend = await core.ensureProject({ slug: "frontend" });
    const backend = await core.ensureProject({ slug: "backend" });

    // Register agents in each
    const frontendAgent = await core.registerAgent({
      projectId: frontend.id,
      program: "claude-code",
      model: "opus-4",
    });

    const backendAgent = await core.registerAgent({
      projectId: backend.id,
      program: "claude-code",
      model: "opus-4",
    });

    // Agents in different projects can have the same name
    // (names are unique within a project, not globally)
    expect(frontendAgent.projectId).not.toBe(backendAgent.projectId);

    // List projects
    const projects = await core.listProjects();
    expect(projects.length).toBe(2);

    // List agents per project
    const frontendAgents = await core.listAgents(frontend.id);
    const backendAgents = await core.listAgents(backend.id);

    expect(frontendAgents.length).toBe(1);
    expect(backendAgents.length).toBe(1);
  });

  it("should handle multiple recipients", async () => {
    const project = await core.ensureProject({ slug: "team-project" });

    const lead = await core.registerAgent({
      projectId: project.id,
      program: "lead",
      model: "opus-4",
    });

    const dev1 = await core.registerAgent({
      projectId: project.id,
      program: "dev1",
      model: "opus-4",
    });

    const dev2 = await core.registerAgent({
      projectId: project.id,
      program: "dev2",
      model: "opus-4",
    });

    // Lead sends announcement to team
    await core.sendMessage({
      senderId: lead.id,
      recipients: [
        { agentId: dev1.id, kind: "to" },
        { agentId: dev2.id, kind: "to" },
      ],
      subject: "Sprint planning",
      body: "Team meeting in 10 minutes",
      importance: "high",
    });

    // Both devs should have the message
    const dev1Inbox = await core.fetchInbox(dev1.id);
    const dev2Inbox = await core.fetchInbox(dev2.id);

    expect(dev1Inbox.length).toBe(1);
    expect(dev2Inbox.length).toBe(1);
    expect(dev1Inbox[0].subject).toBe("Sprint planning");
    expect(dev2Inbox[0].subject).toBe("Sprint planning");
  });

  it("should properly track read/unread status per recipient", async () => {
    const project = await core.ensureProject({ slug: "tracking-test" });

    const sender = await core.registerAgent({
      projectId: project.id,
      program: "sender",
      model: "test",
    });

    const recipient1 = await core.registerAgent({
      projectId: project.id,
      program: "r1",
      model: "test",
    });

    const recipient2 = await core.registerAgent({
      projectId: project.id,
      program: "r2",
      model: "test",
    });

    const message = await core.sendMessage({
      senderId: sender.id,
      recipients: [
        { agentId: recipient1.id, kind: "to" },
        { agentId: recipient2.id, kind: "to" },
      ],
      subject: "Test",
      body: "Test message",
    });

    // Initially both have 1 unread
    expect(await core.countUnread(recipient1.id)).toBe(1);
    expect(await core.countUnread(recipient2.id)).toBe(1);

    // Recipient 1 reads the message
    await core.markRead(message.id, recipient1.id);

    // Now only recipient 2 has unread
    expect(await core.countUnread(recipient1.id)).toBe(0);
    expect(await core.countUnread(recipient2.id)).toBe(1);
  });
});
