import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveRuntimeKind } from '../src/runtimes/index.js';

describe('runtime kind resolution + auth posture', () => {
  const ORIG_RUNTIME = process.env.SPASTIC_RUNTIME;
  const ORIG_KEY = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.SPASTIC_RUNTIME;
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (ORIG_RUNTIME === undefined) {
      delete process.env.SPASTIC_RUNTIME;
    } else {
      process.env.SPASTIC_RUNTIME = ORIG_RUNTIME;
    }
    if (ORIG_KEY === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = ORIG_KEY;
    }
  });

  it('defaults to managed-agents and is unaffected by ANTHROPIC_API_KEY presence', () => {
    expect(resolveRuntimeKind()).toBe('managed-agents');
    process.env.ANTHROPIC_API_KEY = 'sk-fake';
    expect(resolveRuntimeKind()).toBe('managed-agents');
  });

  it('resolves to local when SPASTIC_RUNTIME=local even without API key', () => {
    process.env.SPASTIC_RUNTIME = 'local';
    expect(resolveRuntimeKind()).toBe('local');
  });

  it('resolves to claude-cli when SPASTIC_RUNTIME=claude-cli even without API key', () => {
    process.env.SPASTIC_RUNTIME = 'claude-cli';
    expect(resolveRuntimeKind()).toBe('claude-cli');
  });

  it('rejects unknown SPASTIC_RUNTIME values with a clear error', () => {
    process.env.SPASTIC_RUNTIME = 'not-a-runtime';
    expect(() => resolveRuntimeKind()).toThrow(/Unknown SPASTIC_RUNTIME/);
  });
});
