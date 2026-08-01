# 🌌 Aetheria — AI Native 永恒因果沙盒 RPG (AI Persistent World RPG)

> **全进程 AI 驱动的无界因果沙盒** | **无预设剧本的开放世界推演引擎** | **Phase 2 权威原子 Recorder & 状态原子一致性引擎**

![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![TailwindCSS v4](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Gemini API](https://img.shields.io/badge/Gemini_API-%40google%2Fgenai-4285F4?logo=google&logoColor=white)
![SQLite WAL](https://img.shields.io/badge/SQLite-WASM%2FTransaction-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📖 项目简介 (Overview)

**Aetheria** 是一款基于 **AI Native 架构** 打造的开放世界沙盒角色扮演游戏（RPG）。在 Phase 2 收口阶段，系统成功升级为**具备三阶段原子提交 (Prepare-Persist-Publish) 的权威 Recorder 单一写入口**。

数据库事务 (SQLite Transaction)、状态变更日志 (State Change Log) 与运行时内存缓存 (`globalWorld`) 实现了真正的**强原子一致性**：任何一组 `StateChangeProposal` 提案，要么全部持久化并同步至内存，要么在出现任意校验或物理错误时整体回滚、保持原状。同时通过 Proxy 层施加 Write Guard 强行封锁对 `globalWorld` 的直接修改。

---

## ✨ 核心架构特色 (Key Architectural Highlights)

### 1. 🛡️ 权威 Recorder 单一写入口 (Authoritative Single Write Entry Point)
* **Write Guard 拦截**：对 `globalWorld` 的属性、Map、Array 进行全局 Proxy 监控，非 Recorder 事务上下文的直接修改将立即抛出异常并阻止执行。
* **三阶段提交 (3-Stage Commit Pipeline)**：
  1. **Prepare（工作集隔离与不变式校验）**：在隔离的 `RecorderWorkingSet` 中执行提案，经由 `BatchInvariantValidator` 校验死者行为、负资产、缺失关联等守卫条件；
  2. **Persist（数据库事务与日志持久化）**：在单个 SQLite 事务中完成所有状态更新与 `state_change_log` 写入；
  3. **Publish（内存缓存同步与崩溃恢复）**：将更新同步至 `globalWorld` 内存缓存，若 Publish 阶段异常则自动发起数据库重载恢复。

### 2. 🎲 全进程 AI DM 智能推演 (Full-Process AI DM & Proposals)
* AI DM 所有的推演决策与状态改变必须输出严格的 `StateChangeProposal` 提案，通过 `Recorder.commit()` 进行权威一致性提交。

### 3. 🕸️ 永恒因果与隐秘真相 (Causality & Hidden Truths)
* 完整记录世界纪元 (Epoch) 演化历史与状态变更日志 (`state_change_log`)，支持跨纪元追溯与因果连贯性校验。

---

## 🛠️ 技术栈 (Tech Stack)

* **前端 (Frontend)**: React 19, TypeScript, Tailwind CSS v4, Motion (Framer Motion), Lucide React
* **后端 (Backend)**: Express, Node.js (CommonJS Bundled via Esbuild)
* **数据库 (Database)**: WASM SQLite / sql.js 事务持久化 (`aetheria.db`)
* **AI 引擎 (AI Engine)**: Google Gemini API (`@google/genai` SDK，采用服务端安全代理模式)
* **构建与测试**: Vite, Esbuild, Vitest, TypeScript `tsc --noEmit`

---

## 🚀 验证与测试 (Verification & Tests)

```bash
# 运行完整校验流程 (TypeScript 类型检查 + 零直接写入静态审计 + 完整单元测试)
npm run verify

# 单独运行状态直接写入扫描审计
npm run audit:direct-writes

# 运行 Vitest 自动化测试套件
npx vitest run
```

---

## 📂 项目结构概览 (Project Structure)

```
.
├── server.ts                   # Express 后端服务 & API 路由 (Gemini API 代理)
├── src/
│   ├── App.tsx                 # 应用主入口组件与布局控制
│   ├── components/             # UI 功能组件
│   └── engine/                 # 游戏核心逻辑引擎
│       ├── recorder/           # 权威 Recorder 引擎 (Prepare/Persist/Publish)
│       ├── persistence/        # SQLite WASM 数据库与 Schema
│       ├── world/              # WorldRepository 与 WorldBootstrap
│       └── worldState.ts       # 全局世界状态 (Write Guard 受保护)
├── scripts/
│   └── audit-direct-writes.ts  # AST/正则 状态直接写入审计脚本
├── tests/                      # Vitest 单元与集成测试套件
├── ARCHITECTURE.md             # Phase 2 架构与原子一致性说明文档
└── docs/
    └── PHASE2_CLOSURE_REPORT.md# Phase 2 最终收口工程报告
```

---

## 📄 开源协议 (License)

本项目遵循 [MIT License](LICENSE) 协议。
