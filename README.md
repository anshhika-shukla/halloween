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
