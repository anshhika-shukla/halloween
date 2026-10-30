# REPOREVENANT

> **Every abandoned codebase has a story. Let's bring its ghost back to life.**

REPOREVENANT takes a GitHub repository (or a local clone), studies its code, commit history, docs, and issues with an open-weight model running locally, and becomes a repository-specific AI maintainer: a ghost.

- **Cited Evidence:** Every factual statement cites verifiable files, commits, or issues.
- **Offline & Private:** Network tripwire guarantees 0 bytes of code leave the machine.
- **Resurrection:** Identifies real bugs and failing tests, tests patches in a sandbox, and requires explicit human approval.

## Requirements
- Node.js 22 LTS or higher
- Git
- Ollama (optional for production; automated tests use mock provider)
- Docker (optional for isolated sandboxing)

## Progress & Phases
- **Phase 0 (Scaffold & Foundations):** Monorepo structure, typed configuration, health monitoring, Ollama and deterministic Mock providers, deterministic haunted-todo fixture.
- **Phase 1 (Ingestion):** Source safety validation, repository cloning, tree walking, git log parsing, GitHub issues extraction, and SSE progress tracking.
- **Phase 2 (Index & Retrieval):** 60-line code window chunking with 10-line overlap, markdown heading splitting, commit/issue chunking, Float32Array vector embedding store (`chunks.json`, `vectors.f32`), HEAD sha cache validation, and hybrid retrieval (`0.7 * cosine + 0.3 * keywordScore`) with identifier boosting and sequential evidence ranking (`E1..Ek`).

## Verification
Run all tests, typecheck, and linting across the monorepo:
```bash
npm run verify
```

