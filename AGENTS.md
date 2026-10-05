# Host Project AI Agent Instructions & Context Factory Bridge

This repository uses **Context Factory** (located at `./context-factory`) for development standards, rules, workflows, subagents, and skills.

## Mandatory Directives & Agent Execution Contract

1. **Shared Contract:** Read the shared orchestration contract in `./context-factory/orchestrator/SHARED.md` before executing tasks.
2. **Context Resolution:** Deterministically resolve required context before non-trivial changes:
   `node ./context-factory/scripts/context.mjs resolve "<task description>"`
3. **Universal Standards:** Follow rules in `./context-factory/rules/`, workflows in `./context-factory/workflows/`, and skills in `./context-factory/skills/`.
4. **Project Specifics:** Combine universal factory rules with project-specific rules in `./rules/` or `./.agents/rules/`.

## Generated Documentation Scoping Contract

- **Task Plans & Breakdowns:** All implementation plans, phase breakdowns, and task files MUST be written to `./docs/tasks/YYYY/MM/YYYY-MM-DD/<feature>/` in **this host repository**, NEVER inside `./context-factory`.
- **Architecture Decisions (ADRs):** All architectural decision records MUST be saved to `./docs/decisions/` in **this host repository**.
- **Templates:** Always load templates from `./context-factory/docs/templates/Task.md`, `Phase.md`, and `Decision.md`.

## Session Slash Commands & Quick Actions

| Command | Action | Execution |
| :--- | :--- | :--- |
| `/plan`, `[PLAN]` | Scaffold phased plan in `./docs/tasks/` | `node ./context-factory/scripts/context.mjs task:new "<title>"` |
| `/resolve` | Resolve matching context rules & skills | `node ./context-factory/scripts/context.mjs resolve "<prompt>"` |
| `/doctor` | Verify context and lock health | `node ./context-factory/scripts/context.mjs doctor` |
