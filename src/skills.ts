import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TeamMember, TeamRole } from './types.js';

// ── Skill definition mapping ────────────────────────────────────────

interface SkillDef {
  name: string;
  description: string;
  type: 'brief' | 'composed' | 'generated';
  briefTemplate?: string; // for type: brief — template dir name
  referencePaths?: string[]; // for type: composed — additional files
}

const SKILL_DEFS: Record<TeamRole, SkillDef> = {
  coordinator: {
    name: 'team-routing',
    description:
      'Team routing guide with role capabilities, sequencing rules, and handoff protocols for orchestrating a startup team of specialized agents.',
    type: 'generated',
  },
  product: {
    name: 'prd-brief',
    description:
      'Framework for drafting product requirements documents: problem decomposition, user stories, success metrics, and scope boundaries.',
    type: 'brief',
    briefTemplate: 'brief-prd',
  },
  design: {
    name: 'design-review-brief',
    description:
      'Methodology for systematic design audits: visual consistency, token coverage, component coherence, and accessibility compliance.',
    type: 'brief',
    briefTemplate: 'brief-design-review',
  },
  engineering: {
    name: 'engineering-catalog',
    description:
      'Template selection decision matrix and production readiness checklist for composing nanohype templates into production systems.',
    type: 'composed',
    referencePaths: ['docs/catalog.md', 'docs/production-readiness.md'],
  },
  qa: {
    name: 'test-strategy-brief',
    description:
      'Framework for defining test strategy: layer definitions, coverage targets, CI integration, flaky test management, and the testing trophy model.',
    type: 'brief',
    briefTemplate: 'brief-test-strategy',
  },
  sales: {
    name: 'proposal-brief',
    description:
      'Framework for drafting client proposals: needs analysis, solution design, pricing structure, timeline, and success criteria.',
    type: 'brief',
    briefTemplate: 'brief-proposal',
  },
  marketing: {
    name: 'campaign-plan-brief',
    description:
      'Framework for campaign planning: goal refinement, audience analysis, channel strategy, messaging, budget allocation, and KPI definition.',
    type: 'brief',
    briefTemplate: 'brief-campaign-plan',
  },
  operations: {
    name: 'runbook-brief',
    description:
      'Framework for operational runbooks: service architecture, dependency mapping, incident response, escalation paths, and disaster recovery.',
    type: 'brief',
    briefTemplate: 'brief-runbook',
  },
  'customer-success': {
    name: 'onboarding-playbook-brief',
    description:
      'Framework for customer onboarding: stage definition, milestone tracking, health scoring, intervention playbooks, and handoff criteria.',
    type: 'brief',
    briefTemplate: 'brief-onboarding-playbook',
  },
  'eng-frontend': {
    name: 'frontend-engineering',
    description:
      'Frontend implementation expertise: Next.js, React, browser extensions, design token integration, accessibility, and client-side architecture.',
    type: 'generated',
  },
  'eng-backend': {
    name: 'backend-engineering',
    description:
      'Backend implementation expertise: HTTP services, databases, queues, caching, auth, and server-side architecture with nanohype composable modules.',
    type: 'generated',
  },
  'eng-ai': {
    name: 'ai-engineering',
    description:
      'AI systems expertise: agent loops, RAG pipelines, MCP servers, evals, guardrails, LLM cost optimization, and multimodal processing.',
    type: 'generated',
  },
  'qa-automation': {
    name: 'test-automation',
    description:
      'Test automation expertise: framework setup, CI pipeline design, coverage strategy, test data management, and flaky test resolution.',
    type: 'generated',
  },
  'qa-security': {
    name: 'security-testing',
    description:
      'Security testing expertise: OWASP Top 10, dependency scanning, auth boundary testing, API security, and infrastructure hardening.',
    type: 'generated',
  },
  'ops-sre': {
    name: 'site-reliability',
    description:
      'SRE expertise: SLO definition, monitoring, alerting, capacity planning, infrastructure as code, and deployment pipelines.',
    type: 'generated',
  },
  'ops-incident': {
    name: 'incident-response',
    description:
      'Incident management expertise: response procedures, escalation paths, postmortems, runbooks, and change management.',
    type: 'generated',
  },
  'data-analyst': {
    name: 'data-analysis',
    description:
      'Analytics expertise: product metrics, business KPIs, spastic analysis, LLM cost tracking, and dashboard design.',
    type: 'generated',
  },
  'tech-writer': {
    name: 'technical-writing',
    description:
      'Documentation expertise: API docs, user guides, changelogs, onboarding content, and knowledge base management.',
    type: 'generated',
  },
  'product-research': {
    name: 'product-research',
    description: 'User research, competitive analysis, market sizing, and discovery.',
    type: 'generated',
  },
  'product-growth': {
    name: 'product-growth',
    description: 'Activation funnels, retention loops, PLG metrics, and experiment design.',
    type: 'generated',
  },
  'design-ux': {
    name: 'ux-research',
    description: 'Usability testing, user journey mapping, wireframes, and interaction design.',
    type: 'generated',
  },
  'design-accessibility': {
    name: 'accessibility',
    description: 'WCAG compliance, screen reader testing, keyboard navigation, and a11y audits.',
    type: 'generated',
  },
  'eng-infra': {
    name: 'infrastructure',
    description: 'Cloud infrastructure, Terraform/CDK, networking, container orchestration.',
    type: 'generated',
  },
  'eng-perf': {
    name: 'performance',
    description: 'Profiling, load testing, p99 optimization, caching strategy, Core Web Vitals.',
    type: 'generated',
  },
  'eng-devex': {
    name: 'developer-experience',
    description: 'CLI tools, SDK design, local dev setup, internal tooling, DX optimization.',
    type: 'generated',
  },
  'qa-data': {
    name: 'data-quality',
    description: 'Data validation, pipeline testing, schema drift detection, data contracts.',
    type: 'generated',
  },
  'sales-solutions': {
    name: 'solutions-engineering',
    description: 'Technical pre-sales, demos, POC scoping, integration planning.',
    type: 'generated',
  },
  'marketing-content': {
    name: 'content-marketing',
    description: 'Blog posts, case studies, technical content, whitepapers, thought leadership.',
    type: 'generated',
  },
  'marketing-seo': {
    name: 'seo',
    description: 'Keyword strategy, technical SEO audits, organic growth, search performance.',
    type: 'generated',
  },
  'brand-strategist': {
    name: 'brand-strategy',
    description: 'Brand voice, narrative positioning, messaging architecture, brand guidelines.',
    type: 'generated',
  },
  'ops-finops': {
    name: 'finops',
    description: 'Cloud cost optimization, usage metering, budget forecasting, billing analysis.',
    type: 'generated',
  },
  'ops-compliance': {
    name: 'compliance',
    description: 'SOC 2, GDPR, HIPAA frameworks, audit prep, policy writing.',
    type: 'generated',
  },
  'cs-support': {
    name: 'technical-support',
    description: 'Technical triage, bug reproduction, customer debugging, KB articles.',
    type: 'generated',
  },
  'cs-renewals': {
    name: 'renewals',
    description: 'Renewal strategy, expansion playbooks, churn prevention, account health.',
    type: 'generated',
  },
  'chief-of-staff': {
    name: 'chief-of-staff',
    description: 'Cross-team coordination, status rollups, blocker resolution, operational rhythm.',
    type: 'generated',
  },
  legal: {
    name: 'legal',
    description: 'Contracts, ToS, privacy policies, IP protection, client agreements.',
    type: 'generated',
  },
  'lead-inbound': {
    name: 'inbound-leads',
    description: 'Inbound lead qualification, scoring, and content-to-lead conversion.',
    type: 'generated',
  },
  'lead-outbound': {
    name: 'outbound-prospecting',
    description: 'Cold outreach, email sequences, target list building.',
    type: 'generated',
  },
  'lead-research': {
    name: 'lead-research',
    description: 'Company research, technographic profiling, ICP matching.',
    type: 'generated',
  },
  'prompt-optimizer': {
    name: 'prompt-optimizer',
    description: 'Agent output analysis, prompt failure detection, prompt improvement recommendations.',
    type: 'generated',
  },
  'lead-partnerships': {
    name: 'partnerships',
    description: 'Partner outreach, affiliate programs, co-marketing.',
    type: 'generated',
  },
  'lead-social': {
    name: 'social-selling',
    description: 'LinkedIn strategy, social selling, community engagement.',
    type: 'generated',
  },
  'lead-events': {
    name: 'event-leads',
    description: 'Webinar planning, attendee follow-up, demo scheduling.',
    type: 'generated',
  },
  'lead-referral': {
    name: 'referrals',
    description: 'Referral programs, case studies, testimonials, advocacy.',
    type: 'generated',
  },
  'biz-dev': {
    name: 'business-development',
    description: 'Strategic partnerships, channel development, market expansion.',
    type: 'generated',
  },
  'ux-writer': {
    name: 'ux-writing',
    description: 'Microcopy, UI text, error messages, onboarding copy.',
    type: 'generated',
  },
  'eng-mobile': {
    name: 'mobile-engineering',
    description: 'React Native, cross-platform, mobile UX, app store deployment.',
    type: 'generated',
  },
  'qa-ux': {
    name: 'ux-testing',
    description: 'Usability validation, user flow testing, cross-device verification.',
    type: 'generated',
  },
  'sales-ops': {
    name: 'sales-operations',
    description: 'CRM hygiene, pipeline reporting, sales process optimization.',
    type: 'generated',
  },
  'marketing-email': {
    name: 'email-marketing',
    description: 'Email campaigns, drip sequences, deliverability, A/B testing.',
    type: 'generated',
  },
  'ops-automation': {
    name: 'workflow-automation',
    description: 'Internal automation, integration mapping, process optimization.',
    type: 'generated',
  },
  'build-verifier': {
    name: 'build-verification',
    description: 'Build, test, and lint pipeline validation with structured pass/fail reporting.',
    type: 'generated',
  },
  'artifact-auditor': {
    name: 'artifact-auditing',
    description: 'Post-workflow artifact verification, path validation, completeness checks.',
    type: 'generated',
  },
  'pr-reviewer': {
    name: 'pr-review',
    description: 'Diff-level code review, quality checks, security basics, naming conventions.',
    type: 'generated',
  },
  devrel: {
    name: 'developer-relations',
    description: 'Developer advocacy, docs-as-marketing, SDK experience, community engagement.',
    type: 'generated',
  },
  'compliance-automation': {
    name: 'compliance-automation',
    description: 'Policy-as-code, automated compliance checks, audit evidence collection.',
    type: 'generated',
  },
  'template-quality': {
    name: 'template-quality',
    description: 'Template outcome tracking, pattern extraction, quality scorecards.',
    type: 'generated',
  },
  'cross-project-learner': {
    name: 'cross-project-learning',
    description: 'Project pattern extraction, company memory curation, anti-pattern documentation.',
    type: 'generated',
  },
  'scaffold-validator': {
    name: 'scaffold-validation',
    description: 'Post-scaffold install, build, and structure validation before code is written.',
    type: 'generated',
  },
  'release-manager': {
    name: 'release-management',
    description: 'Changelog generation, version bumps, deploy readiness, release coordination.',
    type: 'generated',
  },
  'client-packager': {
    name: 'client-packaging',
    description: 'Client-facing deliverables, polished README, architecture diagrams, handoff checklists.',
    type: 'generated',
  },
  'session-analyst': {
    name: 'session-analysis',
    description: 'Workflow output scoring, agent efficiency analysis, improvement recommendations.',
    type: 'generated',
  },
  'intake-analyst': {
    name: 'intake-analysis',
    description: 'Intake JSON validation, constraint feasibility, ambiguity resolution, workflow suggestion.',
    type: 'generated',
  },
  'onboarding-tester': {
    name: 'onboarding-testing',
    description: 'Clone-to-run validation, README verification, first-run experience testing.',
    type: 'generated',
  },
  'external-reviewer': {
    name: 'quality-rubric-cold',
    description:
      'Cold-context code audit against the 9-dimension quality rubric. No upstream verdicts — grades the post-merge tree against the intake brief and outputs letter grades as the calibration signal.',
    type: 'generated',
  },
};

// ── Public API ──────────────────────────────────────────────────────

export function getSkillDef(role: string): SkillDef | undefined {
  return SKILL_DEFS[role as TeamRole];
}

export function getAllSkillDefs(): [TeamRole, SkillDef][] {
  return Object.entries(SKILL_DEFS) as [TeamRole, SkillDef][];
}

/**
 * Load skill content for a role, ready for API upload.
 * Returns the SKILL.md content and optional reference files.
 */
export async function loadSkillContent(
  role: TeamRole,
  nanohypePath: string,
  team?: TeamMember[],
): Promise<{ content: string; referenceFiles: { name: string; content: string }[] }> {
  const def = SKILL_DEFS[role];

  switch (def.type) {
    case 'brief':
      return loadBriefSkill(def, nanohypePath);
    case 'composed':
      return loadComposedSkill(def, nanohypePath);
    case 'generated':
      if (role === 'coordinator') {
        return { content: buildCoordinatorSkill(team ?? []), referenceFiles: [] };
      }
      // Specialist roles — skill content is embedded in their system prompt
      return {
        content: `---\nname: ${def.name}\ndescription: ${def.description}\n---\n\n${def.description}`,
        referenceFiles: [],
      };
  }
}

/**
 * Preview skill content without reference files (for `skills show`).
 */
export async function previewSkillContent(role: TeamRole, nanohypePath: string, team?: TeamMember[]): Promise<string> {
  const { content } = await loadSkillContent(role, nanohypePath, team);
  return content;
}

/**
 * Resolve the nanohype repo path from flags, env, or default.
 */
export function resolveNanohypePath(flagValue?: string): string {
  if (flagValue) return resolve(flagValue);
  if (process.env.NANOHYPE_PATH) return resolve(process.env.NANOHYPE_PATH);
  // Default: sibling directory (nanohype/nanohype alongside nanohype/spastic)
  // From dist/skills.js → spastic/ → parent (nanohype monorepo root) → nanohype/
  const thisDir = fileURLToPath(new URL('.', import.meta.url));
  return resolve(thisDir, '..', '..', 'nanohype');
}

// ── Brief skill loading ─────────────────────────────────────────────

interface TemplateVariable {
  name: string;
  placeholder: string;
  description: string;
}

async function loadBriefSkill(
  def: SkillDef,
  nanohypePath: string,
): Promise<{ content: string; referenceFiles: { name: string; content: string }[] }> {
  const templateDir = join(nanohypePath, 'templates', def.briefTemplate!);
  const briefPath = join(templateDir, 'skeleton', 'brief.md');
  const yamlPath = join(templateDir, 'template.yaml');

  const [briefRaw, yamlRaw] = await Promise.all([readFile(briefPath, 'utf-8'), readFile(yamlPath, 'utf-8')]);

  const variables = parseVariables(yamlRaw);
  const content = wrapAsSkillMd(def, stripPlaceholders(briefRaw, variables));

  return { content, referenceFiles: [] };
}

/**
 * Replace __PLACEHOLDER__ tokens with bracketed descriptions.
 * e.g., __PROBLEM_STATEMENT__ → [the core problem this product addresses]
 */
function stripPlaceholders(content: string, variables: TemplateVariable[]): string {
  let result = content;
  for (const v of variables) {
    if (!v.placeholder) continue;
    const replacement = `[${v.description.toLowerCase()}]`;
    result = result.replaceAll(v.placeholder, replacement);
  }
  return result;
}

/**
 * Parse variable definitions from template.yaml without a YAML library.
 * Extracts name, placeholder, and description fields.
 */
function parseVariables(yaml: string): TemplateVariable[] {
  const variables: TemplateVariable[] = [];
  const lines = yaml.split('\n');
  let current: Partial<TemplateVariable> | null = null;

  for (const line of lines) {
    if (line.match(/^\s{2}- name:\s*/)) {
      if (current?.name && current.placeholder && current.description) {
        variables.push(current as TemplateVariable);
      }
      current = { name: line.replace(/^\s{2}- name:\s*/, '').trim() };
    } else if (current && line.match(/^\s{4}placeholder:\s*/)) {
      current.placeholder = line
        .replace(/^\s{4}placeholder:\s*/, '')
        .trim()
        .replace(/^"|"$/g, '');
    } else if (current && line.match(/^\s{4}description:\s*/)) {
      current.description = line
        .replace(/^\s{4}description:\s*/, '')
        .trim()
        .replace(/^"|"$/g, '');
    }
  }

  if (current?.name && current.placeholder && current.description) {
    variables.push(current as TemplateVariable);
  }

  return variables;
}

// ── Composed skill loading ──────────────────────────────────────────

async function loadComposedSkill(
  def: SkillDef,
  nanohypePath: string,
): Promise<{ content: string; referenceFiles: { name: string; content: string }[] }> {
  const referenceFiles: { name: string; content: string }[] = [];

  for (const relPath of def.referencePaths ?? []) {
    const absPath = join(nanohypePath, relPath);
    const fileContent = await readFile(absPath, 'utf-8');
    const fileName = relPath.split('/').pop()!;
    referenceFiles.push({ name: fileName, content: fileContent });
  }

  const content = buildEngineeringSkill(referenceFiles.map((f) => f.name));

  return { content, referenceFiles };
}

function buildEngineeringSkill(referenceFileNames: string[]): string {
  const refs = referenceFileNames.map((f) => `- **${f}**`).join('\n');

  return `---
name: engineering-catalog
description: Template selection decision matrix and production readiness checklist for composing nanohype templates into production systems.
---

# Engineering Decision Guide

You have access to the nanohype template catalog — a library of production-ready templates for building AI systems, applications, infrastructure, and composable modules.

## How to Use This Skill

When asked to build something:
1. Consult the decision matrix in **catalog.md** to identify the right starting template
2. Layer in composable modules based on technical requirements (auth, database, caching, etc.)
3. Select infrastructure for the deployment target
4. If 3+ templates are needed, wrap in monorepo
5. Always add eval-harness alongside AI system templates
6. Verify against the production readiness checklist before shipping

## Key Composition Rules

- AI systems provide intelligence, applications provide the interface
- Modules are never standalone — they plug into applications or AI systems
- Pick one deploy target per project
- monorepo wraps multi-template projects (3+ templates)

## Reference Files

${refs}

Consult these reference files for the full decision matrix, template profiles, module descriptions, and composition patterns.`;
}

// ── Generated skill (coordinator) ───────────────────────────────────

function buildCoordinatorSkill(team: TeamMember[]): string {
  const nonCoord = team.filter((m) => m.role !== 'coordinator');

  // Skill contains detailed per-agent capabilities (supplements the system prompt's routing rules)
  const roster = nonCoord
    .map((m) => {
      const templates = extractTemplateNames(m.system);
      const mcps = m.mcpServers.join(', ');
      return `### ${m.name} (${m.role})
- **Expertise:** ${m.description}
- **Templates:** ${templates}
- **Integrations:** ${mcps}`;
    })
    .join('\n\n');

  return `---
name: team-routing
description: Detailed agent capabilities reference and handoff protocols for the coordinator.
---

# Agent Capabilities Reference

Detailed capabilities for each of the ${nonCoord.length} agents. Use this to make precise routing decisions.

${roster}

## Handoff Protocols

When delegating from one agent to another, always include:
- What was decided and why
- Relevant artifacts produced (PRD, design tokens, test plan, etc.)
- Constraints and non-negotiables
- Success criteria for the receiving agent's work
- WRITE TO: /workspace/artifacts/{role}/
- REPORT BACK: list every file path, URL, and external ID created`;
}

/**
 * Extract template names from a system prompt's template list.
 * Looks for lines with comma-separated template names.
 */
function extractTemplateNames(system: string): string {
  const lines = system.split('\n');
  const templateLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') && trimmed.includes(':')) {
      const name = trimmed.slice(2).split(':')[0].trim();
      if (name.match(/^[a-z][\w-]*$/)) {
        templateLines.push(name);
      }
    }
  }

  if (templateLines.length > 0) return templateLines.join(', ');

  // Fallback: look for known template patterns
  const matches = system.match(
    /\b(?:agentic-loop|rag-pipeline|mcp-server-\w+|eval-harness|prompt-library|ts-service|go-service|next-app|module-\w+|infra-\w+|[a-z]+-[a-z]+)\b/g,
  );
  return matches ? [...new Set(matches)].join(', ') : '(see system prompt)';
}

// ── SKILL.md wrapper ────────────────────────────────────────────────

function wrapAsSkillMd(def: SkillDef, briefContent: string): string {
  return `---
name: ${def.name}
description: ${def.description}
---

${briefContent}`;
}
