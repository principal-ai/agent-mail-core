import type { DatabaseAdapter } from "../abstractions/database.js";
import type { Project, CreateProjectInput, ProjectRow } from "../models/project.js";
import { projectFromRow } from "../models/project.js";
import { slugify, now } from "../validation/slugify.js";

/**
 * Project operations for managing project namespaces.
 */
export class ProjectOperations {
  constructor(private db: DatabaseAdapter) {}

  /**
   * Create a new project or return existing one with the same slug.
   */
  async ensureProject(input: CreateProjectInput): Promise<Project> {
    const slug = slugify(input.slug);
    const humanKey = input.humanKey ?? slug;
    const identityMode = input.identityMode ?? "dir";

    // Check if project already exists
    const existing = await this.getProjectBySlug(slug);
    if (existing) {
      return existing;
    }

    // Create new project
    const timestamp = now();
    const result = await this.db.run(
      `INSERT INTO projects (slug, human_key, identity_mode, created_ts, updated_ts)
       VALUES (?, ?, ?, ?, ?)`,
      [slug, humanKey, identityMode, timestamp, timestamp]
    );

    return {
      id: Number(result.lastInsertRowid),
      slug,
      humanKey,
      identityMode,
      createdTs: timestamp,
      updatedTs: timestamp,
    };
  }

  /**
   * Get a project by its ID.
   */
  async getProject(id: number): Promise<Project | null> {
    const row = await this.db.get<ProjectRow>(
      "SELECT * FROM projects WHERE id = ?",
      [id]
    );
    return row ? projectFromRow(row) : null;
  }

  /**
   * Get a project by its slug.
   */
  async getProjectBySlug(slug: string): Promise<Project | null> {
    const normalizedSlug = slugify(slug);
    const row = await this.db.get<ProjectRow>(
      "SELECT * FROM projects WHERE slug = ?",
      [normalizedSlug]
    );
    return row ? projectFromRow(row) : null;
  }

  /**
   * List all projects.
   */
  async listProjects(): Promise<Project[]> {
    const rows = await this.db.all<ProjectRow>(
      "SELECT * FROM projects ORDER BY created_ts DESC"
    );
    return rows.map(projectFromRow);
  }

  /**
   * Update a project's human key.
   */
  async updateProject(
    id: number,
    updates: { humanKey?: string }
  ): Promise<Project | null> {
    const project = await this.getProject(id);
    if (!project) return null;

    const timestamp = now();
    await this.db.run(
      `UPDATE projects SET human_key = ?, updated_ts = ? WHERE id = ?`,
      [updates.humanKey ?? project.humanKey, timestamp, id]
    );

    return this.getProject(id);
  }

  /**
   * Delete a project and all its associated data.
   */
  async deleteProject(id: number): Promise<boolean> {
    const result = await this.db.run("DELETE FROM projects WHERE id = ?", [id]);
    return result.changes > 0;
  }
}
