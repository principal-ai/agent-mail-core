/**
 * SQL schema for Agent Mail Core database.
 *
 * Includes tables for projects, agents, messages, recipients,
 * file reservations, and agent links.
 */
export const SCHEMA = `
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  human_key TEXT NOT NULL,
  identity_mode TEXT NOT NULL DEFAULT 'dir',
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  program TEXT NOT NULL,
  model TEXT NOT NULL,
  task TEXT,
  inception_ts TEXT NOT NULL,
  last_active_ts TEXT NOT NULL,
  attachments_policy TEXT NOT NULL DEFAULT 'accept',
  contact_policy TEXT NOT NULL DEFAULT 'open',
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_agents_project_id ON agents(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  thread_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  importance TEXT NOT NULL DEFAULT 'normal',
  requires_ack INTEGER NOT NULL DEFAULT 0,
  ack_ttl_seconds INTEGER,
  attachments TEXT NOT NULL DEFAULT '[]',
  created_ts TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (sender_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_ts ON messages(created_ts);
CREATE INDEX IF NOT EXISTS idx_messages_importance ON messages(importance);

-- Message recipients table
CREATE TABLE IF NOT EXISTS message_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'to',
  read_ts TEXT,
  ack_ts TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_message_recipients_message_id ON message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_agent_id ON message_recipients(agent_id);

-- File reservations table (Phase 2)
CREATE TABLE IF NOT EXISTS file_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  path_pattern TEXT NOT NULL,
  exclusive INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  created_ts TEXT NOT NULL,
  expires_ts TEXT NOT NULL,
  released_ts TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_file_reservations_project_id ON file_reservations(project_id);
CREATE INDEX IF NOT EXISTS idx_file_reservations_agent_id ON file_reservations(agent_id);
CREATE INDEX IF NOT EXISTS idx_file_reservations_expires_ts ON file_reservations(expires_ts);

-- Agent links table (Phase 3)
CREATE TABLE IF NOT EXISTS agent_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL,
  responder_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_ts TEXT NOT NULL,
  updated_ts TEXT NOT NULL,
  FOREIGN KEY (requester_id) REFERENCES agents(id),
  FOREIGN KEY (responder_id) REFERENCES agents(id),
  UNIQUE(requester_id, responder_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_links_requester_id ON agent_links(requester_id);
CREATE INDEX IF NOT EXISTS idx_agent_links_responder_id ON agent_links(responder_id);
CREATE INDEX IF NOT EXISTS idx_agent_links_status ON agent_links(status);
`;

/**
 * Apply the schema to a database adapter.
 */
export async function applySchema(
  db: { exec: (sql: string) => Promise<void> }
): Promise<void> {
  await db.exec(SCHEMA);
}
