import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestCore,
  type AgentMailCore,
  isReservationActive,
  DEFAULT_RESERVATION_TTL_SECONDS,
} from "../../src/index.js";

describe("File Reservation Operations", () => {
  let core: AgentMailCore;
  let projectId: number;
  let agent1: { id: number; name: string };
  let agent2: { id: number; name: string };

  beforeEach(async () => {
    core = createTestCore();
    await core.initialize();

    const project = await core.ensureProject({ slug: "test-project" });
    projectId = project.id;

    const a1 = await core.registerAgent({
      projectId,
      program: "agent-1",
      model: "test",
    });
    agent1 = { id: a1.id, name: a1.name };

    const a2 = await core.registerAgent({
      projectId,
      program: "agent-2",
      model: "test",
    });
    agent2 = { id: a2.id, name: a2.name };
  });

  describe("reserveFiles", () => {
    it("should create a file reservation", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
        reason: "Refactoring TypeScript files",
      });

      expect(reservations.length).toBe(1);
      expect(reservations[0].agentId).toBe(agent1.id);
      expect(reservations[0].pathPattern).toBe("src/**/*.ts");
      expect(reservations[0].exclusive).toBe(true);
      expect(reservations[0].reason).toBe("Refactoring TypeScript files");
      expect(reservations[0].releasedTs).toBeNull();
    });

    it("should create multiple reservations at once", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts", "tests/**/*.ts", "*.json"],
      });

      expect(reservations.length).toBe(3);
    });

    it("should create non-exclusive reservations", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["README.md"],
        exclusive: false,
      });

      expect(reservations[0].exclusive).toBe(false);
    });

    it("should throw on conflicting exclusive reservations", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      await expect(
        core.reserveFiles({
          agentId: agent2.id,
          patterns: ["src/**/*.ts"],
        })
      ).rejects.toThrow(/conflicts/);
    });

    it("should allow non-exclusive reservations on already reserved files", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      const reservations = await core.reserveFiles({
        agentId: agent2.id,
        patterns: ["src/**/*.ts"],
        exclusive: false,
      });

      expect(reservations.length).toBe(1);
    });

    it("should use custom TTL", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/index.ts"],
        ttlSeconds: 60,
      });

      const createdTime = new Date(reservations[0].createdTs).getTime();
      const expiresTime = new Date(reservations[0].expiresTs).getTime();

      // Should expire approximately 60 seconds after creation
      expect(expiresTime - createdTime).toBeGreaterThanOrEqual(59000);
      expect(expiresTime - createdTime).toBeLessThanOrEqual(61000);
    });
  });

  describe("releaseReservations", () => {
    it("should release a reservation by ID", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      const released = await core.releaseReservations([reservations[0].id]);
      expect(released).toBe(1);

      const reservation = await core.getReservation(reservations[0].id);
      expect(reservation?.releasedTs).not.toBeNull();
    });

    it("should allow new reservation after release", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      await core.releaseReservations([reservations[0].id]);

      const newReservations = await core.reserveFiles({
        agentId: agent2.id,
        patterns: ["src/**/*.ts"],
      });

      expect(newReservations.length).toBe(1);
    });
  });

  describe("releaseAllReservationsForAgent", () => {
    it("should release all reservations for an agent", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts", "tests/**/*.ts", "*.json"],
      });

      const released = await core.releaseAllReservationsForAgent(agent1.id);
      expect(released).toBe(3);

      const active = await core.getActiveReservationsForAgent(agent1.id);
      expect(active.length).toBe(0);
    });
  });

  describe("renewReservations", () => {
    it("should extend reservation TTL", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
        ttlSeconds: 60,
      });

      const originalExpires = reservations[0].expiresTs;

      const renewed = await core.renewReservations(
        [reservations[0].id],
        3600
      );
      expect(renewed).toBe(1);

      const updated = await core.getReservation(reservations[0].id);
      expect(new Date(updated!.expiresTs).getTime()).toBeGreaterThan(
        new Date(originalExpires).getTime()
      );
    });

    it("should use default TTL when not specified", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
        ttlSeconds: 60,
      });

      const renewed = await core.renewReservations([reservations[0].id]);
      expect(renewed).toBe(1);

      const updated = await core.getReservation(reservations[0].id);
      const now = Date.now();
      const expiresTime = new Date(updated!.expiresTs).getTime();

      // Should be close to DEFAULT_RESERVATION_TTL_SECONDS from now
      const expectedMin = now + (DEFAULT_RESERVATION_TTL_SECONDS - 5) * 1000;
      const expectedMax = now + (DEFAULT_RESERVATION_TTL_SECONDS + 5) * 1000;
      expect(expiresTime).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresTime).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe("checkReservationConflicts", () => {
    it("should detect conflicting reservations", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      const result = await core.checkReservationConflicts(
        projectId,
        agent2.id,
        ["src/**/*.ts"]
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].agentId).toBe(agent1.id);
    });

    it("should not report conflicts for own reservations", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      const result = await core.checkReservationConflicts(
        projectId,
        agent1.id,
        ["src/**/*.ts"]
      );

      expect(result.hasConflicts).toBe(false);
    });

    it("should not report conflicts for non-exclusive reservations", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
        exclusive: false,
      });

      const result = await core.checkReservationConflicts(
        projectId,
        agent2.id,
        ["src/**/*.ts"]
      );

      expect(result.hasConflicts).toBe(false);
    });
  });

  describe("getActiveReservations", () => {
    it("should return active reservations in a project", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      await core.reserveFiles({
        agentId: agent2.id,
        patterns: ["tests/**/*.ts"],
      });

      const active = await core.getActiveReservations(projectId);
      expect(active.length).toBe(2);
    });

    it("should not return released reservations", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      await core.releaseReservations([reservations[0].id]);

      const active = await core.getActiveReservations(projectId);
      expect(active.length).toBe(0);
    });
  });

  describe("isFileReserved", () => {
    it("should detect if a file is reserved by another agent", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      const result = await core.isFileReserved(
        projectId,
        agent2.id,
        "src/core/index.ts"
      );

      expect(result.reserved).toBe(true);
      expect(result.reservedBy?.agentId).toBe(agent1.id);
    });

    it("should not report own reservations as conflicts", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      const result = await core.isFileReserved(
        projectId,
        agent1.id,
        "src/core/index.ts"
      );

      expect(result.reserved).toBe(false);
    });

    it("should not report non-matching paths", async () => {
      await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      const result = await core.isFileReserved(
        projectId,
        agent2.id,
        "tests/core/index.ts"
      );

      expect(result.reserved).toBe(false);
    });
  });

  describe("isReservationActive helper", () => {
    it("should return true for active reservations", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      expect(isReservationActive(reservations[0])).toBe(true);
    });

    it("should return false for released reservations", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      await core.releaseReservations([reservations[0].id]);

      const released = await core.getReservation(reservations[0].id);
      expect(isReservationActive(released!)).toBe(false);
    });
  });

  describe("forceReleaseReservation", () => {
    it("should force release any reservation", async () => {
      const reservations = await core.reserveFiles({
        agentId: agent1.id,
        patterns: ["src/**/*.ts"],
      });

      const result = await core.forceReleaseReservation(reservations[0].id);
      expect(result).toBe(true);

      const reservation = await core.getReservation(reservations[0].id);
      expect(reservation?.releasedTs).not.toBeNull();
    });
  });
});
