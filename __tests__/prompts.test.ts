import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../src/prompts.js';
import { TEAM } from '../src/team.js';
import type { SpasticState } from '../src/types.js';

function makeState(overrides?: Partial<SpasticState>): SpasticState {
  return {
    agents: [],
    coordinatorId: null,
    skillIds: {},
    environmentId: null,
    memory: { enabled: true, path: '/workspace/.spastic/memory.md' },
    journal: { enabled: true, basePath: '/workspace/.spastic/journal' },
    repos: [],
    modelOverrides: {},
    sprint: null,
    vaultIds: [],
    budgetLimit: null,
    projectLanguage: 'typescript',
    ...overrides,
  };
}

function mockRepo() {
  return {
    type: 'github_repository' as const,
    url: 'https://github.com/test/repo',
    authorization_token: 'ghp_test',
    mount_path: '/workspace/repo',
  };
}

const coordinator = TEAM.find((m) => m.role === 'coordinator')!;
const product = TEAM.find((m) => m.role === 'product')!;
const engineering = TEAM.find((m) => m.role === 'engineering')!;
const engBackend = TEAM.find((m) => m.role === 'eng-backend')!;
const qaAutomation = TEAM.find((m) => m.role === 'qa-automation')!;

describe('buildSystemPrompt', () => {
  it('includes base system prompt', () => {
    const prompt = buildSystemPrompt(product, makeState());
    expect(prompt).toContain('You own what gets built and why');
  });

  it('appends memory section when enabled', () => {
    const prompt = buildSystemPrompt(
      product,
      makeState({ memory: { enabled: true, path: '/workspace/.spastic/memory.md' } }),
    );
    expect(prompt).toContain('Company Memory');
    expect(prompt).toContain('memory_query');
    expect(prompt).toContain('memory_store');
    expect(prompt).toContain('agentId');
  });

  it('omits memory section when disabled', () => {
    const prompt = buildSystemPrompt(
      product,
      makeState({ memory: { enabled: false, path: '/workspace/.spastic/memory.md' } }),
    );
    expect(prompt).not.toContain('Company Memory');
  });

  it('appends journal section for non-coordinator with role-specific path', () => {
    const prompt = buildSystemPrompt(product, makeState());
    expect(prompt).toContain('Personal Journal');
    expect(prompt).toContain('/workspace/.spastic/journal/product.md');
  });

  it('omits journal section for coordinator', () => {
    const prompt = buildSystemPrompt(coordinator, makeState());
    expect(prompt).not.toContain('Personal Journal');
  });

  it('appends self-evaluation for non-coordinator', () => {
    const prompt = buildSystemPrompt(product, makeState());
    expect(prompt).toContain('Self-Evaluation');
    expect(prompt).toContain('SELF-EVAL');
  });

  it('omits self-evaluation for coordinator', () => {
    const prompt = buildSystemPrompt(coordinator, makeState());
    expect(prompt).not.toContain('Self-Evaluation');
  });

  it('appends repo section when repos configured', () => {
    const state = makeState({
      repos: [mockRepo()],
    });
    const prompt = buildSystemPrompt(engineering, state);
    expect(prompt).toContain('Repository Access');
    expect(prompt).toContain('https://github.com/test/repo');
  });

  it('omits repo section when no repos', () => {
    const prompt = buildSystemPrompt(engineering, makeState());
    expect(prompt).not.toContain('Repository Access');
  });

  it('appends template scaffolding for engineering only', () => {
    const engPrompt = buildSystemPrompt(engineering, makeState());
    const prodPrompt = buildSystemPrompt(product, makeState());
    expect(engPrompt).toContain('Template Scaffolding');
    expect(prodPrompt).not.toContain('Template Scaffolding');
  });

  it('appends revision protocol for coordinator only', () => {
    const coordPrompt = buildSystemPrompt(coordinator, makeState());
    const prodPrompt = buildSystemPrompt(product, makeState());
    expect(coordPrompt).toContain('Revision Protocol');
    expect(prodPrompt).not.toContain('Revision Protocol');
  });

  it('appends build verification for engineering roles', () => {
    const prompt = buildSystemPrompt(engBackend, makeState());
    expect(prompt).toContain('## Build Verification Protocol');
    expect(prompt).toContain('npm run build');
    expect(prompt).toContain('BUILD VERIFICATION');
  });

  it('omits build verification for non-engineering roles', () => {
    const prodPrompt = buildSystemPrompt(product, makeState());
    const qaPrompt = buildSystemPrompt(qaAutomation, makeState());
    const coordPrompt = buildSystemPrompt(coordinator, makeState());
    expect(prodPrompt).not.toContain('## Build Verification Protocol');
    expect(qaPrompt).not.toContain('## Build Verification Protocol');
    expect(coordPrompt).not.toContain('## Build Verification Protocol');
  });

  it('appends artifact commit protocol when repos configured', () => {
    const state = makeState({
      repos: [mockRepo()],
    });
    const prompt = buildSystemPrompt(product, state);
    expect(prompt).toContain('Artifact Commit Protocol');
    expect(prompt).toContain('project repo is the source of truth');
  });

  it('omits artifact commit protocol for coordinator', () => {
    const state = makeState({
      repos: [mockRepo()],
    });
    const prompt = buildSystemPrompt(coordinator, state);
    expect(prompt).not.toContain('Artifact Commit Protocol');
  });

  it('omits artifact commit protocol when no repos', () => {
    const prompt = buildSystemPrompt(product, makeState());
    expect(prompt).not.toContain('Artifact Commit Protocol');
  });

  it('includes role-specific self-eval checks for engineering', () => {
    const prompt = buildSystemPrompt(engBackend, makeState());
    expect(prompt).toContain('All code compiles and tests pass');
    expect(prompt).toContain('No unused dependencies');
  });

  it('includes role-specific self-eval checks for QA', () => {
    const prompt = buildSystemPrompt(qaAutomation, makeState());
    expect(prompt).toContain('VERIFIED by running actual commands');
    expect(prompt).toContain('real installed API surface');
  });

  it('includes deploy target awareness for engineering with repos', () => {
    const state = makeState({
      repos: [mockRepo()],
    });
    const prompt = buildSystemPrompt(engBackend, state);
    expect(prompt).toContain('Deployment Target');
    expect(prompt).toContain('Never assume a deployment platform');
  });

  it('appends sprint section for coordinator when sprint is active', () => {
    const state = makeState({
      sprint: {
        sessionId: 'sess_123',
        cadence: 'weekly',
        nextStandup: '2026-04-08',
        backlog: [],
        currentSprint: 3,
      },
    });
    const prompt = buildSystemPrompt(coordinator, state);
    expect(prompt).toContain('Sprint Mode');
    expect(prompt).toContain('sprint 3');
  });

  it('omits sprint section when no active sprint', () => {
    const prompt = buildSystemPrompt(coordinator, makeState());
    expect(prompt).not.toContain('Sprint Mode');
  });

  it('injects Factory Production Standards for factory roles', () => {
    const prompt = buildSystemPrompt(engBackend, makeState());
    expect(prompt).toContain('# Factory Production Standards');
    expect(prompt).toContain('IaC by deploy_target');
    expect(prompt).toContain('Platform tenant contract');
    expect(prompt).toContain('k8s-native');
    expect(prompt).toContain('LLM policy');
    expect(prompt).toContain('Production bar');
    expect(prompt).toContain('Merge gate');
    expect(prompt).toContain('AWS CDK');
    expect(prompt).toContain('Claude is the primary LLM');
  });

  it('omits Factory Production Standards for firm roles', () => {
    const sales = TEAM.find((m) => m.role === 'sales')!;
    const prompt = buildSystemPrompt(sales, makeState());
    expect(prompt).not.toContain('# Factory Production Standards');
  });

  it('omits Factory Production Standards for lab roles', () => {
    const promptOpt = TEAM.find((m) => m.role === 'prompt-optimizer')!;
    const prompt = buildSystemPrompt(promptOpt, makeState());
    expect(prompt).not.toContain('# Factory Production Standards');
  });

  it('omits Factory Production Standards for coordinator', () => {
    const prompt = buildSystemPrompt(coordinator, makeState());
    expect(prompt).not.toContain('# Factory Production Standards');
  });
});
