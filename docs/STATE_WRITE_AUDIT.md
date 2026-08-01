# Aetheria Phase 2 State Write Audit Report

## 写入旁路审计与 Proposal 替代计划

下表记录了重构前在引擎及 API 业务逻辑中直接修改 `globalWorld` 内存状态及旁路持久化的位置，以及收口为 Recorder `StateChangeProposal` 提交的具体方案：

| 文件 | 行为 | 改造前的直接写入模式 | 替换的 StateChangeProposal / 机制 |
|---|---|---|---|
| `dmEngine.ts` | 设置世界观预设 | `globalWorld.setPresetWorld(...)` | `UPDATE_WORLD` / Bootstrapping context |
| `dmEngine.ts` | 角色基础信息/属性更新 | `pc.attributes.hp = ...`, `pc.name = ...` | `UPDATE_CHARACTER` / `UPDATE_CHARACTER_ATTRIBUTES` |
| `dmEngine.ts` | 动态创建新地点 | `globalWorld.locations.set(...)` | `CREATE_LOCATION` |
| `dmEngine.ts` | 更新地点双向连接 | `ex.connected_to.push(...)` | `CONNECT_LOCATIONS` |
| `dmEngine.ts` | 角色已知地点更新 | `pc.knowledge.known_locations.push(...)` | `UPDATE_CHARACTER_KNOWLEDGE` |
| `dmEngine.ts` | 金币/资源增减 | `pc.resources.gold = ...` | `CHANGE_RESOURCE` |
| `dmEngine.ts` | NPC 关系/好感变化 | `rel.trust = ...`, `npc.relationships.push(...)` | `CHANGE_RELATIONSHIP` |
| `dmEngine.ts` | 收集真相证据 | `TruthsEngine.addEvidenceToTruth(...)` | `COLLECT_EVIDENCE` |
| `dmEngine.ts` | 推进世界纪元 | `SchedulerEngine.processEpochTick()` | `ADVANCE_WORLD_EPOCH` |
| `dmEngine.ts` | 记录跑团事件日志 | `globalWorld.events.unshift(...)` | `CREATE_EVENT` |
| `dmEngine.ts` | 数据库全量存盘兜底 | `WorldBootstrap.saveAllToDatabase(...)` | 移除，改由 `Recorder.commit()` 原子的事务性单条写 |
| `truthsEngine.ts` | 收集证据 | `truth.evidence_collected.push(...)` | `COLLECT_EVIDENCE` |
| `truthsEngine.ts` | 揭露真相 | `truth.revealed = true`, `truth.revealed_to_ids.push(...)` | `REVEAL_TRUTH` |
| `truthsEngine.ts` | 真相揭露连锁反应 | `rel.trust += ...`, `alley.security.crime_rate -= ...` | `CHANGE_RELATIONSHIP`, `UPDATE_LOCATION` |
| `truthsEngine.ts` | 创建真相揭露事件 | `globalWorld.events.unshift(...)` | `CREATE_EVENT` |
| `scheduler.ts` | 推进纪元 | `globalWorld.snapshot.epoch += 1` | `ADVANCE_WORLD_EPOCH` |
| `scheduler.ts` | 修改实体冻结/模拟状态 | `char.frozen = false/true`, `char.last_simulated_epoch = ...` | `SET_ENTITY_SIMULATION_STATE` |
| `scheduler.ts` | Catch-up 追赶记忆 | `character.memory.short_term.push(...)` | `UPDATE_CHARACTER_MEMORY` |
| `scheduler.ts` | Catch-up 随机金币浮动 | `character.resources.gold = ...` | `CHANGE_RESOURCE` |
| `causality.ts` | 推进 Seed 进度与状态 | `seed.progress = ...`, `seed.status = ...` | `UPDATE_SEED` |
| `causality.ts` | Seed 结算事件生成 | `globalWorld.events.unshift(...)` | `CREATE_EVENT` |
| `causality.ts` | 参与者关系变化 | `rel.trust = ...`, `charA.relationships.push(...)` | `CHANGE_RELATIONSHIP` |
| `server.ts` | 角色 TRAVEL 移动 | `char.location_id = ...`, `char.current_action = ...` | `MOVE_CHARACTER`, `SET_CHARACTER_ACTION` |
| `server.ts` | 角色 REST 休息恢复 | `char.attributes.hp = ...`, `char.current_action = ...` | `UPDATE_CHARACTER_ATTRIBUTES`, `SET_CHARACTER_ACTION` |
| `server.ts` | 触发事件/醒来队列 | `globalWorld.events.unshift(...)` | `CREATE_EVENT` |
| `server.ts` | 重置/Tick/真相 API | 直接调用各种 Engine 间接写 | 全部封装为 Proposal 并提交至 `Recorder` |

## 白名单保留路径

仅以下模块允许进行直接初始构建或重置：
1. `src/engine/world/worldBootstrap.ts`: 负责系统初次启动/从数据库反序列化加载。
2. `src/engine/worldState.ts`: 声明初始 WorldDataStore 字段结构与静态 init 模版。
3. `tests/*`: 测试夹具与 Initial state 模拟。
4. `src/engine/recorder/recorder.ts`: **唯一**权威写入口。
