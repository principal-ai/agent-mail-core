import { describe, it, expect, beforeEach } from "vitest";
import { createTestCore, type AgentMailCore } from "../../src/index.js";

describe("Message Operations", () => {
  let core: AgentMailCore;
  let projectId: number;
  let sender: { id: number; name: string };
  let recipient: { id: number; name: string };

  beforeEach(async () => {
    core = createTestCore();
    await core.initialize();

    const project = await core.ensureProject({ slug: "test-project" });
    projectId = project.id;

    const s = await core.registerAgent({
      projectId,
      program: "sender",
      model: "test",
    });
    sender = { id: s.id, name: s.name };

    const r = await core.registerAgent({
      projectId,
      program: "recipient",
      model: "test",
    });
    recipient = { id: r.id, name: r.name };
  });

  it("should send a message", async () => {
    const message = await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Hello",
      body: "This is a test message",
    });

    expect(message.id).toBe(1);
    expect(message.senderId).toBe(sender.id);
    expect(message.subject).toBe("Hello");
    expect(message.body).toBe("This is a test message");
    expect(message.importance).toBe("normal");
    expect(message.threadId).toBeDefined();
  });

  it("should fetch inbox messages", async () => {
    await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Message 1",
      body: "Body 1",
    });

    await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Message 2",
      body: "Body 2",
    });

    const inbox = await core.fetchInbox(recipient.id);
    expect(inbox.length).toBe(2);
  });

  it("should fetch only unread messages", async () => {
    const msg1 = await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Message 1",
      body: "Body 1",
    });

    await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Message 2",
      body: "Body 2",
    });

    await core.markRead(msg1.id, recipient.id);

    const unread = await core.fetchInbox(recipient.id, { unreadOnly: true });
    expect(unread.length).toBe(1);
    expect(unread[0].subject).toBe("Message 2");
  });

  it("should mark message as read", async () => {
    const message = await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Test",
      body: "Test body",
    });

    await core.markRead(message.id, recipient.id);

    const unread = await core.countUnread(recipient.id);
    expect(unread).toBe(0);
  });

  it("should acknowledge a message", async () => {
    const message = await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Urgent",
      body: "Please acknowledge",
      requiresAck: true,
    });

    await core.acknowledge(message.id, recipient.id);

    // Acknowledging also marks as read
    const unread = await core.countUnread(recipient.id);
    expect(unread).toBe(0);
  });

  it("should support threading", async () => {
    const msg1 = await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Thread Start",
      body: "Starting a thread",
    });

    await core.sendMessage({
      senderId: recipient.id,
      recipients: [{ agentId: sender.id, kind: "to" }],
      subject: "Re: Thread Start",
      body: "Reply in thread",
      threadId: msg1.threadId,
    });

    const thread = await core.getThread(msg1.threadId);
    expect(thread.length).toBe(2);
  });

  it("should reply to a message", async () => {
    const original = await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Original",
      body: "Original message",
    });

    const reply = await core.replyMessage(
      original.id,
      recipient.id,
      "This is my reply"
    );

    expect(reply.subject).toBe("Re: Original");
    expect(reply.threadId).toBe(original.threadId);
    expect(reply.senderId).toBe(recipient.id);
  });

  it("should support CC recipients", async () => {
    const cc = await core.registerAgent({
      projectId,
      program: "cc-agent",
      model: "test",
    });

    await core.sendMessage({
      senderId: sender.id,
      recipients: [
        { agentId: recipient.id, kind: "to" },
        { agentId: cc.id, kind: "cc" },
      ],
      subject: "With CC",
      body: "Message with CC recipient",
    });

    const recipientInbox = await core.fetchInbox(recipient.id);
    const ccInbox = await core.fetchInbox(cc.id);

    expect(recipientInbox.length).toBe(1);
    expect(ccInbox.length).toBe(1);
  });

  it("should count unread messages", async () => {
    await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Message 1",
      body: "Body 1",
    });

    await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Message 2",
      body: "Body 2",
    });

    const count = await core.countUnread(recipient.id);
    expect(count).toBe(2);
  });

  it("should set message importance", async () => {
    const message = await core.sendMessage({
      senderId: sender.id,
      recipients: [{ agentId: recipient.id, kind: "to" }],
      subject: "Urgent!",
      body: "This is urgent",
      importance: "urgent",
    });

    expect(message.importance).toBe("urgent");
  });
});
