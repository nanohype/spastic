import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { loadState, saveState, clearState } from '../src/state.js';
import type { SpasticState } from '../src/types.js';

const STATE_FILE = join(process.cwd(), '.spastic-state.json');

async function cleanup() {
  try {
    await unlink(STATE_FILE);
  } catch {
    /* ignore */
  }
}

describe('state', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('loadState returns defaults when no file exists', async () => {
    const state = await loadState();
    expect(state.agents).toEqual([]);
    expect(state.coordinatorId).toBeNull();
    expect(state.skillIds).toEqual({});
    expect(state.environmentId).toBeNull();
    expect(state.memory.enabled).toBe(true);
    expect(state.journal.enabled).toBe(true);
    expect(state.repos).toEqual([]);
    expect(state.modelOverrides).toEqual({});
    expect(state.sprint).toBeNull();
  });

  it('saveState + loadState roundtrip preserves all fields', async () => {
    const state: SpasticState = {
      agents: [{ role: 'product', agentId: 'agent_123', version: 1, deployedAt: '2026-04-08' }],
      coordinatorId: 'agent_coord',
      skillIds: { product: 'skill_456' },
      environmentId: 'env_789',
      memory: { enabled: false, path: '/custom/memory.md' },
      journal: { enabled: true, basePath: '/workspace/.spastic/journal' },
      repos: [{ type: 'github_repository', url: 'https://github.com/test/repo', mount_path: '/workspace/repo' }],
      modelOverrides: { engineering: 'claude-opus-4-6' },
      sprint: null,
    };

    await saveState(state);
    const loaded = await loadState();

    expect(loaded.agents).toHaveLength(1);
    expect(loaded.agents[0].agentId).toBe('agent_123');
    expect(loaded.coordinatorId).toBe('agent_coord');
    expect(loaded.skillIds.product).toBe('skill_456');
    expect(loaded.environmentId).toBe('env_789');
    expect(loaded.memory.enabled).toBe(false);
    expect(loaded.memory.path).toBe('/custom/memory.md');
    expect(loaded.repos).toHaveLength(1);
    expect(loaded.modelOverrides.engineering).toBe('claude-opus-4-6');
  });

  it('clearState resets to defaults', async () => {
    await saveState({
      agents: [{ role: 'qa', agentId: 'agent_x', version: 2, deployedAt: '2026-04-08' }],
      coordinatorId: 'agent_x',
      skillIds: { qa: 'skill_y' },
      environmentId: 'env_z',
      memory: { enabled: true, path: '/workspace/.spastic/memory.md' },
      journal: { enabled: true, basePath: '/workspace/.spastic/journal' },
      repos: [],
      modelOverrides: {},
      sprint: null,
    });

    await clearState();
    const state = await loadState();

    expect(state.agents).toEqual([]);
    expect(state.coordinatorId).toBeNull();
  });

  it('loadState merges defaults for missing fields (backwards compat)', async () => {
    // Simulate an old state file missing new fields
    const partial = JSON.stringify({ agents: [], coordinatorId: null, skillIds: {} });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(STATE_FILE, partial, 'utf-8');

    const state = await loadState();
    expect(state.memory.enabled).toBe(true);
    expect(state.journal.enabled).toBe(true);
    expect(state.repos).toEqual([]);
    expect(state.sprint).toBeNull();
  });

  it('state file is valid JSON', async () => {
    await saveState({
      agents: [],
      coordinatorId: null,
      skillIds: {},
      environmentId: null,
      memory: { enabled: true, path: '/workspace/.spastic/memory.md' },
      journal: { enabled: true, basePath: '/workspace/.spastic/journal' },
      repos: [],
      modelOverrides: {},
      sprint: null,
    });

    const raw = await readFile(STATE_FILE, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
