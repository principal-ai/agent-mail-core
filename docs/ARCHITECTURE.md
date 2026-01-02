# Agent Mail Core - Architecture

This document describes the dependency injection architecture and modular design patterns for the agent-mail-core library.

## Design Philosophy

The library follows an **interface-based adapter pattern** inspired by [alexandria-core-library](https://github.com/Principal-AI/alexandria-core-library). This approach:

- Requires no external DI framework
- Enables multi-environment support (Node.js, browser, test)
- Uses constructor injection for loose coupling
- Keeps pure domain logic separate from infrastructure

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Entry Points                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  index.ts   │  │   node.ts   │  │      browser.ts         │ │
│  │ (universal) │  │ (Node.js)   │  │   (Browser/WASM)        │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Adapter Layer                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  test-adapters  │  │  node-adapters  │  │ browser-adapters│ │
│  │  (In-Memory)    │  │  (fs, sqlite)   │  │ (WASM, IDB)     │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Core Abstractions                              │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐ │
│  │DatabaseAdapter│ │StorageAdapter│ │ LockAdapter│ │GlobAdapter│ │
│  └──────────────┘ └──────────────┘ └────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Pure Core Domain                              │
│  ┌─────────┐  ┌────────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │ Models  │  │ Operations │  │  Types  │  │   Validation    │ │
│  └─────────┘  └────────────┘  └─────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Abstractions

### DatabaseAdapter

Provides database operations abstracted from the underlying engine.

```typescript
export interface DatabaseAdapter {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  isReady(): boolean;

  // Query operations
  run(sql: string, params?: unknown[]): Promise<RunResult>;
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;

  // Transaction support
  transaction<T>(fn: () => Promise<T>): Promise<T>;

  // Schema management
  exec(sql: string): Promise<void>;
}

interface RunResult {
  lastInsertRowid: number | bigint;
  changes: number;
}
```

**Implementations:**

| Adapter | Environment | Technology | Status |
|---------|-------------|------------|--------|
| `SqlJsDatabaseAdapter` | Test/Browser | sql.js (WASM) | ✅ Implemented |
| `InMemoryDatabaseAdapter` | Test | Map-based mock | ✅ Implemented (limited SQL) |
| `BetterSqlite3Adapter` | Node.js | better-sqlite3 | 🔲 Planned |

> **Note:** `SqlJsDatabaseAdapter` is the recommended adapter for testing as it provides full SQL support including complex queries with OR conditions.

---

### StorageAdapter

Provides file system and Git operations.

```typescript
export interface StorageAdapter {
  // File operations
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;

  // Directory operations
  createDir(path: string): Promise<void>;
  readDir(path: string): Promise<string[]>;
  isDirectory(path: string): Promise<boolean>;

  // Path utilities
  join(...paths: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;

  // Git operations (optional)
  gitInit?(path: string): Promise<void>;
  gitCommit?(path: string, message: string): Promise<string>;
  gitLog?(path: string, limit?: number): Promise<Commit[]>;
}
```

**Implementations:**

| Adapter | Environment | Technology | Status |
|---------|-------------|------------|--------|
| `IdbStorageAdapter` | Browser | IndexedDB (via idb) | ✅ Implemented |
| `InMemoryStorageAdapter` | Test | Map-based mock | ✅ Implemented |
| `NodeStorageAdapter` | Node.js | fs/promises + simple-git | 🔲 Planned |

---

### LockAdapter

Provides cross-process locking for concurrent access control.

```typescript
export interface LockAdapter {
  acquire(
    lockPath: string,
    options?: LockOptions
  ): Promise<LockHandle>;

  release(handle: LockHandle): Promise<void>;

  isLocked(lockPath: string): Promise<boolean>;
}

interface LockOptions {
  timeout?: number;      // Milliseconds to wait
  retries?: number;      // Number of retry attempts
  stale?: number;        // Consider lock stale after ms
}

interface LockHandle {
  path: string;
  acquired: Date;
  release(): Promise<void>;
}
```

**Implementations:**

| Adapter | Environment | Technology | Status |
|---------|-------------|------------|--------|
| `NoOpLockAdapter` | Test | Always succeeds | ✅ Implemented |
| `ProperLockfileAdapter` | Node.js | proper-lockfile | 🔲 Planned |
| `NavigatorLocksAdapter` | Browser | Web Locks API | 🔲 Planned |

---

### GlobAdapter

Provides file pattern matching.

```typescript
export interface GlobAdapter {
  findFiles(
    patterns: string[],
    options?: GlobOptions
  ): Promise<string[]>;

  matches(pattern: string, path: string): boolean;
}

interface GlobOptions {
  cwd?: string;
  ignore?: string[];
  absolute?: boolean;
}
```

**Implementations:**

| Adapter | Environment | Technology | Status |
|---------|-------------|------------|--------|
| `MicromatchGlobAdapter` | Browser | micromatch | ✅ Implemented |
| `SimpleGlobAdapter` | Test | Basic pattern matching | ✅ Implemented |
| `FastGlobAdapter` | Node.js | fast-glob | 🔲 Planned |

---

## Directory Structure

```
agent-mail-core/
├── src/
│   ├── core/                        # Pure domain logic
│   │   ├── abstractions/            # Interface contracts
│   │   │   ├── database.ts          # DatabaseAdapter
│   │   │   ├── storage.ts           # StorageAdapter
│   │   │   ├── lock.ts              # LockAdapter
│   │   │   └── glob.ts              # GlobAdapter
│   │   │
│   │   ├── models/                  # Domain entities
│   │   │   ├── project.ts           # Project model
│   │   │   ├── agent.ts             # Agent model
│   │   │   ├── message.ts           # Message model
│   │   │   ├── message-recipient.ts # Message delivery tracking
│   │   │   ├── file-reservation.ts  # FileReservation model
│   │   │   └── agent-link.ts        # AgentLink model (contacts)
│   │   │
│   │   ├── operations/              # Business logic
│   │   │   ├── projects.ts          # Project operations
│   │   │   ├── agents.ts            # Agent operations
│   │   │   ├── messages.ts          # Message operations
│   │   │   ├── reservations.ts      # File reservation ops
│   │   │   └── links.ts             # Contact/link management
│   │   │
│   │   ├── types/                   # Shared type definitions
│   │   │   ├── enums.ts             # ImportanceLevel, ContactPolicy, etc.
│   │   │   └── config.ts            # AgentMailConfig
│   │   │
│   │   ├── validation/              # Input validation
│   │   │   ├── agent-name.ts        # Name generation/validation
│   │   │   └── slugify.ts           # Slug utilities
│   │   │
│   │   ├── schema.ts                # SQL schema definitions
│   │   └── AgentMailCore.ts         # Main entry class
│   │
│   ├── browser-adapters/            # Browser implementations
│   │   ├── IdbStorageAdapter.ts     # IndexedDB storage ✅
│   │   └── MicromatchGlobAdapter.ts # Glob matching ✅
│   │
│   ├── test-adapters/               # Test implementations
│   │   ├── SqlJsDatabaseAdapter.ts  # sql.js WASM database ✅
│   │   ├── InMemoryDatabaseAdapter.ts # Map-based mock ✅
│   │   ├── InMemoryStorageAdapter.ts  # Map-based storage ✅
│   │   ├── NoOpLockAdapter.ts       # Always succeeds ✅
│   │   └── SimpleGlobAdapter.ts     # Basic patterns ✅
│   │
│   └── index.ts                     # Universal exports
│
├── docs/
│   ├── LIBRARY_SPECIFICATION.md     # Full library spec
│   └── ARCHITECTURE.md              # This file
│
└── tests/
    ├── core/                        # Core operation tests
    ├── browser-adapters/            # Browser adapter tests
    └── integration/                 # End-to-end tests
```

> **Note:** Node.js adapters (`node-adapters/`) are planned but not yet implemented. The current implementation focuses on browser-first with test adapters.

---

## Constructor Injection Pattern

Services receive adapters through their constructor:

```typescript
// Example: AgentMailCore class
export class AgentMailCore {
  private db: DatabaseAdapter;
  private storage: StorageAdapter;
  private lock: LockAdapter;
  private glob: GlobAdapter;

  constructor(options: AgentMailCoreOptions) {
    this.db = options.database;
    this.storage = options.storage;
    this.lock = options.lock;
    this.glob = options.glob;
  }

  async initialize(): Promise<void> {
    await this.db.initialize();
    await this.ensureSchema();
  }

  // Operations use injected adapters
  async sendMessage(options: SendMessageOptions): Promise<Message> {
    return this.lock.acquire('messages', async () => {
      // Use this.db, this.storage, etc.
    });
  }
}
```

---

## Usage Examples

### Testing (Recommended)

Use the convenience factory for quick test setup:

```typescript
import { createTestCore } from 'agent-mail-core';

const core = createTestCore();
await core.initialize();

// Create a project and agent
const project = await core.ensureProject('my-project');
const agent = await core.registerAgent(project.id);

// Send a message
await core.sendMessage({
  senderId: agent.id,
  recipients: [{ agentId: otherAgent.id, kind: 'to' }],
  subject: 'Hello',
  body: 'World'
});
```

Or construct manually with full control:

```typescript
import {
  AgentMailCore,
  SqlJsDatabaseAdapter,
  InMemoryStorageAdapter,
  NoOpLockAdapter,
  SimpleGlobAdapter
} from 'agent-mail-core';

const core = new AgentMailCore({
  database: new SqlJsDatabaseAdapter(),
  storage: new InMemoryStorageAdapter(),
  lock: new NoOpLockAdapter(),
  glob: new SimpleGlobAdapter()
});

await core.initialize();
```

### Browser

```typescript
import {
  AgentMailCore,
  SqlJsDatabaseAdapter,
  IdbStorageAdapter,
  NoOpLockAdapter,
  MicromatchGlobAdapter
} from 'agent-mail-core';

const storage = new IdbStorageAdapter('agent-mail');
await storage.initialize();

const core = new AgentMailCore({
  database: new SqlJsDatabaseAdapter(),
  storage: storage,
  lock: new NoOpLockAdapter(),
  glob: new MicromatchGlobAdapter(storage)
});

await core.initialize();
```

### Node.js (Planned)

```typescript
// Future implementation - not yet available
import {
  AgentMailCore,
  BetterSqlite3Adapter,
  NodeStorageAdapter,
  ProperLockfileAdapter,
  FastGlobAdapter
} from 'agent-mail-core/node';

const core = new AgentMailCore({
  database: new BetterSqlite3Adapter({ path: './mail.db' }),
  storage: new NodeStorageAdapter({ root: '~/.agent-mail' }),
  lock: new ProperLockfileAdapter(),
  glob: new FastGlobAdapter()
});

await core.initialize();
```

---

## Benefits

| Benefit | How It's Achieved |
|---------|-------------------|
| **No framework lock-in** | Pure TypeScript interfaces, no DI container |
| **Multi-environment** | Separate adapters for Node.js, browser, test |
| **Easy testing** | In-memory adapters require no real I/O |
| **Loose coupling** | Services depend on abstractions, not implementations |
| **Tree-shakeable** | Separate entry points allow dead code elimination |
| **Clear contracts** | Interfaces document exactly what adapters must provide |

---

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Core Abstractions | ✅ Complete | All interfaces defined |
| Domain Models | ✅ Complete | Project, Agent, Message, FileReservation, AgentLink |
| Operations | ✅ Complete | Projects, Agents, Messages, Reservations, Links |
| Contact Policies | ✅ Complete | open, auto, contacts_only, block_all |
| Test Adapters | ✅ Complete | SqlJsDatabaseAdapter, InMemoryStorageAdapter, etc. |
| Browser Adapters | ✅ Complete | IdbStorageAdapter, MicromatchGlobAdapter |
| Node.js Adapters | 🔲 Planned | BetterSqlite3, NodeStorage, etc. |

---

## References

- [LIBRARY_SPECIFICATION.md](./LIBRARY_SPECIFICATION.md) - Full library specification
- [alexandria-core-library](https://github.com/Principal-AI/alexandria-core-library) - Pattern inspiration
