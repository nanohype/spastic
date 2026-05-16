# spastic

A TypeScript CLI for deploying and operating a startup-team of Claude managed agents via the Anthropic Managed Agents API. Agents are organized into three teams routed by a single Coordinator:

- **Factory** — the build pipeline: Find → Design → Build → Verify → Ship → Deliver
- **Firm** — runs the business: sales, lead-gen, marketing, operations, customer, staff
- **Lab** — meta roles for prompt optimization, session analysis, cross-project learning, template quality, and cold-context external review

`src/team.ts` is the source of truth for the team roster. `src/workflows.ts` is the source of truth for built-in workflows.

## Setup

```sh
npm install
npm run build
export ANTHROPIC_API_KEY=sk-ant-...
```

If you'll use any switchboard service (HubSpot, Drive, Calendar, Analytics, CSE, Stripe), the semantic memory server, or the cost dashboard, also point at the `mcp-gateway` deployment in protohype:

```sh
export MCP_GATEWAY_BASE_URL=https://<api-id>.execute-api.us-west-2.amazonaws.com
export MCP_GATEWAY_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id /mcp-gateway/gateway-bearer-token \
  --query SecretString --output text)
```

The vault holds per-agent credentials that the gateway injects at session creation time:

```sh
spastic vault setup            # walks through credential capture
```

## Deploy

```sh
spastic deploy                 # creates environment, uploads skills, deploys the full roster
spastic deploy --dry-run       # prints all API payloads without sending
spastic status                 # show deployed agent status
spastic agents                 # list deployed agents and their model overrides
```

## Interact

```sh
spastic chat coordinator                       # interactive REPL
spastic send <session-id> <message>            # one-shot message + stream
spastic workflow <name> "<intake-json or goal>"
spastic stream <session-id>                    # tail an in-flight session
spastic standup                                # team status report via coordinator
```

`spastic workflows` lists the built-in workflows; each has its own role sequence and (for code-producing workflows) a merge-gate finalizer. See `src/workflows.ts` for the full catalog.

## Configuration

```sh
spastic memory                                 # company memory (MCP-backed)
spastic journal                                # per-agent journals
spastic repo add https://github.com/org/repo --branch main --token <pat>
spastic model set <role> <model-id>
spastic budget set <usd>                       # per-session advisor budget
```

## Sprint mode

```sh
spastic sprint start --cadence weekly
spastic sprint add "Implement search API" --role engineering
spastic sprint standup
spastic sprint status
spastic sprint end
```

## Skills

Each agent is loaded with a domain skill derived from nanohype brief templates:

```sh
spastic skills show <role>
spastic skills upload --all
```

## Inspection / operations

```sh
spastic sessions                               # list sessions
spastic threads <session-id>                   # list threads
spastic events <session-id>                    # raw SSE event stream
spastic usage                                  # token + cost rollups
spastic perf                                   # latency + reliability stats
spastic export <session-id> > transcript.json
spastic recover <session-id>                   # resume an interrupted stream
spastic adopt <agent-id>                       # adopt an externally-created agent into state
```

## Intake contract

The coordinator accepts structured JSON conforming to `spastic.schema.json`. Any external agent can read the schema and construct a valid first message:

```json
{
  "goal": "Build a RAG-powered search for enterprise docs",
  "workflow": "feature-build",
  "constraints": { "timeline": "4 weeks", "deploy_target": "aws", "language": "typescript" },
  "context": { "client": "Acme Corp", "existing_systems": ["PostgreSQL", "S3"] }
}
```

See `docs/INTAKE_GUIDE.md` for the brief authoring rubric (section anatomy, anti-patterns, examples, pre-flight checklist) — the `intake-analyst` role applies this guide to every incoming brief.

## Development

```sh
npm run build                                  # tsc
npm test                                       # vitest
npm run lint                                   # typecheck + eslint
npm run format:check                           # prettier
```

Node ≥ 24. TypeScript strict mode, ESM, Node16 module resolution. Tests live in `__tests__/` and are type-checked via `tsconfig.test.json`.
