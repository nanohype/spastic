import { describe, it, expect } from 'vitest';
import { ADVISOR_ROLES, hasAdvisorAccess, ADVISOR_TOOL } from '../src/advisor.js';
import { TEAM } from '../src/team.js';
import type { TeamRole } from '../src/types.js';

describe('advisor access control', () => {
  it('has exactly 9 roles with advisor access: coordinator + 8 leads', () => {
    expect(ADVISOR_ROLES.size).toBe(9);
    expect(ADVISOR_ROLES.has('coordinator')).toBe(true);
    expect(ADVISOR_ROLES.has('product')).toBe(true);
    expect(ADVISOR_ROLES.has('design')).toBe(true);
    expect(ADVISOR_ROLES.has('engineering')).toBe(true);
    expect(ADVISOR_ROLES.has('qa')).toBe(true);
    expect(ADVISOR_ROLES.has('sales')).toBe(true);
    expect(ADVISOR_ROLES.has('marketing')).toBe(true);
    expect(ADVISOR_ROLES.has('operations')).toBe(true);
    expect(ADVISOR_ROLES.has('customer-success')).toBe(true);
  });

  it('excludes all specialist roles from advisor access', () => {
    const specialists: TeamRole[] = [
      'eng-frontend',
      'eng-backend',
      'eng-ai',
      'eng-infra',
      'eng-perf',
      'eng-devex',
      'eng-mobile',
      'qa-automation',
      'qa-security',
      'qa-data',
      'qa-ux',
      'sales-solutions',
      'sales-ops',
      'marketing-content',
      'marketing-seo',
      'marketing-email',
      'ops-sre',
      'ops-incident',
      'ops-finops',
      'ops-compliance',
      'ops-automation',
      'cs-support',
      'cs-renewals',
      'design-ux',
      'design-accessibility',
      'ux-writer',
      'product-research',
      'product-growth',
      'lead-inbound',
      'lead-outbound',
      'lead-research',
      'brand-strategist',
      'legal',
      'data-analyst',
      'tech-writer',
      'chief-of-staff',
      'prompt-optimizer',
      'session-analyst',
      'cross-project-learner',
      'template-quality',
    ];
    for (const role of specialists) {
      expect(hasAdvisorAccess(role)).toBe(false);
    }
  });

  it('every role with advisor access exists in TEAM', () => {
    const teamRoles = new Set(TEAM.map((m) => m.role));
    for (const role of ADVISOR_ROLES) {
      expect(teamRoles.has(role)).toBe(true);
    }
  });

  it('advisor tool definition matches contract', () => {
    expect(ADVISOR_TOOL.type).toBe('custom');
    expect(ADVISOR_TOOL.name).toBe('consult_advisor');
    expect(ADVISOR_TOOL.input_schema.required).toContain('question');
    expect(ADVISOR_TOOL.input_schema.required).toContain('context');
    // description should discourage casual use
    expect(ADVISOR_TOOL.description.toLowerCase()).toMatch(/last resort|irreversible|expensive/);
  });
});
