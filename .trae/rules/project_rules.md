# Trae Project Rules - Context Factory Bridge

This repository connects to **Context Factory** at `./context-factory` for engineering standards, workflows, and subagent orchestration contracts.

## Mandatory Guidelines for Trae AI
- Consult `./context-factory/orchestrator/SHARED.md` for the authoritative orchestration contract.
- Resolve context before non-trivial tasks: `node ./context-factory/scripts/context.mjs resolve "<prompt>"`.
- Save task plans to `./docs/tasks/` and ADRs to `./docs/decisions/`.
- Follow universal engineering rules from `./context-factory/rules/`.
