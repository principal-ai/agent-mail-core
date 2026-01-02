import { describe, it, expect, beforeEach } from "vitest";
import { createTestCore, type AgentMailCore } from "../../src/index.js";

describe("Agent Link Operations", () => {
  let core: AgentMailCore;
  let projectId: number;

  beforeEach(async () => {
    core = createTestCore();
    await core.initialize();

    const project = await core.ensureProject({ slug: "test-project" });
    projectId = project.id;
  });

  describe("requestLink", () => {
    it("should create a pending link with contacts_only policy", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "contacts_only",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      expect(link.status).toBe("pending");
      expect(link.requesterId).toBe(agent1.id);
      expect(link.responderId).toBe(agent2.id);
    });

    it("should auto-approve link with open policy", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "open",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      expect(link.status).toBe("approved");
    });

    it("should auto-approve link with auto policy for same program", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "claude-code",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "claude-code",
        model: "test",
        contactPolicy: "auto",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      expect(link.status).toBe("approved");
    });

    it("should create pending link with auto policy for different programs", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "claude-code",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "cursor",
        model: "test",
        contactPolicy: "auto",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      expect(link.status).toBe("pending");
    });

    it("should auto-block link with block_all policy", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "block_all",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      expect(link.status).toBe("blocked");
    });

    it("should return existing link if already exists", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "contacts_only",
      });

      const link1 = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      const link2 = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      expect(link2.id).toBe(link1.id);
    });
  });

  describe("approveLink", () => {
    it("should approve a pending link", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "contacts_only",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      const approved = await core.approveLink(link.id);
      expect(approved).toBe(true);

      const updated = await core.getLink(link.id);
      expect(updated?.status).toBe("approved");
    });

    it("should approve link using approveLinkFrom", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "contacts_only",
      });

      await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      const approved = await core.approveLinkFrom(agent2.id, agent1.id);
      expect(approved).toBe(true);

      const link = await core.getLinkBetween(agent1.id, agent2.id);
      expect(link?.status).toBe("approved");
    });
  });

  describe("blockLink", () => {
    it("should block a link", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "open",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      const blocked = await core.blockLink(link.id);
      expect(blocked).toBe(true);

      const updated = await core.getLink(link.id);
      expect(updated?.status).toBe("blocked");
    });

    it("should create blocked link using blockLinkFrom when no link exists", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
      });

      const blocked = await core.blockLinkFrom(agent2.id, agent1.id);
      expect(blocked).toBe(true);

      const link = await core.getLinkBetween(agent1.id, agent2.id);
      expect(link?.status).toBe("blocked");
    });
  });

  describe("unblockLink", () => {
    it("should unblock a blocked link", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "open",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      await core.blockLink(link.id);
      const unblocked = await core.unblockLink(link.id);
      expect(unblocked).toBe(true);

      const updated = await core.getLink(link.id);
      expect(updated?.status).toBe("pending");
    });
  });

  describe("deleteLink", () => {
    it("should delete a link", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "open",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      const deleted = await core.deleteLink(link.id);
      expect(deleted).toBe(true);

      const found = await core.getLink(link.id);
      expect(found).toBeNull();
    });
  });

  describe("getLinksForAgent", () => {
    it("should return all links for an agent", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "open",
      });

      const agent3 = await core.registerAgent({
        projectId,
        program: "agent-3",
        model: "test",
        contactPolicy: "open",
      });

      await core.requestLink({ requesterId: agent1.id, responderId: agent2.id });
      await core.requestLink({ requesterId: agent1.id, responderId: agent3.id });

      const links = await core.getLinksForAgent(agent1.id);
      expect(links.length).toBe(2);
    });
  });

  describe("getPendingLinkRequests", () => {
    it("should return pending requests for responder", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "contacts_only",
      });

      await core.requestLink({ requesterId: agent1.id, responderId: agent2.id });

      const pending = await core.getPendingLinkRequests(agent2.id);
      expect(pending.length).toBe(1);
      expect(pending[0].requesterId).toBe(agent1.id);
    });
  });

  describe("getApprovedContacts", () => {
    it("should return approved contacts", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "open",
      });

      await core.requestLink({ requesterId: agent1.id, responderId: agent2.id });

      const contacts = await core.getApprovedContacts(agent1.id);
      expect(contacts.length).toBe(1);
    });
  });

  describe("canSend", () => {
    it("should allow sending with open policy", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "open",
      });

      const result = await core.canSend(agent1.id, agent2.id);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("open");
    });

    it("should block sending with block_all policy", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "block_all",
      });

      const result = await core.canSend(agent1.id, agent2.id);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("block_all");
    });

    it("should allow sending with approved contact", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "contacts_only",
      });

      const link = await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });
      await core.approveLink(link.id);

      const result = await core.canSend(agent1.id, agent2.id);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("approved_contact");
    });

    it("should block sending with pending contact", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "contacts_only",
      });

      await core.requestLink({
        requesterId: agent1.id,
        responderId: agent2.id,
      });

      const result = await core.canSend(agent1.id, agent2.id);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("pending");
    });

    it("should block sending when explicitly blocked", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "agent-1",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "agent-2",
        model: "test",
        contactPolicy: "open",
      });

      await core.blockLinkFrom(agent2.id, agent1.id);

      const result = await core.canSend(agent1.id, agent2.id);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("blocked");
    });

    it("should auto-approve same program with auto policy", async () => {
      const agent1 = await core.registerAgent({
        projectId,
        program: "claude-code",
        model: "test",
      });

      const agent2 = await core.registerAgent({
        projectId,
        program: "claude-code",
        model: "test",
        contactPolicy: "auto",
      });

      const result = await core.canSend(agent1.id, agent2.id);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("auto_approved");
    });
  });
});

describe("Message Sending with Contact Policy", () => {
  let core: AgentMailCore;
  let projectId: number;

  beforeEach(async () => {
    core = createTestCore();
    await core.initialize();

    const project = await core.ensureProject({ slug: "test-project" });
    projectId = project.id;
  });

  it("should send message without policy enforcement", async () => {
    const sender = await core.registerAgent({
      projectId,
      program: "sender",
      model: "test",
    });

    const recipient = await core.registerAgent({
      projectId,
      program: "recipient",
      model: "test",
      contactPolicy: "block_all",
    });

    // Without enforcement, message should go through
    const message = await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Test",
      body: "Test body",
    });

    expect(message.id).toBeDefined();
  });

  it("should block message with policy enforcement", async () => {
    const sender = await core.registerAgent({
      projectId,
      program: "sender",
      model: "test",
    });

    const recipient = await core.registerAgent({
      projectId,
      program: "recipient",
      model: "test",
      contactPolicy: "block_all",
    });

    await expect(
      core.sendMessage({
        senderId: sender.id,
        recipients: [{ agentId: recipient.id, kind: "to" }],
        subject: "Test",
        body: "Test body",
        enforceContactPolicy: true,
      })
    ).rejects.toThrow(/blocked by contact policy/);
  });

  it("should send to allowed recipients and skip blocked ones", async () => {
    const sender = await core.registerAgent({
      projectId,
      program: "sender",
      model: "test",
    });

    const allowed = await core.registerAgent({
      projectId,
      program: "allowed",
      model: "test",
      contactPolicy: "open",
    });

    const blocked = await core.registerAgent({
      projectId,
      program: "blocked",
      model: "test",
      contactPolicy: "block_all",
    });

    const message = await core.sendMessage({
      senderId: sender.id,
      recipients: [
        { agentId: allowed.id, kind: "to" },
        { agentId: blocked.id, kind: "cc" },
      ],
      subject: "Test",
      body: "Test body",
      enforceContactPolicy: true,
    });

    expect(message.id).toBeDefined();

    // Check only allowed recipient got the message
    const allowedInbox = await core.fetchInbox(allowed.id);
    const blockedInbox = await core.fetchInbox(blocked.id);

    expect(allowedInbox.length).toBe(1);
    expect(blockedInbox.length).toBe(0);
  });

  it("should return detailed result with sendMessageWithPolicyCheck", async () => {
    const sender = await core.registerAgent({
      projectId,
      program: "sender",
      model: "test",
    });

    const allowed = await core.registerAgent({
      projectId,
      program: "allowed",
      model: "test",
      contactPolicy: "open",
    });

    const blocked = await core.registerAgent({
      projectId,
      program: "blocked",
      model: "test",
      contactPolicy: "block_all",
    });

    const result = await core.sendMessageWithPolicyCheck({
      senderId: sender.id,
      recipients: [
        { agentId: allowed.id, kind: "to" },
        { agentId: blocked.id, kind: "cc" },
      ],
      subject: "Test",
      body: "Test body",
    });

    expect(result.sent).toBe(true);
    expect(result.message).not.toBeNull();
    expect(result.blockedRecipients.length).toBe(1);
    expect(result.blockedRecipients[0].agentId).toBe(blocked.id);
    expect(result.blockedRecipients[0].reason).toBe("block_all");
  });

  it("should return not sent when all recipients blocked", async () => {
    const sender = await core.registerAgent({
      projectId,
      program: "sender",
      model: "test",
    });

    const blocked = await core.registerAgent({
      projectId,
      program: "blocked",
      model: "test",
      contactPolicy: "block_all",
    });

    const result = await core.sendMessageWithPolicyCheck({
      senderId: sender.id,
      recipients: [{ agentId: blocked.id, kind: "to" }],
      subject: "Test",
      body: "Test body",
    });

    expect(result.sent).toBe(false);
    expect(result.message).toBeNull();
    expect(result.blockedRecipients.length).toBe(1);
  });
});
