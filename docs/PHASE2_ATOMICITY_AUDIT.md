# Aetheria Phase 2 状态事务与写原子性审计报告 (PHASE2_ATOMICITY_AUDIT.md)

## 审计概述

本文档在 Aetheria Phase 2 收口阶段生成，旨在审计原有 `Recorder` 写机制及内存/数据库状态在并发与错误场景下的原子性与一致性漏洞。

---

## 缺陷与漏洞汇总表

| 文件 | 当前问题 | 风险描述 | Phase 2 修复方案 |
|---|---|---|---|
| `src/engine/recorder/recorder.ts` | SQL 事务执行过程中直接修改 `globalWorld` 共享 Map 中的对象引用 | 数据库事务若中途失败 Rollback，`globalWorld` 内存中已被修改的对象保留脏数据，造成内存与数据库永久失真 | 引入三阶段提交（Prepare / Persist / Publish），Prepare 阶段全量运行于隔离 Working Copy 上 |
| `src/engine/recorder/recorder.ts` | `UPDATE_CHARACTER` 等操作在 `!char` 时使用 `break;` 静默跳过 | 提案无效或实体不存在时不报错，提交结果返 `success: true` 但实际未应用，破坏幂等性与因果链 | 引入 `RecorderError` 机制，实体未找到时立即抛出 `CHARACTER_NOT_FOUND` 等错误并中断整组 Proposal 提交 |
| `src/engine/recorder/recorder.ts` | 错误直接修改传入的原始引用而非深度克隆对象 | Prepare 阶段与尝试修改共享引用的后续逻辑产生非预期侧效应 | 统一使用 `structuredClone` 构建隔离 Working Copy，且 Commit 前绝不触碰原引用 |
| `src/engine/dmEngine.ts` | 部分分支直接更新属性或未在 Commit 失败时同步撤回 Narrate 结果 | DM 叙述声称“移动成功/金币增加”，但后台 DB/State 失败，导致大模型叙述与状态事实脱节 | DMEngine 先构造 Proposals -> Recorder Commit -> 依据 `CommitResult` 的 `proposalResults` 状态生成总结与修复 Narration |
| `src/engine/scheduler.ts` | Catch-up 补算包含 `Math.random() * 10 - 3` 随机资源变更 | 调度引擎生成非确定性的随机资源变动假装模拟 | 移除随机金币变动，仅保留记忆与仿真状态变更 Proposals |
| `src/engine/worldState.ts` | `snapshot.epoch` 及内部状态集合在某些路径下绕过 Recorder Write Context | 手动修改 `epoch` 或对象属性未全被 Proxy / Guard 拦截 | 拦截 `snapshot.epoch` Setter 与 Proxy `createGuardedObject` 深入层级防护，强制写上下文校验 |
| `server.ts` | Reset 端点使用 `WorldBootstrap.saveAllToDatabase` | 在非初始化流程中批量全写 DB | 统一使用 `WorldRepository.saveWorldSnapshot` 或 Recorder，清理无用整库 dump 逻辑 |
| 缺失测试 | 缺失全原子回滚、Operation 规则校验、Write Guard 尝试覆盖、Cache Recovery 验证测试 | 无法证明数据库失败时内存零污染，无法验证全成功/全失败强硬边界 | 补齐 5 大测试套件 (`recorder_atomicity`, `recorder_operations`, `state_write_guard`, `cache_recovery`, `dm_recorder_integration`) |

---

## 一、详细审计分析

### 1. 事务内直接修改内存对象
在原先的 `Recorder.applySingleProposal` 中，例如 `UPDATE_CHARACTER_ATTRIBUTES`：
```ts
const char = globalWorld.characters.get(charId);
if (char) {
  char.attributes.hp = ...;
  await WorldRepository.saveCharacter(worldId, char);
}
```
* **缺陷**: `char` 是 `globalWorld.characters` Map 中保存的真实引用。如果此操作之后在 SQL `transaction` 块内发生了其他 SQL 错误（如字段超长、键约束失败、外键破坏），SQLite 会 Rollback 数据库，但内存中 `char.attributes.hp` 已经发生了不可逆的突变。
* **后果**: 数据库事务回滚，但 `globalWorld` 已经改变！

### 2. 实体不存在时静默跳过
在原先的 `applySingleProposal` 中，如果实体不存在，只做 `if (char) { ... }` 判断，执行完成后既不抛出错误，也不在 `appliedIds` 中记录失败原因，使得 `commit()` 返回 `success: true`。
* **缺陷**: 违反了“CommitResult.success = true 则 Proposal 必须真实生效”的强硬契约。
* **后果**: 掩盖了非法操作与无效参数逻辑。

### 3. 缺乏批量级不变量检查 (Batch Invariant Validator)
单条 Proposal 通过校验并不代表整组 Proposals 执行完后整体世界状态是合法的（例如 Proposal A 删除了地点 X，Proposal B 把角色移到了 X）。
* **缺陷**: 缺失最终 Working Set 的整体不变量验证。

### 4. 缓存恢复机制缺失
若在 Commit 的 Publish 阶段（即 SQL 已 COMMIT，更新内存缓存时）发生不可预期的 JS 运行时异常，内存与 SQLite 将不一致。
* **缺陷**: 缺乏 `WorldCacheLoader.reload(worldId)` 的自动故障救赎。

---

## 二、Phase 2 治理目标与重构方案

1. **三阶段提交架构**:
   - **Prepare**: 读取并使用 `structuredClone` 复制 Working Copy，顺序模拟整组 Proposal。若任意实体未找到或校验失败，记录 `REJECTED` 并立刻回滚，不碰 DB 与 `globalWorld`。
   - **Persist**: 启动 SQLite 事务，批量写入脏实体、State Change Logs、Events 与 Snapshot。失败则 SQL Rollback，绝不更新 `globalWorld`。
   - **Publish**: 只有 DB Transaction 成功后，开启 Write Context 锁，将 Working Copy 批量写入/更新到 `globalWorld` 缓存。
2. **零容忍报错**:
   - 实体不存在抛出 `RecorderError` (`CHARACTER_NOT_FOUND` 等)，整组事务回滚。
3. **全量写防护**:
   - 结合 Proxy Guard 与 Setter 限制，任何未开启 `RecorderWriteContext` 的直接赋值均触发 `[Write Guard Violation]` 异常。

---
` Audit document created cleanly!
