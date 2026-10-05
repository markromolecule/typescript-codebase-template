# Claude Code Host Project Instructions

This project uses **Context Factory** at `./context-factory` for engineering workflows and standards.

## Execution Rules
- Review `./context-factory/orchestrator/SHARED.md` for orchestrator directives.
- Context resolution: `node ./context-factory/scripts/context.mjs resolve "<prompt>"`.
- Write task plans to `./docs/tasks/` and ADRs to `./docs/decisions/` in this repository.
- Verify work using `node ./context-factory/scripts/context.mjs doctor`.
