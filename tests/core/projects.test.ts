import { describe, it, expect, beforeEach } from "vitest";
import { createTestCore, type AgentMailCore } from "../../src/index.js";

describe("Project Operations", () => {
  let core: AgentMailCore;

  beforeEach(async () => {
    core = createTestCore();
    await core.initialize();
  });

  it("should create a new project", async () => {
    const project = await core.ensureProject({ slug: "my-project" });

    expect(project.id).toBe(1);
    expect(project.slug).toBe("my-project");
    expect(project.humanKey).toBe("my-project");
    expect(project.identityMode).toBe("dir");
  });

  it("should return existing project if slug matches", async () => {
    const project1 = await core.ensureProject({ slug: "test-project" });
    const project2 = await core.ensureProject({ slug: "test-project" });

    expect(project1.id).toBe(project2.id);
    expect(project1.slug).toBe(project2.slug);
  });

  it("should slugify the input", async () => {
    const project = await core.ensureProject({ slug: "My Project Name" });
    expect(project.slug).toBe("my-project-name");
  });

  it("should use humanKey if provided", async () => {
    const project = await core.ensureProject({
      slug: "my-project",
      humanKey: "/path/to/my-project",
    });
    expect(project.humanKey).toBe("/path/to/my-project");
  });

  it("should get project by ID", async () => {
    const created = await core.ensureProject({ slug: "test" });
    const fetched = await core.getProject(created.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.slug).toBe("test");
  });

  it("should get project by slug", async () => {
    await core.ensureProject({ slug: "find-me" });
    const fetched = await core.getProjectBySlug("find-me");

    expect(fetched).not.toBeNull();
    expect(fetched!.slug).toBe("find-me");
  });

  it("should return null for non-existent project", async () => {
    const project = await core.getProject(999);
    expect(project).toBeNull();
  });

  it("should list all projects", async () => {
    await core.ensureProject({ slug: "project-1" });
    await core.ensureProject({ slug: "project-2" });
    await core.ensureProject({ slug: "project-3" });

    const projects = await core.listProjects();
    expect(projects.length).toBe(3);
  });
});
