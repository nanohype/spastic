# spastic

A CLI for deploying and operating a startup team of Claude managed agents. Nine specialized agents — Product, Design, Engineering, QA, Sales, Marketing, Operations, Customer Success — orchestrated by a Coordinator through predefined workflows, review gates, and a structured intake contract.

## Setup

```sh
npm install
npm run build
export ANTHROPIC_API_KEY=sk-ant-...
```

## Deploy

```sh
spastic deploy                    # creates environment, uploads skills, deploys 9 agents
spastic deploy --dry-run          # prints all API payloads without sending
spastic status                    # show deployed agent status
```

## Interact

```sh
spastic chat coordinator          # interactive REPL with the coordinator
spastic send <session-id> <msg>   # one-shot message + stream response
spastic workflow launch-prep "Build a RAG search for enterprise docs"
spastic standup                   # team status report via coordinator
```

## Workflows

Five built-in multi-agent sequences with review gates:

| Workflow           | Steps                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| `launch-prep`      | Product, Design, Engineering, QA, Operations, Marketing + Sales + CS (parallel) |
| `feature-build`    | Product, Design, Engineering, QA                                                |
| `incident`         | Operations, Engineering, QA, Operations                                         |
| `customer-onboard` | Sales, Customer Success, Product                                                |
| `market-push`      | Product, Marketing, Sales                                                       |

```sh
spastic workflow feature-build "Add OAuth support" --no-gates
spastic revise <session-id> "Client wants SAML instead of OAuth"
```

## Configuration

```sh
spastic memory                    # company memory (enabled by default)
spastic journal                   # per-agent journals (enabled by default)
spastic repo add https://github.com/org/repo --branch main
spastic model set engineering claude-opus-4-6
```

## Sprint Mode

```sh
spastic sprint start --cadence weekly
spastic sprint add "Implement search API" --role engineering
spastic sprint standup
spastic sprint status
```

## Skills

Each agent is loaded with a domain skill derived from nanohype brief templates:

```sh
spastic skills show product       # preview the PRD brief skill
spastic skills upload --all       # upload all 9 skills
```

## Intake Contract

The coordinator accepts structured JSON input conforming to `spastic.schema.json`. Any external agent can read the schema and construct a valid first message:

```json
{
  "goal": "Build a RAG-powered search for enterprise docs",
  "workflow": "feature-build",
  "constraints": { "timeline": "4 weeks", "deploy_target": "aws" },
  "context": { "client": "Acme Corp", "existing_systems": ["PostgreSQL", "S3"] }
}
```
