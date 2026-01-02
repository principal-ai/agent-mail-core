# Agent Mail System Overview

This document captures how the Agent Mail system works based on the reference implementation in `mcp_agent_mail`. This serves as the functional specification for `agent-mail-core`.

## Purpose

Agent Mail is a coordination layer enabling multiple coding agents (Claude Code, Codex, Gemini CLI, etc.) to work together on the same project without conflicts. It provides:

- **Memorable agent identities** - Human-readable names like "GreenCastle", "BlueLake"
- **Message passing** - Threading, acknowledgements, importance levels
- **File reservations** - Leases to prevent concurrent editing conflicts
- **Contact management** - Cross-project communication approval
- **Git-backed storage** - Human-auditable history
- **SQLite + FTS5** - Fast message search and indexing

## High-Level Architecture

```
┌─ Coding Agents (HTTP Clients) ─────────────────────┐
│  Claude Code, Codex, Cursor, Gemini CLI, etc.      │
└────────────────────┬───────────────────────────────┘
                     │ JSON-RPC over HTTP
                     ▼
┌─ MCP Server (HTTP Transport) ──────────────────────┐
│  - MCP Tools (register, send_message, etc.)        │
│  - HTTP Transport (Streamable HTTP)                │
│  - JWT/RBAC authentication                         │
│  - Rate limiting & observability                   │
└────────────────────┬───────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌─ Git Archive ────┐     ┌─ SQLite Database ─────┐
│ Markdown files   │     │ FTS5 search index     │
│ agent profiles   │     │ metadata & relations  │
│ messages         │     │ file reservations     │
└──────────────────┘     └───────────────────────┘
```

## Core Data Model

### Projects

Per-repository identifiers mapping directory paths to stable slugs.

| Field | Type | Description |
|-------|------|-------------|
| id | PK | Primary key |
| slug | UK | Unique project identifier |
| human_key | string | Absolute path to repo |
| created_at | datetime | Creation timestamp |

### Agents

Individual agent identities within a project.

| Field | Type | Description |
|-------|------|-------------|
| id | PK | Primary key |
| project_id | FK | Parent project |
| name | UK | Memorable name (GreenCastle) |
| program | string | Agent type (claude-code, codex) |
| model | string | Model identifier |
| task_description | text | What the agent is working on |
| inception_ts | datetime | Registration time |
| last_active_ts | datetime | Last activity |
| attachments_policy | enum | inline/attach/deny |
| contact_policy | enum | open/auto/contacts_only/block_all |

### Messages

Message objects with threading support.

| Field | Type | Description |
|-------|------|-------------|
| id | PK | Primary key |
| project_id | FK | Parent project |
| sender_id | FK | Sending agent |
| thread_id | string | Optional thread grouping |
| subject | string | Message subject |
| body_md | text | GFM Markdown body |
| importance | enum | low/normal/high/urgent |
| ack_required | bool | Requires acknowledgement |
| created_ts | datetime | Send timestamp |
| attachments | JSON | Attached files |

### Message Recipients

Delivery tracking per recipient.

| Field | Type | Description |
|-------|------|-------------|
| message_id | FK | Parent message |
| agent_id | FK | Recipient agent |
| kind | enum | to/cc/bcc |
| read_ts | datetime | When read |
| ack_ts | datetime | When acknowledged |

### File Reservations

File leases for conflict prevention.

| Field | Type | Description |
|-------|------|-------------|
| id | PK | Primary key |
| project_id | FK | Parent project |
| agent_id | FK | Reserving agent |
| path_pattern | string | File path or glob |
| exclusive | bool | Hard lock vs advisory |
| reason | text | Why reserved |
| created_ts | datetime | Reservation start |
| expires_ts | datetime | Auto-release time |
| released_ts | datetime | Manual release time |

### Agent Links

Cross-project contact management.

| Field | Type | Description |
|-------|------|-------------|
| id | PK | Primary key |
| a_project_id | FK | Requesting project |
| a_agent_id | FK | Requesting agent |
| b_project_id | FK | Target project |
| b_agent_id | FK | Target agent |
| status | enum | pending/approved/blocked |
| created_ts | datetime | Request time |
| expires_ts | datetime | Approval expiry |

## Core Operations

### Identity & Registration

1. **ensure_project(human_key)** - Create/ensure project from path
2. **register_agent(...)** - Register agent identity
3. **whois(project_key, agent_name)** - Look up agent details

### Messaging

1. **send_message(...)** - Send message with recipients, threading, attachments
2. **reply_message(...)** - Reply within a thread
3. **fetch_inbox(...)** - Retrieve unread/recent messages
4. **mark_message_read(...)** - Mark as read
5. **acknowledge_message(...)** - Acknowledge receipt
6. **search_messages(...)** - Full-text search via FTS5

### File Reservations

1. **file_reservation_paths(...)** - Declare intent to edit files/globs
2. **release_file_reservations(...)** - Release leases early
3. **force_release_file_reservation(...)** - Admin override
4. **renew_file_reservations(...)** - Extend TTL

### Contacts

1. **request_contact(...)** - Request cross-project communication
2. **respond_contact(...)** - Approve/block requests
3. **set_contact_policy(...)** - Configure contact rules

## Message Format

Messages are stored as GFM Markdown with YAML frontmatter:

```yaml
---
id: "msg_20250101_abc123"
from: "GreenCastle"
to: ["RedCat", "BlueLake"]
cc: ["YellowForest"]
thread_id: "TKT-123"
subject: "Backend API refactoring underway"
importance: "normal"
ack_required: true
created_ts: "2025-01-01T14:30:00Z"
---

## Context

Working on the auth microservice. Need to update the database schema.

### Changes Made
- Added `user_roles` table
- Updated migration scripts

![Architecture Diagram](attachments/arch_diagram.webp)
```

### Image Handling

- Auto-converts to WebP (configurable)
- Inlines small images (< 64KB default)
- Stores large images as attachments
- Supports file paths and base64 data URIs

## Filesystem Organization

```
~/.mcp_agent_mail_git_mailbox_repo/
├── projects/<project-slug>/
│   ├── .git/                           # Git repository
│   ├── agents/
│   │   └── <AgentName>/
│   │       ├── profile.json            # Agent metadata
│   │       ├── inbox/YYYY/MM/          # Received messages
│   │       └── outbox/YYYY/MM/         # Sent messages
│   ├── messages/YYYY/MM/               # Canonical message copies
│   ├── file_reservations/              # Reservation records
│   └── attachments/                    # Inlined/converted images
```

## Agent Identity System

### Name Generation

- **62 adjectives:** Red, Green, Blue, Stormy, Swift, etc.
- **69 nouns:** Lake, Stone, Forest, Mountain, Fox, Bridge, etc.
- **Total combinations:** 4,278 unique names
- **Format:** CamelCase (GreenLake, BlueDog, StormyMountain)

### Enforcement Modes

- **strict** - Reject invalid provided names
- **coerce** - Ignore invalid, auto-generate valid one (default)
- **always_auto** - Always auto-generate

## File Reservation System

### Lease Workflow

1. Agent calls `file_reservation_paths(["src/main.py", "tests/*.py"])`
2. System creates SQLite row + Git JSON file
3. Other agents check for conflicts before editing
4. Pre-commit hook can enforce: reject commits to reserved files
5. Agent releases when done or lease expires

### Enforcement Options

- **Advisory** - `exclusive=false` (informational only)
- **Hard block** - `exclusive=true` + pre-commit hook
- **TTL cleanup** - Auto-release after inactivity
- **ACK escalation** - Convert unacked messages to reservations

## Contact Policies

Per-agent configuration for cross-project messaging:

| Policy | Behavior |
|--------|----------|
| open | Accept all unsolicited messages |
| auto | Smart filtering (context-dependent) |
| contacts_only | Only approved contacts |
| block_all | No new unsolicited messages |

## Workflow Example

```
1. Agent A registers:
   ensure_project("/path/to/backend")
   register_agent("backend", "GreenCastle", ...)

2. Agent B registers:
   ensure_project("/path/to/frontend")
   register_agent("frontend", "BlueLake", ...)

3. Agent A reserves files:
   file_reservation_paths("backend", "GreenCastle",
     ["src/auth.py"], exclusive=true)

4. Agent A communicates:
   send_message("backend", "GreenCastle",
     to=["BlueLake"], subject="Auth refactoring...")

5. Agent B checks inbox:
   fetch_inbox("frontend", "BlueLake")

6. Cross-project contact flow:
   request_contact("frontend", "BlueLake", "backend", "GreenCastle")
   respond_contact(..., status="approved")

7. Release on completion:
   release_file_reservations("backend", "GreenCastle")
```

## Key Architectural Strengths

1. **Human-auditable** - All messages/leases are Git-tracked
2. **Async-native** - Agents check messages on-demand
3. **Minimal coordination** - Advisory leases let agents work independently
4. **Multi-project** - Unified inbox/search across linked repos
5. **Observable** - Structured logging, metrics, OpenTelemetry
6. **Resilient** - SQLite WAL mode handles concurrent access
