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

| Adapter | Environment | Technology |
|---------|-------------|------------|
| `BetterSqlite3Adapter` | Node.js | better-sqlite3 |
| `SqlJsAdapter` | Browser | sql.js (WASM) |
| `InMemoryDatabaseAdapter` | Test | Map-based mock |

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

| Adapter | Environment | Technology |
|---------|-------------|------------|
| `NodeStorageAdapter` | Node.js | fs/promises + simple-git |
| `IndexedDBStorageAdapter` | Browser | IndexedDB |
| `InMemoryStorageAdapter` | Test | Map-based mock |

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

| Adapter | Environment | Technology |
|---------|-------------|------------|
| `ProperLockfileAdapter` | Node.js | proper-lockfile |
| `NavigatorLocksAdapter` | Browser | Web Locks API |
| `NoOpLockAdapter` | Test | Always succeeds |

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

| Adapter | Environment | Technology |
|---------|-------------|------------|
| `FastGlobAdapter` | Node.js | fast-glob |
| `MicromatchAdapter` | Browser | micromatch |
| `SimpleGlobAdapter` | Test | Basic pattern matching |

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
│   │   │   ├── glob.ts              # GlobAdapter
│   │   │   └── index.ts             # Re-exports
│   │   │
│   │   ├── models/                  # Domain entities
│   │   │   ├── project.ts           # Project model
│   │   │   ├── agent.ts             # Agent model
│   │   │   ├── message.ts           # Message model
│   │   │   ├── file-reservation.ts  # FileReservation model
│   │   │   ├── agent-link.ts        # AgentLink model
│   │   │   └── index.ts
│   │   │
│   │   ├── operations/              # Business logic
│   │   │   ├── projects.ts          # Project operations
│   │   │   ├── agents.ts            # Agent operations
│   │   │   ├── messages.ts          # Message operations
│   │   │   ├── reservations.ts      # File reservation ops
│   │   │   ├── contacts.ts          # Contact management
│   │   │   └── index.ts
│   │   │
│   │   ├── types/                   # Shared type definitions
│   │   │   ├── common.ts
│   │   │   ├── config.ts
│   │   │   └── index.ts
│   │   │
│   │   └── validation/              # Input validation
│   │       ├── agent-name.ts
│   │       ├── patterns.ts
│   │       └── index.ts
│   │
│   ├── node-adapters/               # Node.js implementations
│   │   ├── BetterSqlite3Adapter.ts
│   │   ├── NodeStorageAdapter.ts
│   │   ├── ProperLockfileAdapter.ts
│   │   ├── FastGlobAdapter.ts
│   │   └── index.ts
│   │
│   ├── browser-adapters/            # Browser implementations
│   │   ├── SqlJsAdapter.ts
│   │   ├── IndexedDBStorageAdapter.ts
│   │   ├── NavigatorLocksAdapter.ts
│   │   ├── MicromatchAdapter.ts
│   │   └── index.ts
│   │
│   ├── test-adapters/               # Test implementations
│   │   ├── InMemoryDatabaseAdapter.ts
│   │   ├── InMemoryStorageAdapter.ts
│   │   ├── NoOpLockAdapter.ts
│   │   ├── SimpleGlobAdapter.ts
│   │   └── index.ts
│   │
│   ├── index.ts                     # Universal exports
│   ├── node.ts                      # Node.js entry point
│   └── browser.ts                   # Browser entry point
│
├── docs/
│   ├── LIBRARY_SPECIFICATION.md     # Full library spec
│   └── ARCHITECTURE.md              # This file
│
└── tests/
    └── ...
```

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

### Node.js

```typescript
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

### Browser

```typescript
import {
  AgentMailCore,
  SqlJsAdapter,
  IndexedDBStorageAdapter,
  NavigatorLocksAdapter,
  MicromatchAdapter
} from 'agent-mail-core/browser';

const core = new AgentMailCore({
  database: new SqlJsAdapter(),
  storage: new IndexedDBStorageAdapter({ dbName: 'agent-mail' }),
  lock: new NavigatorLocksAdapter(),
  glob: new MicromatchAdapter()
});

await core.initialize();
```

### Testing

```typescript
import {
  AgentMailCore,
  InMemoryDatabaseAdapter,
  InMemoryStorageAdapter,
  NoOpLockAdapter,
  SimpleGlobAdapter
} from 'agent-mail-core';

const core = new AgentMailCore({
  database: new InMemoryDatabaseAdapter(),
  storage: new InMemoryStorageAdapter(),
  lock: new NoOpLockAdapter(),
  glob: new SimpleGlobAdapter()
});

await core.initialize();
// Run tests with in-memory state
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

## References

- [LIBRARY_SPECIFICATION.md](./LIBRARY_SPECIFICATION.md) - Full library specification
- [alexandria-core-library](https://github.com/Principal-AI/alexandria-core-library) - Pattern inspiration
