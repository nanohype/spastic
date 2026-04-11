import type { SpasticState, TeamMember, TeamRole } from './types.js';
import { FACTORY_PREAMBLE, LANGUAGE_TOOLCHAIN } from './standards.js';
import { parseGitHubUrl } from './git.js';

/**
 * Build the final system prompt for an agent by augmenting the base
 * prompt from team.ts with dynamic sections based on spastic state.
 */
export function buildSystemPrompt(member: TeamMember, state: SpasticState): string {
  const sections: string[] = [member.system];
  const isCoordinator = member.role === 'coordinator';

  // ── Factory Production Standards (factory group only) ─────────
  // Injected as a trailing block so role-specific voice leads the
  // prompt; standards anchor the non-negotiable policies every
  // factory agent must obey (IaC, LLM, production bar, commit/PR,
  // merge gate).
  if (member.group === 'factory') {
    sections.push(FACTORY_PREAMBLE);
  }

  // ── Company Memory (semantic, via memory MCP server) ──────────
  if (state.memory.enabled) {
    const agentId = isCoordinator ? 'coordinator' : member.role;
    if (isCoordinator) {
      sections.push(`## Company Memory

You have access to a semantic memory MCP server. Tools:
- memory_query({ agentId, query, topK?, threshold? }) — semantic similarity search
- memory_store({ agentId, text, summary?, tags?, ttl?, metadata? }) — save a learning
- memory_list({ agentId, tags?, limit? }) — list memories (tag-filtered)
- memory_delete({ agentId, memoryId }) — remove

These are MCP tools, not shell commands. Invoke them by name through the MCP toolset. NEVER shell out (\`bash\`, \`sh\`, \`eval\`) with \`memory_query ...\` as if it were a CLI — it is not on PATH, the call will silently fail, and a silent miss is worse than a loud one. If a memory tool errors or is unavailable, report it explicitly in your handoff ("memory unavailable — proceeded without prior context"); do not mask failures with \`|| echo\` or \`2>/dev/null\` fallbacks.

Use agentId "${agentId}" for your own memories. Use the delegated agent's role (e.g., "eng-backend") when storing cross-agent context on their behalf.

Before planning any delegation:
1. memory_query({ agentId: "coordinator", query: <goal-summary>, topK: 5 }) for prior relevant decisions.
2. memory_query with relevant delegate roles for role-specific context.

After Step 3 (Synthesize), memory_store({ agentId: "coordinator", text, tags: ["session", "workflow:<name>"] }) with:
- Key decisions made
- Artifact paths, URLs, IDs
- Constraints discovered
- Open questions deferred`);
    } else {
      sections.push(`## Company Memory

You have access to a semantic memory MCP server. Tools:
- memory_query({ agentId, query, topK?, threshold? }) — semantic similarity search
- memory_store({ agentId, text, summary?, tags?, ttl?, metadata? }) — save a learning
- memory_list({ agentId, tags?, limit? }) — list your memories (tag-filtered)
- memory_delete({ agentId, memoryId }) — remove

These are MCP tools, not shell commands. Invoke them by name through the MCP toolset. NEVER shell out (\`bash\`, \`sh\`, \`eval\`) with \`memory_query ...\` as if it were a CLI — it is not on PATH, the call will silently fail, and a silent miss is worse than a loud one. If a memory tool errors or is unavailable, report it explicitly in your deliverable ("memory unavailable — proceeded without prior context"); do not mask failures with \`|| echo\` or \`2>/dev/null\` fallbacks.

Your agentId is "${agentId}".

Before starting work: memory_query({ agentId: "${agentId}", query: <task-summary>, topK: 5 }) for prior decisions and learnings relevant to this task.

After completing your deliverables: memory_store({ agentId: "${agentId}", text, tags: [<task-tags>] }) with key decisions and durable learnings — not transcripts.`);
    }
  }

  // ── Agent Journal ─────────────────────────────────────────────
  if (state.journal.enabled && !isCoordinator) {
    const journalPath = `${state.journal.basePath}/${member.role}.md`;
    sections.push(`## Personal Journal

Before starting work, read ${journalPath} if it exists. It contains your learnings, patterns, and decisions from previous sessions.

After completing your deliverables, append to ${journalPath}:
- What you learned during this task
- Patterns or approaches that worked well
- Mistakes or dead ends to avoid next time
- Reusable decisions or configurations`);
  }

  const isEngineering = member.role.startsWith('eng') || member.role === 'engineering';

  // ── Git Repository ────────────────────────────────────────────
  if (state.repos.length > 0) {
    const repoList = state.repos
      .map((r) => `- ${r.url} mounted at ${r.mount_path ?? '/workspace/' + r.url.split('/').pop()}`)
      .join('\n');

    if (isEngineering) {
      sections.push(`## Repository Access

Git repositories are mounted in the container:
${repoList}

### Project Structure Convention

The protohype repo is a monorepo of prototypes. Each project lives in its own subdirectory:

\`\`\`
protohype/
  project-alpha/    ← one project
  project-beta/     ← another project
  new-project/      ← your new project goes here
\`\`\`

When starting a new project:
1. Choose a project name that reflects the product/approach: lowercase, hyphenated (e.g., "doc-search", "rag-agent", "billing-api")
2. Create a new subdirectory: \`/workspace/protohype/{project-name}/\`
3. Scaffold nanohype templates INTO that subdirectory: \`npx nanohype scaffold ts-service --output /workspace/protohype/{project-name}\`
4. All code, configs, and docs for this project live inside its subdirectory
5. Create a feature branch: \`feat/{project-name}\`
6. Commit and push via GitHub MCP — never push directly to main

### Naming Guidelines

Project names should be creative and memorable — single words or short compound words that evoke the project's purpose without being literal:
- "lighthouse" not "doc-search"
- "harvest" not "lead-scraper"
- "switchboard" not "api-gateway"
- "compass" not "analytics-dashboard"
- "sentinel" not "monitoring-service"

Before creating a directory, list existing subdirectories in protohype/ and pick a name that doesn't conflict. Never reuse an existing project name.

If the coordinator provides a project name in the delegation, use it. If not, choose a creative name and state it in your first response.

### Deployment Target

Never assume a deployment platform (Fly.io, Vercel, AWS, etc.). Check the project for existing deploy configs (Dockerfile, fly.toml, vercel.json, terraform/, cdk/). If none exist, use the CONSTRAINTS from your delegation. If still unclear, default to containerized (Dockerfile) for portability.`);
    } else if (isCoordinator) {
      const primaryRepo = state.repos[0];
      const { owner, repo } = parseGitHubUrl(primaryRepo.url);
      sections.push(`## Repository Access

Git repositories are mounted for Engineering:
${repoList}

**Primary target repo:** \`${owner}/${repo}\` (full URL: ${primaryRepo.url})

For every code-producing workflow (feature-build, mobile-ship, infra-setup, security-audit, perf-review, incident, automate, launch-prep), the CLI pre-creates a feature branch on \`${owner}/${repo}\` BEFORE you start routing. The delegation context you receive will contain:

\`\`\`
TARGET REPO: ${owner}/${repo}
BRANCH: feat/<slug> (already created — do NOT create, do NOT search, do NOT fork)
PROJECT SLUG: <slug>
COMMIT PATTERN: one commit per role via github MCP push_files, \`feat(<slug>/<role>): <summary>\`
PR CREATION: release-manager opens the PR at workflow end
\`\`\`

Pass the TARGET REPO / BRANCH / PROJECT SLUG block through to EVERY specialist you delegate to. They commit their own artifacts via the github MCP's \`push_files\` on that branch — one commit per role, never batched.

You do NOT search for repos. You do NOT create repos. You do NOT fork. If an agent reports "repo not found," fail the workflow with a clear error for the user — do not try to recover by creating one. The primary target is always \`${owner}/${repo}\`.`);
    } else if (
      [
        'qa',
        'qa-automation',
        'qa-security',
        'qa-ux',
        'qa-data',
        'operations',
        'ops-sre',
        'ops-incident',
        'ops-compliance',
      ].includes(member.role)
    ) {
      sections.push(`## Repository Access

Git repositories are mounted in the container:
${repoList}

You can read code, run tests, and review configurations. Projects are in subdirectories (e.g., protohype/doc-search/).`);
    }
  }

  // ── Self-Evaluation ───────────────────────────────────────────
  if (!isCoordinator) {
    const qualityChecks = getQualityChecks(member.role);
    sections.push(`## Self-Evaluation

Before reporting completion, verify:

${qualityChecks}

If any check fails, fix it (up to 3 iterations) before reporting.

SELF-EVAL: PASS | FAIL (failed: [list])
ARTIFACTS: [every file path, URL, and ID you created]`);
  }

  // ── Template Scaffolding (Engineering only) ───────────────────
  if (member.role === 'engineering') {
    sections.push(`## Template Scaffolding

The nanohype CLI is installed in your environment. Use it to scaffold production-ready templates:

  npx nanohype scaffold <template-name> --output /workspace/src/<dir>
  npx nanohype scaffold --composite <name> --output /workspace/src/<dir>

Examples:
  npx nanohype scaffold ts-service --output /workspace/src/api
  npx nanohype scaffold module-auth --output /workspace/src/modules/auth
  npx nanohype scaffold rag-pipeline --output /workspace/src/ai

Always scaffold into /workspace/src/ and commit the result to the mounted repository.`);
  }

  // ── Build Verification (Engineering only) ────────────────────
  if (isEngineering) {
    const lang = state.projectLanguage;
    const tc = LANGUAGE_TOOLCHAIN[lang];
    const typecheckLine = tc.typecheck ? `   b. \`${tc.typecheck}\` — type checking, zero errors.\n` : '';
    sections.push(`## Build Verification Protocol (${lang})

Before reporting completion or creating a PR, run the four-phase contract for this project's language (\`${lang}\`) and fix every failure:

1. **Install** — \`${tc.install}\` — all dependencies resolve from the lockfile (\`${tc.lockfile}\`).
2. **Build** — \`${tc.build}\` — exit 0, artifact produced.
${typecheckLine ? `   a. Plus: ${typecheckLine.trim()}\n` : ''}3. **Lint** — \`${tc.lint}\` — static analysis + formatter check, exit 0.
4. **Test** — \`${tc.test}\` — all tests pass with ≥70% line coverage.
5. **Docs** — \`${tc.docs}\` — API docs regenerated from source (see FOUR_PHASE_CONTRACT); the generated tree must match the committed docs tree.
6. **Version currency** — for every top-level dependency in \`${tc.manifest}\`, confirm it is at most one major behind current stable via \`${tc.versionLookup}\` (registry: ${tc.registry}). Entries ≥1 major stale without an adjacent \`@pin <reason>\` annotation are REJECT (see VERSION_CURRENCY_POLICY).
7. **Dependency audit** — for each declared dependency, grep source files for an actual import. Remove any package nothing imports. For each dev dependency, verify its config exists (e.g., eslint needs eslint config, vitest needs vitest config, golangci-lint needs .golangci.yml).
8. **No hardcoded project names in source** — project identity comes from the manifest's name field or env vars, never string literals scattered across files.
9. **No broken scripts** — every entry in the manifest's script section runs to exit 0 or is removed. Shipping a broken script = hard REJECT.
10. **Markdown link integrity** — every internal link in committed markdown resolves within the repo. No \`/workspace/\` paths, no broken relatives.
11. **CI present** — CI config (\`.github/workflows/ci.yml\` or equivalent) runs install + build + lint + test + docs as four distinct jobs on pull_request. Absence of CI = hard REJECT.

These are the same phases and commands \`build-verifier\` will run at merge-gate time, so if they fail here they will fail there. Do not report completion until all pass. Capture stdout + stderr + exit code per phase for the gate's evidence block.

BUILD VERIFICATION: install ✓/✗ | build ✓/✗ | lint ✓/✗ | test ✓/✗ (n passing, coverage %) | docs ✓/✗ (regen matches committed) | versions ✓/✗ (n stale) | deps clean ✓/✗ | scripts valid ✓/✗ | links valid ✓/✗ | CI exists ✓/✗`);
  }

  // ── Artifact Commit Protocol ─────────────────────────────────
  if (!isCoordinator && state.repos.length > 0) {
    sections.push(`## Artifact Commit Protocol

**Publishing to the repo: use ONLY the github MCP \`push_files\` tool.** Do NOT use bash \`git commit\`, \`git push\`, or any git CLI commands — the container has no local git proxy and they WILL fail with "Failed to connect to 127.0.0.1 port 58418". Every file you want in the repo must go through \`push_files\` with the target branch from the delegation context.

After writing artifacts to /workspace/artifacts/{role}/, also commit key documents to the project repo via \`push_files\`:
- PRDs, design specs, security audits, test strategies → {project}/docs/
- Strip project-specific names and update status fields before committing.
- Before committing docs, verify all internal links resolve within the repo. Replace any /workspace/artifacts/ paths with the correct repo-relative path. If a link target doesn't exist in the repo, remove the link.
- The project repo is the source of truth. /workspace/artifacts/ is ephemeral.`);
  }

  // ── Sprint Mode (Coordinator only) ────────────────────────────
  if (isCoordinator && state.sprint) {
    sections.push(`## Sprint Mode

You are operating in sprint mode (sprint ${state.sprint.currentSprint}, ${state.sprint.cadence} cadence). You maintain continuity across standups and work sessions.

Each standup:
1. Review the backlog and current sprint items
2. Query each assigned agent for their status
3. Identify blockers and re-delegate if needed
4. Update item statuses based on agent reports
5. Recommend items to pull into the next cycle

Report format:
SPRINT ${state.sprint.currentSprint} STANDUP
=====================
[role]: [status] — [key update]
BLOCKED: [list of blocked items and what they need]
NEXT: [recommended actions before next standup]`);
  }

  // ── Revision Protocol (Coordinator only) ──────────────────────
  if (isCoordinator) {
    sections.push(`## Revision Protocol

When you receive a revision request (a message referencing prior workflow output with change requests):
1. Identify which agents' work is affected by the feedback
2. Re-engage ONLY those agents — do not re-run the entire workflow
3. Pass each agent their original output plus the specific changes needed
4. If Agent A's revision affects Agent B's work, re-engage Agent B after Agent A completes
5. Produce an updated artifact manifest showing what changed`);
  }

  return sections.join('\n\n');
}

/**
 * Role-specific quality checks for the self-evaluation section.
 */
function getQualityChecks(role: TeamRole): string {
  if (role.startsWith('eng') || role === 'engineering') {
    return `1. All code compiles and tests pass (ran build + test commands)
2. No unused dependencies, no hardcoded project names or platform assumptions
3. Security basics: no secrets in code, inputs validated at boundaries, errors don't leak internals
4. Design artifacts (PRD, security audit) committed to project docs/, not just /workspace/artifacts/
5. Every script in package.json runs successfully — no broken tooling references
6. All markdown links resolve within the repo — no /workspace/ paths in committed files
7. Documentation matches implementation — if docs say "drop this construct in" the code must support that usage`;
  }
  if (role.startsWith('qa')) {
    return `1. All findings VERIFIED by running actual commands (not theoretical)
2. Tests written against the real installed API surface (checked versions with npm ls)
3. Coverage measured and reported with actual numbers
4. Security findings include severity, evidence, and specific remediation steps`;
  }
  return `1. All criteria from your skill's Quality Criteria section are met
2. All artifacts written to correct paths AND to external services
3. Output is actionable by the next agent in the workflow
4. No assumptions made — all claims backed by evidence or explicit context`;
}
