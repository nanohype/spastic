# spastic — Claude Code Instructions

## What this project is

A TypeScript CLI that deploys and orchestrates a team of 65 Claude managed agents via the Anthropic Managed Agents API. Agents are organized into three teams:

- **Factory** (30 agents) — the build pipeline: Find → Design → Build → Verify → Ship → Deliver
- **Firm** (29 agents) — runs the business: sales, lead gen, marketing, operations, customer, staff
- **Lab** (5 agents) — meta: prompt optimization, session analysis, cross-project learning, template quality, external-reviewer (cold-context rubric calibration)

A single **Coordinator** routes work across all three teams.

## Architecture

- `src/types.ts` — all interfaces (agents, sessions, events, state, workflows). `TeamGroup` + `TeamRole` unions here.
- `src/api.ts` — `AnthropicAgents` class wrapping the managed agents REST API. Includes SSE reconnection with `Last-Event-ID`, pagination helper (`listAll`), and fast-model support.
- `src/team.ts` — all 65 `TeamMember` definitions with base system prompts, `group` field, and `mcpServers` arrays
- `src/prompts.ts` — `buildSystemPrompt()` augmentation layer: appends company memory, journal, self-eval, repo, sprint, revision, and factory-production-standards preamble sections based on state + group. The Build Verification Protocol dispatches language-specific commands via `LANGUAGE_TOOLCHAIN[state.projectLanguage]`.
- `src/standards.ts` — single source of truth for factory production policies: `LANGUAGE_TOOLCHAIN` (build/lint/test/docs/install/version-lookup per language), `FOUR_PHASE_CONTRACT`, `VERSION_CURRENCY_POLICY`, `EVIDENCE_CONTRACT`, `QUALITY_RUBRIC` (9 dimensions, per-role assigned), `IAC_BY_TARGET`, `LLM_POLICY`, `PRODUCTION_BAR` (9 dimensions), `COMMIT_PR_POLICY`, `MERGE_GATE_CONTRACT`, `FACTORY_PREAMBLE` (assembled), `CODE_GATE_ROLES`, `DOCS_GATE_ROLES`. Imported by `prompts.ts` and this CLAUDE.md's "Production Standards" section below.
- `src/gate.ts` — pure helpers `parseGateVerdict`, `mergeGateVerdicts`, `applySelfReviewDowngrade` (merge-gate revision loop), plus `parseQualityGrades` + `compareGrades` (external-reviewer calibration). Verdicts without `TRANSCRIPTS:` + `CITATIONS:` blocks are auto-downgraded to REJECT per `EVIDENCE_CONTRACT`.
- `src/mcp.ts` — MCP server registry. Third-party servers (github, linear, slack, notion, sentry, figma, hunter) hit public endpoints directly. Gateway-hosted services (hubspot, gdrive, analytics, gcalendar, gcse, stripe, memory) route through `${MCP_GATEWAY_BASE_URL}/mcp/{service}`. Auth is injected by the vault at session time (no inline headers).
- `src/skills.ts` — loads domain skills from nanohype brief templates
- `src/workflows.ts` — 18 built-in workflows tagged `factory | firm | lab`, with parallel groups, review gates, revision support, and workflow-level merge gates (`gateProfile: 'code' | 'docs'`). `streamWithAdvisor` is the shared stream consumer. `runMergeGate` is the merge-gate finalizer.
- `src/repl.ts` — interactive REPL with `/quit`, `/status`, `/threads`, `/switch`. Prompts for tool confirmation when `always_ask` policy fires.
- `src/cost.ts` — fire-and-forget cost event uploader. POSTs to `${MCP_GATEWAY_BASE_URL}/dashboard/api/cost` on every `span.model_request_end` and every advisor call.
- `src/advisor.ts` — `ADVISOR_TOOL` (Opus 4.6 escalation) + `callAdvisor()`. Cost-tracked, per-session budgeted.
- `src/usage.ts` — token aggregation and cost estimation (local reporting)
- `src/state.ts` — local `.spastic-state.json` persistence
- `src/stream.ts` — SSE event formatting for terminal output. Handles all event types including MCP tool use, thread events, and session status rescheduled/terminated.
- `src/bin/spastic.ts` — CLI entry point. `advisorToolsFor(role)` gates the Opus advisor tool to 9 roles (coordinator + 8 leads).
- `spastic.schema.json` — intake contract JSON schema for external agents

## Conventions

- Zero external runtime dependencies (native fetch, Node 20+)
- TypeScript strict mode, ES2022 target, Node16 module resolution
- Raw arg parsing (no yargs/commander)
- 2-space indent everywhere
- ESLint + Prettier configured
- Tests with Vitest in `__tests__/`

## Factory Production Standards

Every factory agent (30 roles with `group: 'factory'`) receives `FACTORY_PREAMBLE` as a system-prompt section via `buildSystemPrompt`. The preamble defines the non-negotiable policies every factory deliverable must obey. Source of truth: `src/standards.ts`. Never inline these policies in role prompts — reference by name ("see PRODUCTION_BAR") so there's one place to edit.

- **Language dispatch** — `LANGUAGE_TOOLCHAIN` maps each supported language (typescript, go, python, rust, java, kotlin, csharp) to `install / build / lint / test / docs` commands + manifest + lockfile + `versionLookup` + registry. Every factory command is dispatched through this map — no `npm run X` baked in. `constraints.language` in the intake brief drives the resolution; `buildSystemPrompt` reads `state.projectLanguage` and emits the right commands in the Build Verification Protocol.
- **Four-phase contract** (`FOUR_PHASE_CONTRACT`) — every project exposes **build, lint, test, docs** as distinct executable phases that exit 0 from a clean checkout. CI runs all four as separate jobs. `build-verifier` runs all four plus `install` and a version-currency check, captures per-command stdout/stderr/exit as `TRANSCRIPTS:` evidence, and REJECTs on any failure.
- **Latest versions first** (`VERSION_CURRENCY_POLICY`) — every manifest entry is checked against its language registry (npm, proxy.golang.org, PyPI, crates.io, Maven Central, NuGet) at build-verifier time. Entries ≥1 major stale without an adjacent `@pin <reason>` annotation = REJECT. EOL language runtimes (Python ≤3.9, Node ≤18 post-2025-04, Go ≤1.20) = REJECT regardless of `@pin`. Intake-analyst enforces this at brief-submission time too.
- **Evidence on verdicts** (`EVIDENCE_CONTRACT`) — every gate verdict carries two appendix blocks: `TRANSCRIPTS:` (captured output per command run) and `CITATIONS:` (`{claim, file, line_range, quoted_fragment}` — fragment must appear verbatim at the cited location). APPROVE/REQUEST_CHANGES without both blocks = auto-downgraded to REJECT at the pipeline layer by `parseGateVerdict` in `gate.ts`. REJECT verdicts may ship without evidence (the point there is to fail fast).
- **Quality rubric** (`QUALITY_RUBRIC`) — 9 dimensions imported from `/quality-check`, each assigned to one gate role. Every verdict ends with a `QUALITY_GRADES:` block scoped to the role's dimensions. pr-reviewer grades architecture/patterns/frontend/code_quality; qa-security grades security/systems; build-verifier grades testing/devops/version_currency; artifact-auditor grades documentation/consistency. The `external-reviewer` role (lab group) grades all 9 cold (no internal verdicts, no prior context) as a calibration check — `compareGrades` blocks release on >1-letter drift between internal and external per dimension.
- **IaC by deploy_target** — aws→AWS CDK (TS/Python/Go/Java/C#), gcp→Pulumi (TS/Python/Go/C#), k8s→Helm+Kustomize, fly→fly.toml, vercel→vercel.json, cloudflare→Wrangler, serverless→SAM/Serverless. Terraform is NOT the default on AWS.
- **LLM policy** — Claude-primary via AWS Bedrock. SDK per language (TS `@aws-sdk/client-bedrock-runtime`, Python `boto3`, Go `aws-sdk-go-v2/service/bedrockruntime`, Rust `aws-sdk-bedrockruntime`, Java `software.amazon.awssdk:bedrockruntime`, C# `AWSSDK.BedrockRuntime`). IAM-role auth. Default `claude-sonnet-4-6`, opus for complex reasoning, haiku for classification. Prompt caching mandatory.
- **Production bar** (9 dimensions, non-negotiable) — tests, observability, security, reliability, cost, docs, CI, code-shape, versions. See `PRODUCTION_BAR` in standards.ts for full text.
- **Commit + PR policy** — CLI pre-creates `feat/<slug>` branch on the target repo; every role commits one commit via github MCP `push_files`; release-manager opens the PR only after the merge gate approves AND external-reviewer calibration aligns. PR description includes a **Scope ledger** section (Planned / Delivered / Deferred from `scope-ledger.json`) — release notes generated from `Planned ∩ Delivered ∩ actual diff`, never free-text.
- **Merge gate** — factory PRs block on 4-role sign-off with evidence (pr-reviewer + qa-security + build-verifier + artifact-auditor — code gate) or 2-role (artifact-auditor + qa-security — docs gate). After approval, `external-reviewer` runs cold-context calibration. Any REJECT → fail; any REQUEST_CHANGES → revise (3 attempts); all APPROVE + calibration within ±1 letter → release-manager opens the PR with verdicts + grades in the body.

## Key patterns

- **Prompt augmentation**: `team.ts` has base prompts, `prompts.ts` appends dynamic sections (including `FACTORY_PREAMBLE` for factory roles from `standards.ts`). Deploy calls `buildSystemPrompt(member, state)`. Never modify system prompts in `team.ts` for state-dependent content — put it in `prompts.ts`. Never inline production policies — put them in `standards.ts`.
- **Runner-driven delegation**: `executeWorkflow` invokes each role in its own session via `runRoleSession(api, role, message, workflowName)` — a fresh `api.createSession` with that role's deployed agent ID, the configured repos + vaults, and the role's own system prompt. Coordinator discretion is not a delegation path; the coordinator can plan and route, but it cannot write artifacts on behalf of a role. External-reviewer calibration is naturally cold because a new session starts with no prior context. Advisor (Opus) and per-role models are used correctly because each role runs on its own deployed agent.
- **Repo fail-fast**: on code-producing workflows, `executeWorkflow` halts up front if no primary repo is configured or the GitHub branch pre-create fails. Silent degradation produced Marshal v0.1's symptom (coordinator called `get_me`, got a bot with 0 repos, tried to create one, eventually stumbled onto `nanohype/protohype` via `ls /workspace`). The clear error message directs the user to `spastic repo add <github-url> --token <github-pat>`.
- **Merge gate flow**: code-producing workflows (feature-build, mobile-ship, infra-setup, security-audit, perf-review, incident, automate, launch-prep) declare `gateProfile: 'code'`. Doc-only workflows (content-engine) declare `gateProfile: 'docs'`. `executeWorkflow` in `workflows.ts` parses `constraints.language` from the intake JSON and persists it via `setProjectLanguage`, then pre-creates the feature branch. After the main workflow loop, `runMergeGate` iterates the gate roles (each in its own session), parses each `GATE_VERDICT` (with evidence enforcement via `parseGateVerdict`), merges via `mergeGateVerdicts`, loops up to 3 times on revise. On APPROVE (code profile only), `runExternalCalibration` invokes `external-reviewer` in its own cold session — `compareGrades` detects >1-letter drift per dimension and blocks with a synthesized REJECT naming the diverged role. release-manager only opens the PR when gate and calibration both pass, and its pre-push synthesis (intake-to-merge traceability + gate correlation spot-check) clears.
- **Self-review downgrade**: if a PR diff touches a gate role's own definition file, that vote downgrades to advisory via `applySelfReviewDowngrade`. Remaining roles must approve unanimously.
- **Intake briefs**: `spastic.schema.json` defines the brief shape; `docs/INTAKE_GUIDE.md` defines the quality bar (anatomy of each section, anti-patterns from past failures, two annotated examples, pre-flight checklist). Anyone authoring a brief — human or agent — applies the guide's rubric. The `intake-analyst` role loads the guide, applies the checklist, enriches recoverable gaps, and blocks unrecoverable ones with specific questions to the caller before the workflow proceeds.
- **State batching**: `deploy()` loads state once, mutates in memory, writes once at the end. Other commands use individual helper functions from `state.ts`.
- **MCP servers always included**: the registry in `mcp.ts` provides default URLs. Env vars override, never gate.
- **Stream termination**: `streamWithAdvisor` breaks on `session.status_idle`, `session.error`, and `session.status_terminated`. It continues through `session.status_rescheduled` (transient retry).
- **Advisor access is scoped**: only coordinator + 8 leads get the `consult_advisor` tool. All specialist roles are excluded to keep Opus distribution in check. Per-session call cap is 3 (default) via `StreamOptions.maxAdvisorCalls`.
- **Memory is an MCP server**: agents call `memory_query` / `memory_store` / `memory_list` / `memory_delete` on the gateway's `/memory` endpoint. Each agent's `agentId` is its role (or `"coordinator"`).
- **Cost events are pushed**: every `span.model_request_end` and every advisor call fires a POST to the dashboard. Tagged `source: 'managed_agents' | 'advisor'` so Opus spend is visible separately.

## Environment

Required:

- `ANTHROPIC_API_KEY`

Required if using the gateway (switchboard services, memory, cost dashboard):

- `MCP_GATEWAY_BASE_URL` — API Gateway endpoint from `cdk deploy` output
- `MCP_GATEWAY_TOKEN` — bearer from `/mcp-gateway/gateway-bearer-token` in Secrets Manager

Optional per-server URL overrides: `MCP_GITHUB_URL`, `MCP_LINEAR_URL`, `MCP_SLACK_URL`, `MCP_NOTION_URL`, `MCP_SENTRY_URL`, `MCP_FIGMA_URL`, `MCP_HUNTER_URL`, `MCP_HUBSPOT_URL`, `MCP_GDRIVE_URL`, `MCP_GCALENDAR_URL`, `MCP_ANALYTICS_URL`, `MCP_GCSE_URL`, `MCP_STRIPE_URL`, `MCP_MEMORY_URL`.

## Running

```sh
npm install
npm run build        # tsc
npm test             # vitest
npm run lint         # tsc --noEmit + eslint
npm run format:check # prettier
```

## Style

- 2-space indent for TypeScript, JSON, YAML, Markdown
- LF line endings
- No trailing whitespace
