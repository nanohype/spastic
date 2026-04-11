import { describe, it, expect } from 'vitest';
import { getWorkflow, listWorkflows } from '../src/workflows.js';

describe('workflows', () => {
  it('listWorkflows returns all 18 workflows', () => {
    const wfs = listWorkflows();
    expect(wfs).toHaveLength(18);
    const names = wfs.map((w) => w.name);
    expect(names).toContain('launch-prep');
    expect(names).toContain('feature-build');
    expect(names).toContain('incident');
    expect(names).toContain('customer-onboard');
    expect(names).toContain('market-push');
  });

  it('getWorkflow returns a workflow by name', () => {
    const wf = getWorkflow('feature-build');
    expect(wf).toBeDefined();
    expect(wf!.name).toBe('feature-build');
    expect(wf!.steps.length).toBeGreaterThanOrEqual(5);
  });

  it('getWorkflow returns undefined for unknown name', () => {
    expect(getWorkflow('nonexistent')).toBeUndefined();
  });

  it('launch-prep has specialist roles', () => {
    const wf = getWorkflow('launch-prep')!;
    const roles = wf.steps.map((s) => s.role);
    expect(roles).toContain('product');
    expect(roles).toContain('design');
    expect(roles).toContain('eng-frontend');
    expect(roles).toContain('eng-backend');
    expect(roles).toContain('eng-ai');
    expect(roles).toContain('qa-automation');
    expect(roles).toContain('qa-security');
    expect(roles).toContain('ops-sre');
    expect(roles).toContain('ops-incident');
    expect(roles).toContain('marketing');
    expect(roles).toContain('sales');
    expect(roles).toContain('customer-success');
    expect(roles).toContain('data-analyst');
    expect(roles).toContain('tech-writer');
  });

  it('launch-prep has multiple parallel groups', () => {
    const wf = getWorkflow('launch-prep')!;
    const groups = new Set(wf.steps.filter((s) => s.group != null).map((s) => s.group));
    expect(groups.size).toBeGreaterThanOrEqual(3);
  });

  it('feature-build has parallel engineering and QA groups', () => {
    const wf = getWorkflow('feature-build')!;
    const grouped = wf.steps.filter((s) => s.group != null);
    expect(grouped.length).toBeGreaterThanOrEqual(5);
  });

  it('feature-build includes remediation and verification steps', () => {
    const wf = getWorkflow('feature-build')!;
    const roles = wf.steps.map((s) => s.role);
    // eng-backend appears twice: once for implementation, once for remediation
    expect(roles.filter((r) => r === 'eng-backend')).toHaveLength(2);
    // qa-automation appears twice: once for testing, once for final verification
    expect(roles.filter((r) => r === 'qa-automation')).toHaveLength(2);
    // remediation step comes after QA
    const lastEngBackend = roles.lastIndexOf('eng-backend');
    const lastQaAuto = roles.lastIndexOf('qa-automation');
    expect(lastEngBackend).toBeLessThan(lastQaAuto);
  });

  it('incident uses ops-incident specialist', () => {
    const wf = getWorkflow('incident')!;
    const opsSteps = wf.steps.filter((s) => s.role === 'ops-incident');
    expect(opsSteps).toHaveLength(2);
  });

  it('code-producing workflows declare gateProfile "code"', () => {
    const codeWorkflows = [
      'feature-build',
      'launch-prep',
      'mobile-ship',
      'infra-setup',
      'security-audit',
      'perf-review',
      'incident',
      'automate',
    ];
    for (const name of codeWorkflows) {
      const wf = getWorkflow(name)!;
      expect(wf.gateProfile, `${name} should use code gate`).toBe('code');
    }
  });

  it('content-engine declares gateProfile "docs"', () => {
    const wf = getWorkflow('content-engine')!;
    expect(wf.gateProfile).toBe('docs');
  });

  it('non-code-producing workflows have no gateProfile', () => {
    const nonCodeWorkflows = ['sprint-plan', 'lead-gen', 'deal-close', 'customer-onboard', 'market-push'];
    for (const name of nonCodeWorkflows) {
      const wf = getWorkflow(name)!;
      expect(wf.gateProfile, `${name} should not have a merge gate`).toBeUndefined();
    }
  });
});
