# 🏛️ Aetheria Engine Architecture & Phase 2 Specification

## 1. Overview & Core Directive

In Phase 2 of Aetheria, the `Recorder` was upgraded from a façade write wrapper into the **sole authoritative write entry point** across the entire engine architecture.

### Guaranteed Atomicity Axiom
For any batch of `StateChangeProposal` items submitted to the engine:
* **All-or-Nothing Guarantee**: Either SQLite persistence, `state_change_log` entries, and `globalWorld` in-memory cache update successfully **in unison**;
* **Rollback Guarantee**: Or SQLite transactions roll back completely, no `state_change_log` is written, and `globalWorld` remains **100% unchanged**.

---

## 2. Three-Stage Commit Pipeline Architecture

```
[StateChangeProposal[]]
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. PREPARE STAGE (Isolation & Validation)                   │
│  - Clone entity state into isolated RecorderWorkingSet       │
│  - Apply operations to WorkingSet in-memory                 │
│  - BatchInvariantValidator checks invariant constraints     │
│  - Generate StateChangeLogEntry array                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. PERSIST STAGE (Database Transaction)                     │
│  - Open SQLite DB Transaction (BEGIN TRANSACTION)           │
│  - Write dirty entities (Characters, Locations, Orgs, etc.) │
│  - Write Events & StateChangeLogEntries to DB               │
│  - Write updated WorldSnapshot                              │
│  - COMMIT TRANSACTION                                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PUBLISH STAGE (Cache Synchronization & Fallback)         │
│  - Enable Write Guard Context (setRecorderWriteContext(true))│
│  - Synchronize dirty entities from WorkingSet to globalWorld│
│  - Catch any unexpected Publish error:                      │
│    └─ Trigger WorldCacheLoader.reloadFromDatabase(worldId)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Write Guard & Direct Write Prevention

To prevent memory pollution and illegal bypasses of the `Recorder`:
1. **Proxy Protection (`createGuardedMap`, `createGuardedObject`, `createGuardedArray`)**:
   All operations (`set`, `delete`, `clear`, property mutation) on `globalWorld` check `isRecorderWriteContext()`.
2. **Runtime Locking (`setRuntimeWriteLocked(true)`)**:
   Attempting to directly modify `globalWorld.characters`, `locations`, `inventory`, or `resources` outside `Recorder.commit()` immediately throws `[Write Guard Violation] Direct mutation on globalWorld is forbidden!`.

---

## 4. Verification Suite

The system maintains strict quality enforcement through `npm run verify`, which runs:
1. `npm run lint` (`tsc --noEmit`): Ensures zero type errors;
2. `npm run audit:direct-writes` (`scripts/audit-direct-writes.ts`): Audits codebase to ensure zero unauthorized direct mutations on `globalWorld`;
3. `vitest run`: Runs all test suites verifying atomicity, rollback on crash, and invariant checks.
