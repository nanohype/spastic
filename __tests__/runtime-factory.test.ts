import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createRuntime,
  resolveRuntimeKind,
  ClaudeCliRuntime,
  LocalRuntime,
  ManagedAgentsRuntime,
} from '../src/runtimes/index.js';

describe('runtime factory', () => {
  const ORIGINAL = process.env.SPASTIC_RUNTIME;

  beforeEach(() => {
    delete process.env.SPASTIC_RUNTIME;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.SPASTIC_RUNTIME;
    } else {
      process.env.SPASTIC_RUNTIME = ORIGINAL;
    }
  });

  it('defaults to managed-agents when SPASTIC_RUNTIME is unset', () => {
    expect(resolveRuntimeKind()).toBe('managed-agents');
  });

  it('honors SPASTIC_RUNTIME=local', () => {
    process.env.SPASTIC_RUNTIME = 'local';
    expect(resolveRuntimeKind()).toBe('local');
  });

  it('honors SPASTIC_RUNTIME=managed-agents explicitly', () => {
    process.env.SPASTIC_RUNTIME = 'managed-agents';
    expect(resolveRuntimeKind()).toBe('managed-agents');
  });

  it('honors SPASTIC_RUNTIME=claude-cli', () => {
    process.env.SPASTIC_RUNTIME = 'claude-cli';
    expect(resolveRuntimeKind()).toBe('claude-cli');
  });

  it('errors loudly on unknown SPASTIC_RUNTIME values', () => {
    process.env.SPASTIC_RUNTIME = 'something-else';
    expect(() => resolveRuntimeKind()).toThrow(/Unknown SPASTIC_RUNTIME/);
  });

  it('createRuntime returns a ManagedAgentsRuntime by default', () => {
    const stubApi = {} as unknown as Parameters<typeof createRuntime>[0];
    const rt = createRuntime(stubApi);
    expect(rt).toBeInstanceOf(ManagedAgentsRuntime);
  });

  it('createRuntime returns a LocalRuntime when configured', () => {
    process.env.SPASTIC_RUNTIME = 'local';
    const stubApi = {} as unknown as Parameters<typeof createRuntime>[0];
    const rt = createRuntime(stubApi);
    expect(rt).toBeInstanceOf(LocalRuntime);
  });

  it('createRuntime returns a ClaudeCliRuntime when configured', () => {
    process.env.SPASTIC_RUNTIME = 'claude-cli';
    const stubApi = {} as unknown as Parameters<typeof createRuntime>[0];
    const rt = createRuntime(stubApi);
    expect(rt).toBeInstanceOf(ClaudeCliRuntime);
  });
});
