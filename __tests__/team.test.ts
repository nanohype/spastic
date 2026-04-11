import { describe, it, expect } from 'vitest';
import { TEAM } from '../src/team.js';

describe('TEAM structure', () => {
  it('has exactly 65 agents (coordinator + 30 factory + 29 firm + 5 lab)', () => {
    expect(TEAM).toHaveLength(65);
    const coord = TEAM.filter((m) => m.role === 'coordinator');
    expect(coord).toHaveLength(1);
  });

  it('coordinator has no group field; every other agent has one', () => {
    for (const m of TEAM) {
      if (m.role === 'coordinator') {
        expect(m.group).toBeUndefined();
      } else {
        expect(m.group).toBeDefined();
        expect(['factory', 'firm', 'lab']).toContain(m.group);
      }
    }
  });

  it('group distribution: 30 factory, 29 firm, 5 lab', () => {
    const counts = { factory: 0, firm: 0, lab: 0 };
    for (const m of TEAM) {
      if (m.group) counts[m.group]++;
    }
    expect(counts).toEqual({ factory: 30, firm: 29, lab: 5 });
  });

  it('every agent includes memory in mcpServers', () => {
    for (const m of TEAM) {
      expect(m.mcpServers).toContain('memory');
    }
  });

  it('all roles are unique', () => {
    const roles = TEAM.map((m) => m.role);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it('every agent has a non-empty system prompt', () => {
    for (const m of TEAM) {
      expect(m.system.length).toBeGreaterThan(100);
    }
  });
});
