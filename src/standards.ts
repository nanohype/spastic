import type { Language, TeamRole } from './types.js';

// ── Spastic Factory Production Standards ───────────────────────────
//
// Single source of truth for the non-negotiable policies every factory
// agent must obey. Imported by prompts.ts (injected into factory role
// system prompts as FACTORY_PREAMBLE) and by CLAUDE.md documentation.
//
// Individual role prompts in team.ts reference these sections by name
// ("see IAC_BY_TARGET" / "see PRODUCTION_BAR section 2") rather than
// restating the policy inline.

// ── Language dispatch — the factory is language-agnostic ───────────
//
// Every command the gate executes or an engineering agent runs comes
// from LANGUAGE_TOOLCHAIN. build/lint/test/docs are abstract phases —
// not `npm run X` — dispatched per the project's primary language
// (from constraints.language in the intake brief). The Language union
// itself lives in types.ts to keep standards.ts focused on policy
// rather than domain shape.

export interface Toolchain {
  install: string;
  build: string;
  lint: string;
  test: string;
  docs: string;
  typecheck?: string;
  lockfile: string;
  versionLookup: string;
  manifest: string;
  registry: string;
}

export const LANGUAGE_TOOLCHAIN: Record<Language, Toolchain> = {
  typescript: {
    install: 'npm ci',
    build: 'npm run build',
    lint: 'npm run lint',
    test: 'npm test',
    docs: 'npm run docs',
    typecheck: 'npx tsc --noEmit',
    lockfile: 'package-lock.json',
    versionLookup: 'npm view <pkg> version',
    manifest: 'package.json',
    registry: 'npm (registry.npmjs.org)',
  },
  go: {
    install: 'go mod download',
    build: 'go build ./...',
    lint: 'golangci-lint run',
    test: 'go test ./...',
    docs: 'go doc ./...',
    lockfile: 'go.sum',
    versionLookup: 'go list -m -versions <mod>',
    manifest: 'go.mod',
    registry: 'proxy.golang.org',
  },
  python: {
    install: 'pip install --require-hashes -r requirements.lock.txt',
    build: 'python -m build',
    lint: 'ruff check . && ruff format --check .',
    test: 'pytest',
    docs: 'pdoc -o docs src',
    typecheck: 'mypy src',
    lockfile: 'requirements.lock.txt (or poetry.lock)',
    versionLookup: 'pip index versions <pkg>',
    manifest: 'pyproject.toml',
    registry: 'PyPI (pypi.org)',
  },
  rust: {
    install: 'cargo fetch --locked',
    build: 'cargo build --locked',
    lint: 'cargo clippy --locked -- -D warnings && cargo fmt --check',
    test: 'cargo test --locked',
    docs: 'cargo doc --no-deps',
    lockfile: 'Cargo.lock',
    versionLookup: 'cargo search --limit 1 <crate>',
    manifest: 'Cargo.toml',
    registry: 'crates.io',
  },
  java: {
    install: 'mvn dependency:resolve -DskipTests',
    build: 'mvn compile -DskipTests',
    lint: 'mvn checkstyle:check spotbugs:check',
    test: 'mvn test',
    docs: 'mvn javadoc:javadoc',
    lockfile: 'pom.xml (<dependencyManagement> pinned) or gradle.lockfile',
    versionLookup: 'mvn versions:display-dependency-updates',
    manifest: 'pom.xml',
    registry: 'Maven Central (search.maven.org)',
  },
  kotlin: {
    install: './gradlew dependencies',
    build: './gradlew build -x test',
    lint: './gradlew ktlintCheck detekt',
    test: './gradlew test',
    docs: './gradlew dokkaHtml',
    lockfile: 'gradle.lockfile',
    versionLookup: './gradlew dependencyUpdates',
    manifest: 'build.gradle.kts',
    registry: 'Maven Central (search.maven.org)',
  },
  csharp: {
    install: 'dotnet restore --locked-mode',
    build: 'dotnet build --no-restore --configuration Release',
    lint: 'dotnet format --verify-no-changes && dotnet build /warnaserror',
    test: 'dotnet test --no-build',
    docs: 'dotnet tool run docfx docfx.json',
    lockfile: 'packages.lock.json',
    versionLookup: 'dotnet list package --outdated',
    manifest: '<project>.csproj',
    registry: 'NuGet (nuget.org)',
  },
};

// ── Four-phase contract ────────────────────────────────────────────

export const FOUR_PHASE_CONTRACT = `## Four-phase contract

Every project exposes four executable phases — **build, lint, test, docs** — dispatched via the toolchain for \`constraints.language\`:

- **build** — compile, bundle, produce the deployable artifact. \`LANGUAGE_TOOLCHAIN[lang].build\`.
- **lint** — static analysis plus formatter verification, ran together. \`LANGUAGE_TOOLCHAIN[lang].lint\`.
- **test** — unit + integration tests with coverage gate. \`LANGUAGE_TOOLCHAIN[lang].test\`.
- **docs** — regenerate API docs from source (TypeDoc, godoc, pdoc, rustdoc, Javadoc, Dokka, DocFX). \`LANGUAGE_TOOLCHAIN[lang].docs\`.

Non-negotiables:

- Each phase exits 0 from a clean checkout after running \`install\` first.
- CI runs all four phases on every pull_request as distinct jobs (not one fused script that short-circuits on the first failure).
- \`build-verifier\` runs all four and captures stdout + stderr + exit code per phase as \`TRANSCRIPTS:\` evidence. Missing transcript or non-zero exit = hard REJECT.
- \`artifact-auditor\` re-runs \`docs\` and diffs the output against the committed docs tree. Drift ≥ 1 file = REJECT (docs silently rot otherwise).
- Absence of a phase script in the project manifest is a hard REJECT at \`scaffold-validator\` — if the project can't run it, it isn't production-ready.

Languages with built-in toolchains (Go, Rust) still need \`docs\` configured (\`go doc\`, \`cargo doc\`); "it builds" is not a docs phase.`;

// ── Latest versions first ──────────────────────────────────────────

export const VERSION_CURRENCY_POLICY = `## Latest versions first

Every new build adopts the **current stable** release of every language runtime, framework, and top-level dependency. No inherited defaults, no "whatever the template shipped with."

- The intake brief's \`constraints.language_versions\` names the primary language version (e.g., \`{"node":"22","typescript":"5.9"}\`). Drafters MUST set this to current stable at brief time — intake-analyst rejects EOL versions.
- Every manifest entry (\`package.json\`, \`go.mod\`, \`pyproject.toml\`, \`Cargo.toml\`, \`pom.xml\`, etc.) is checked against the language registry at build-verifier time via \`LANGUAGE_TOOLCHAIN[lang].versionLookup\`.
- Entries **more than one major behind current stable** are REJECT, unless inline-annotated with \`@pin <reason>\` adjacent to the dependency (accepted reasons: security hold, upstream bug, compatibility with pinned peer). No \`@pin\` annotation = no exception.
- Language runtimes that have reached end-of-life (e.g., Python 3.7, Node 16, Go 1.20) are REJECT regardless of \`@pin\`. EOL is EOL.
- Registries queried for currency checks: ${Object.entries(LANGUAGE_TOOLCHAIN)
  .map(([k, v]) => `${k} → ${v.registry}`)
  .join('; ')}.

This policy is enforced twice:

1. **build-verifier** runs the currency check over the committed manifest, captures registry-response transcripts, and REJECTs on staleness.
2. **qa-security** reviews the currency report for supply-chain implications — known CVEs in stale majors, abandoned upstreams, license drift.

The anti-pattern this prevents: shipping \`eslint 8.57\` (EOL) + \`vitest 1.x\` (3 majors behind) + \`typescript 5.4\` on a greenfield project because the training-data default is stale. Chorus did this. The factory will not.`;

// ── Evidence contract — execute-then-claim ─────────────────────────

export const EVIDENCE_CONTRACT = `## Evidence contract

Every gate verdict carries two appendix blocks. Verdicts without them are automatically downgraded to REJECT by the pipeline BEFORE the merge proceeds — no LLM judgment involved.

**TRANSCRIPTS:** — for every command the role claims to have run, include the captured stdout, stderr, and exit code. One fenced block per command. If you did not run the command, do not list it. "Ran locally" / "assumed to pass" / "same as last time" are not transcripts and produce an auto-REJECT.

\`\`\`
TRANSCRIPTS:
  - command: npm run build
    exit: 0
    stdout: |
      > dispatch@0.1.0 build
      > tsc -p tsconfig.json
      (no output — build clean)
    stderr: ""
  - command: npm test
    exit: 0
    stdout: |
      Test Files  12 passed (12)
      Tests       84 passed (84)
    stderr: ""
\`\`\`

**CITATIONS:** — for every claim made in the verdict body, a \`{claim, file, line_range, quoted_fragment}\` tuple. The quoted fragment must appear **verbatim** at the cited location in the post-merge tree. Citations whose fragments don't match disk = auto-REJECT.

\`\`\`
CITATIONS:
  - claim: "auth middleware resolves identity via Okta SCIM, not fabricated email"
    file: packages/api/src/auth/middleware.ts
    line_range: 42-57
    quoted_fragment: |
      const { userId } = await oktaClient.users.getByEmail(claim.email);
      if (!userId) throw new AuthError('unknown identity');
\`\`\`

Applies to: APPROVE and REQUEST_CHANGES verdicts. REJECT verdicts may ship without TRANSCRIPTS/CITATIONS — the point there is to fail fast, not to gather paperwork.

The anti-pattern this prevents: gate saying "42 tests passing" when zero tests exist; artifact-auditor saying "all 11 artifacts verified" when 10 don't exist on disk; threat-model citing an ACL SQL fragment that appears nowhere in the codebase. All three were real Dispatch/Chorus slip-throughs. Citation-bound verdicts and pipeline-level evidence enforcement stop them.`;

// ── Quality rubric (9 dimensions, imported from /quality-check) ────

export const QUALITY_RUBRIC = `## Quality rubric

Grade every dimension A-F per the \`/quality-check\` methodology. A is exceptional, B is solid, C is adequate, D has significant issues, F is broken. Most production code is B-/C+ — grade inflation helps no one.

Dimensions are assigned across gate roles. Every gate verdict ends with a \`QUALITY_GRADES:\` block covering that role's assigned dimensions. The external-reviewer runs all nine dimensions cold (no internal verdicts, no prior context) as a calibration check; >1 letter drift on any dimension between internal and external grades blocks the release.

| # | Dimension                                  | Graded by           | Mark N/A when                      |
| - | ------------------------------------------ | ------------------- | ---------------------------------- |
| 1 | Architecture & Domain Modeling             | pr-reviewer         | never — always applicable          |
| 2 | Design Patterns & Reuse                    | pr-reviewer         | trivial single-module scripts      |
| 3 | Systems Thinking                           | qa-security         | pure libraries with no I/O         |
| 4 | Testing Strategy (Testing Trophy)          | build-verifier      | never — always applicable          |
| 5 | Frontend Architecture & Design Systems     | pr-reviewer         | no user-facing UI                  |
| 6 | Security                                   | qa-security         | never — always applicable          |
| 7 | Code Quality & Craft                       | pr-reviewer         | never — always applicable          |
| 8 | Documentation & Developer Experience       | artifact-auditor    | never — always applicable          |
| 9 | Consistency & Polish                       | artifact-auditor    | never — always applicable          |

Output shape each role appends:

\`\`\`
QUALITY_GRADES:
  architecture: B+
  patterns: A-
  code_quality: B
  frontend: N/A
\`\`\`

Use snake_case keys: \`architecture, patterns, systems, testing, frontend, security, code_quality, documentation, consistency\`.

Quoting the source: "Assign grades honestly. A is exceptional. B is solid. C is adequate. D has significant issues. F is broken. Most production code is B-/C+ — grade inflation helps no one."`;

// ── Infrastructure-as-code defaults by deploy_target ──────────────

export const IAC_BY_TARGET = `## IaC by deploy_target

Match the infrastructure tooling to the deploy target in the intake brief. IaC language SHOULD match the project's primary \`constraints.language\` when the tool supports it — keeping one language across app and infra lowers cognitive load.

| deploy_target | IaC tool                         | IaC language options                             | Notes                                                               |
| ------------- | -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| aws           | AWS CDK                          | TypeScript (default), Python, Go, Java, C#       | One stack per environment. VPC endpoints for Bedrock + Secrets Mgr. |
| gcp           | Pulumi                           | TypeScript, Python, Go, C#                       | Use GCP provider; avoid raw gcloud scripts.                         |
| k8s           | Helm + Kustomize overlays        | YAML (universal)                                 | One chart per service; overlays per environment.                    |
| fly           | fly.toml + Fly Machines API      | TOML (universal)                                 | Declarative config; use \`flyctl\` for rollouts.                    |
| vercel        | vercel.json + project config     | JSON (universal)                                 | Env vars via Vercel dashboard / CLI; no custom IaC.                 |
| cloudflare    | Wrangler + Workers config        | TOML (universal)                                 | wrangler.toml for each worker; KV/D1/R2 declared inline.            |
| serverless    | AWS SAM or Serverless Framework  | YAML (universal)                                 | Prefer CDK unless the brief specifies SAM/Serverless.               |

Never introduce a second IaC tool without written justification in the architecture artifact. Terraform is NOT the default on AWS — use CDK unless the brief explicitly names Terraform.`;

// ── LLM policy — Claude-primary, Bedrock-preferred ─────────────────

export const LLM_POLICY = `## LLM policy

Claude is the primary LLM for every factory build. Preferred delivery: AWS Bedrock (keeps data in the client's AWS trust boundary, simplifies enterprise compliance posture).

- SDK per language (pick to match \`constraints.language\`):
  - TypeScript: \`@aws-sdk/client-bedrock-runtime\`
  - Python: \`boto3\` (\`bedrock-runtime\` client)
  - Go: \`github.com/aws/aws-sdk-go-v2/service/bedrockruntime\`
  - Rust: \`aws-sdk-bedrockruntime\`
  - Java: \`software.amazon.awssdk:bedrockruntime\`
  - C#: \`AWSSDK.BedrockRuntime\`
  - Auth: IAM role-based. No API keys in code or env.
- Models:
  - Default: \`anthropic.claude-sonnet-4-6\` — most work
  - Escalation: \`anthropic.claude-opus-4-6\` — complex reasoning, architecture decisions
  - Light: \`anthropic.claude-haiku-4-5\` — classification, routing, filter steps
- Regions (in order of preference): \`us-west-2\`, \`us-east-1\`, \`eu-central-1\`. Verify the chosen model is live in the region before committing IaC.
- Prompt caching is mandatory. Use Bedrock \`cachePoint\` markers on the system prompt and any stable context prefix. Measure cache-hit ratio and surface it in the architecture artifact.
- Direct Anthropic SDK (\`@anthropic-ai/sdk\`, \`anthropic\` Python, etc.) is permitted ONLY if the intake brief explicitly requires it, or Bedrock lacks the required model variant. Document the exception in the architecture artifact.
- OpenAI / other providers: only if the brief names them as a requirement. Never default to GPT.`;

// ── Non-negotiable production bar ─────────────────────────────────

export const PRODUCTION_BAR = `## Production bar (non-negotiable)

Every factory build must meet all nine dimensions. Explicit waivers go in the architecture artifact with the role + rationale.

**Stubs don't count as done.** A function that returns \`[]\`, throws \`'not implemented'\`, has a \`// TODO: implement\` comment, or reads from a hardcoded fixture instead of the real source is a prototype — not a shipped build. If the intake brief did not request a prototype, stub implementations mean you self-REJECT your own work before the gate runs and fix it. Connector shims that return empty results, adapters that only handle the happy path, "we'll wire this up next sprint" functions — all prototype territory. The only acceptable stubs are ones explicitly waived in the architecture artifact with a migration plan and a ticketed follow-up.

**Aspirational comments are the bug.** A comment like \`// FINDING-02: Opt out of Bedrock invocation logging\` next to code that does NOT opt out is worse than no comment — it makes a falsifiable claim that the gate should reject. If you write a comment describing what the code SHOULD do, the code beneath it must do that. If you can't make the code match the claim, delete the comment and surface the gap explicitly in the architecture artifact. Other forbidden patterns: \`// Replace with actual X\`, \`// Mock for now\`, \`// Hardcoded for demo\`, \`// TODO: actually wire this up\`. These ship a known-broken claim and are auto-REJECT at the gate.

**Conventions inherit from the parent repo.** Every project subdirectory must produce a per-project \`CLAUDE.md\` that explicitly inherits or overrides the parent repo's \`CLAUDE.md\` conventions (test framework, build tool, lint/format setup, file layout). Default to the parent's choices unless the architecture artifact justifies the divergence. The factory does NOT silently switch frameworks (Vitest → Jest, pytest → unittest, Maven → Gradle) or invent new convention layers without explicit waiver. Missing per-project CLAUDE.md is a hard REJECT at artifact-auditor.

1. **Tests** — ≥70% line coverage, contract tests against every external API (Notion, Slack, Bedrock, etc.), load tests for any service claiming a p99 latency budget. Use the stack's idiomatic framework: \`vitest\`/\`jest\` for TS, \`pytest\` for Python, \`go test\` for Go, \`cargo test\` for Rust, JUnit/\`mvn test\` for Java. Zero tests is a hard REJECT at the gate, not a deficiency to defer. **Any file that orchestrates 3+ sibling modules OR makes 2+ external calls requires at least one integration test** — mocks of individual clients in unit tests do not substitute. Use testcontainers (or language equivalents: \`aws-sdk-client-mock\` + \`nock\` for TS, \`moto\` + \`responses\` for Python, \`httptest\` for Go, \`wiremock\` for Java) for hermetic integration coverage of the orchestration path.
2. **Observability** — OpenTelemetry traces (OTLP exporter to AWS Distro or Honeycomb), structured JSON logs with trace ID correlation, RED metrics (rate / errors / duration) per endpoint, \`/healthz\` and \`/readyz\` endpoints, dashboards enumerated in the runbook. **A correlation ID is generated at the request boundary (or propagated from upstream) and threaded through every log line, span, and downstream call** — a failing query that produces N uncorrelated log lines is an observability failure, not a "minor gap."
3. **Security** — IAM least-privilege (no \`*\` on resources or actions), secrets rotation documented, SAST + dependency scanning in CI (language-appropriate: \`npm audit\`/\`osv-scanner\` for TS, \`pip-audit\`/\`safety\` for Python, \`govulncheck\` for Go, \`cargo-audit\` for Rust, \`dependency-check\` for Java) configured to FAIL the job on findings (soft-warn-only is REJECT). Threat model in the architecture artifact listing top 5 risks + mitigations. **Identity resolution must use the upstream identity provider's API** — fabricated identity strings (e.g., constructing an email from a Slack user ID) are an identity-spoof surface and auto-REJECT at qa-security.
4. **Reliability** — graceful shutdown handlers, circuit breakers on every external call, retry with exponential backoff + jitter on transient failures, DLQ for async work. No in-memory state on multi-instance deployments — use Redis / DynamoDB / equivalent. **Every external client must have an explicit per-call timeout** (HTTP, AWS SDK, Redis, DB, gRPC). Default-infinity is a production incident waiting to happen — the gate requires explicit timeouts on Okta, Bedrock, OpenSearch, Redis, DynamoDB, etc. **Compliance and audit writes are blocking** — fire-and-forget patterns silently drop compliance trail when the underlying transport fails. Use \`await\` / the language's equivalent blocking call on audit; if you need fire-and-forget for latency, write to a local WAL sink first and have a separate flusher drain to the long-term store.
5. **Cost** — cost-per-1000-users analysis in the architecture artifact for any shared infra. Call out super-linear scaling (e.g., one Secrets Manager secret per user is NOT acceptable at 10k users — use a shared secret + DynamoDB token store).
6. **Docs** — runbook with dashboard links, common failure modes + remediation steps, on-call playbook. README with local dev + deploy instructions. \`.env.example\` listing every env var the code reads. Per-project \`CLAUDE.md\` declaring inherited conventions from the parent repo. PR description following the COMMIT_PR_POLICY template. API docs regenerated by the \`docs\` phase (see FOUR_PHASE_CONTRACT) and kept in sync with source.
7. **CI** — CI config (\`.github/workflows/ci.yml\` or equivalent) runs build + lint + test + docs on every pull_request as four distinct jobs (see FOUR_PHASE_CONTRACT). Dependency scanning configured to fail the job on HIGH/CRITICAL findings, not warn-only. Absence of CI is a hard REJECT at the gate.
8. **Code shape** — orchestrators (functions composing 3+ sibling modules into a request-response pipeline) are not 70-line procedural scripts. Use an explicit pipeline pattern (named stages, typed handoffs) so each stage is independently testable. Discriminated unions / tagged enums / sum types for state ("unverified" vs "verified" vs "redacted") instead of boolean flags on a single shape that changes meaning.
9. **Versions** — see VERSION_CURRENCY_POLICY. Latest stable across language runtime, frameworks, and top-level dependencies. EOL runtime = hard REJECT. ≥1 major stale without \`@pin\` annotation = REJECT.

See FOUR_PHASE_CONTRACT (build / lint / test / docs idiom), VERSION_CURRENCY_POLICY (latest-first rule), EVIDENCE_CONTRACT (transcripts + citations on verdicts), QUALITY_RUBRIC (9-dimension grading).`;

// ── Branching, commits, and PR policy ──────────────────────────────

export const COMMIT_PR_POLICY = `## Commit, branch, and PR policy

**Branching and commits are orchestrated** — For every code-producing workflow, the CLI pre-creates the feature branch on the target repo BEFORE any agent runs. Your delegation message will contain a block like:

\`\`\`
TARGET REPO: <owner>/<repo>
BRANCH: feat/<slug> (already created — do NOT create, do NOT search, do NOT fork)
PROJECT SLUG: <slug>
COMMIT PATTERN: one commit per role via github MCP push_files, \`feat(<slug>/<role>): <one-line summary>\`
PR CREATION: release-manager opens the PR at workflow end
\`\`\`

Use those values verbatim. **Your own role commits exactly one commit** via the github MCP's \`push_files\` tool with:

- \`owner\` and \`repo\` from TARGET REPO
- \`branch\` from BRANCH (pre-created; never \`create_branch\` yourself)
- \`message\`: \`feat(<slug>/<role>): <one-line summary>\` — your role name goes in the scope
- \`files\`: the exact files you produced, with repo-relative paths (e.g., \`<slug>/packages/ai/src/pipeline.ts\`)

Do NOT batch multiple roles' work into one commit. Do NOT create the branch yourself. Do NOT push to \`main\` ever. Do NOT open the PR — release-manager does that at workflow end after the merge gate approves.

If \`push_files\` fails with "branch not found" or "repo not found", report the error — do NOT fall back to \`create_branch\` or \`create_repository\`. That means the workflow is misconfigured and the user needs to fix state.

**Commit body** — beyond the conventional-commits subject line above:

- Body explains **why**, not what (the diff shows what). Include the hidden constraint, invariant, or decision a future reader cannot infer from the code.
- File-level detail when the scope spans >5 files: a short bullet per major file/module.
- Structured sections with box-drawing headers (\`─── Section ───\`) for any single commit >500 LOC. Section examples: Architecture, Data flow, Security posture, Out of scope.
- Reference the intake brief or issue ID at the bottom.

**PR description template** — release-manager fills this at workflow end:

\`\`\`
## Summary
<1-3 sentences on the outcome delivered. Not a feature list.>

## Architectural choices
<What talks to what, which pattern, and why. Name the alternatives you considered and why you rejected them.>

## Tradeoffs
<What you chose NOT to do, and the conditions under which you'd revisit.>

## Scope ledger
<Planned / Delivered / Deferred entries from scope-ledger.json. Release notes draw from Planned ∩ Delivered ∩ actual diff — not free-text.>

## Review checklist
<Role-specific items the reviewer should verify. Production bar dimensions that apply.>

## Gate verdicts
<Verdicts from pr-reviewer, qa-security, build-verifier, artifact-auditor, plus external-reviewer calibration. release-manager fills this in before opening the PR.>

## Out of scope
<Explicit scope fence. What this PR does not address.>
\`\`\``;

// ── Merge-gate contract ────────────────────────────────────────────

export const MERGE_GATE_CONTRACT = `## Merge gate

Every factory PR is blocked until:

1. **Automated four-phase pre-hook** runs install → build → lint → test → docs from a clean checkout of the feature branch via \`LANGUAGE_TOOLCHAIN[constraints.language]\`. Any non-zero exit auto-REJECTs the workflow BEFORE any LLM gate role is invoked. Transcripts are attached to the PR. (This alone would have caught Chorus — \`npm run build\` broke from day one.)
2. **Four gate roles sign off in parallel** (two for docs-only workflows):
   - \`pr-reviewer\` — architecture, patterns, code craft, API design, performance; production-path trace
   - \`qa-security\` — threat model, dependency supply chain, secret handling, identity resolution, systems-thinking grade
   - \`build-verifier\` — the four-phase transcripts + version-currency report + testing-strategy grade
   - \`artifact-auditor\` — filesystem-verified artifact list, scope-ledger reconciliation, docs regeneration diff, consistency grade
3. **Every verdict carries TRANSCRIPTS + CITATIONS** per EVIDENCE_CONTRACT. Pipeline auto-downgrades evidence-missing verdicts to REJECT before the LLM vote counts.
4. **Every verdict ends with QUALITY_GRADES** for the role's assigned rubric dimensions per QUALITY_RUBRIC.

Each gate role ends its response with this exact block structure (parsed verbatim):

\`\`\`
GATE_VERDICT: APPROVE | REJECT | REQUEST_CHANGES
GATE_FEEDBACK: <one-paragraph rationale — required for REJECT and REQUEST_CHANGES>

TRANSCRIPTS:
  - command: <...>
    exit: <n>
    stdout: |
      <captured>
    stderr: |
      <captured>

CITATIONS:
  - claim: <...>
    file: <...>
    line_range: <n-n>
    quoted_fragment: |
      <verbatim from file>

QUALITY_GRADES:
  <dimension>: <A|A-|B+|B|B-|C+|C|C-|D|F|N/A>
\`\`\`

Verdict merge rules:
- any REJECT → workflow fails (fix the issue, rerun the workflow)
- any REQUEST_CHANGES (no REJECT) → revision loop triggers, feedback concatenated into the next attempt
- all APPROVE → workflow advances to external-reviewer calibration

**External-reviewer calibration** (post-gate, pre-release):
After the four gate roles approve, \`external-reviewer\` runs in a fresh session with no factory context — only the intake brief and the post-merge tree. It grades all nine QUALITY_RUBRIC dimensions cold. The pipeline compares its grades against the internal gate roles' QUALITY_GRADES. Any dimension where external and internal differ by >1 letter (e.g., internal B, external D) blocks release and re-invokes the diverged role. Only when external grades align within ±1 letter does release-manager open the PR.

**Self-review downgrade:** if the PR diff touches a gate role's own definition, that vote downgrades to advisory and the remaining three must approve unanimously (handled by \`applySelfReviewDowngrade\` in \`gate.ts\`).`;

// ── Workflow gate profiles ─────────────────────────────────────────

export const CODE_GATE_ROLES: TeamRole[] = ['pr-reviewer', 'qa-security', 'build-verifier', 'artifact-auditor'];

export const DOCS_GATE_ROLES: TeamRole[] = ['artifact-auditor', 'qa-security'];

// ── Assembled factory preamble ─────────────────────────────────────

export const FACTORY_PREAMBLE = `# Factory Production Standards

You are operating on the nanohype factory team. Every deliverable you produce must obey the policies below. These are not suggestions — an artifact that violates them will be rejected at the merge gate and the workflow will loop back for revision.

${IAC_BY_TARGET}

${LLM_POLICY}

${PRODUCTION_BAR}

${FOUR_PHASE_CONTRACT}

${VERSION_CURRENCY_POLICY}

${EVIDENCE_CONTRACT}

${QUALITY_RUBRIC}

${COMMIT_PR_POLICY}

${MERGE_GATE_CONTRACT}`;
