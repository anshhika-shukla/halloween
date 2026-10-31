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
- **Phase 3 (Ghost Chat with Citations):** Grounded chat interface (`POST /api/repos/:id/chat`), live citation parsing (`[E#]`), server-side evidence verification, clean refusal path on insufficient context (`MIN_EVIDENCE_SCORE`), editable system prompts in `prompts/`, optional seance persona mode, evidence drawer lookup (`GET /api/repos/:id/chunks/:chunkId`), and automated evaluation scripts (`scripts/chat-eval.ts`, `scripts/calibrate-threshold.ts`).
- **Phase 4 (UI: Summon, Scan, Haunt):** Cinematic haunted developer interface with near-black background (`#0b0d10`), phosphor teal (`#5eead4`) and spectral violet (`#a78bfa`) accents. Features:
  - **Summon:** Landing page, animated floating SVG ghost, HTTPS URL validation with quick sample repo action, and top-bar status indicators for provider/offline/sandbox modes.
  - **Scan:** Real-time SSE stage progression (`clone`, `walk`, `history`, `issues`, `embed`, `ready`), spooky status narratives, and streaming telemetry terminal.
  - **Haunt:** 3-column dashboard with repository overview card ("dead for N years" badge, languages, commits, files), interactive ghost chat with markdown formatting, clickable citation chips, ungrounded sentence muting with warning tooltips, seance tone toggle, starter prompts, and slide-out evidence inspection drawer.
- **Phase 5 (Resurrection Mode):** Autonomous problem detection and verified code restoration. Features:
  - **Finding Detection (`resurrect/detect.ts`):** Automated test suite failure analysis and codebase TODO/FIXME/HACK/XXX extraction with deterministic SHA-1 IDs and repository HEAD SHA caching (`findings.json`).
  - **Multi-Environment Sandbox (`resurrect/sandbox.ts`):** Isolated test runners including strict zero-egress Docker sandboxing (`--network none`, 512MB RAM, 1 CPU, 256 PIDs, 120s timeout, 8KB output cap), Safety Rule 5 fixture execution (`UnsafeLocalRunner`), and graceful disable fallbacks.
  - **Patch Guard (`resurrect/diffGuard.ts`):** Strict unified diff enforcement rejecting markdown fences, `.git`, `.github`, directory traversal, binary files, lockfiles, modifications exceeding 5 files or 200 lines, or unindexed files.
  - **Autonomous Proposal Loop (`resurrect/propose.ts`):** Context assembly with retrieval evidence, 3-attempt self-correcting retry loop testing patch application and test verification in ephemeral clones, repository concurrency guards (HTTP 409), and cited ghost explanations.
  - **Human-in-the-Loop Application (`resurrect/apply.ts`):** Explicit user approval creating and checking out `reporevenant/fix-{findingId}` branches, applying validated diffs, and committing with finding citations, alongside discard and raw `.patch` downloads.
  - **Resurrection Chamber UI (`ResurrectionPanel.tsx`):** Real-time findings gallery, before/after test result comparison strips, syntax-highlighted diff viewer, cited explanation chips, and one-click branch creation or rejection.

## Running the UI & API
Start development servers:
```bash
# Terminal 1: Backend API
npm run dev --workspace=apps/api

# Terminal 2: Next.js Frontend
npm run dev --workspace=apps/web
```
Navigate to `http://localhost:3000` to access the REPOREVENANT UI.

## Verification
Run all tests, typecheck, and linting across the monorepo:
```bash
npm run verify
```

To run end-to-end index and hybrid retrieval verification on an actual repository fixture:
```bash
npx tsx scripts/verify-retrieval.ts
```

To run golden set chat evaluation:
```bash
npx tsx scripts/chat-eval.ts
```


