import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveInferenceBackend, resolveModelId, inferenceEnv } from '../src/inference.js';

describe('inference backend resolution', () => {
  const ORIGINAL = process.env.FAB_INFERENCE;

  beforeEach(() => {
    delete process.env.FAB_INFERENCE;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.FAB_INFERENCE;
    } else {
      process.env.FAB_INFERENCE = ORIGINAL;
    }
  });

  it('defaults to api when FAB_INFERENCE is unset', () => {
    expect(resolveInferenceBackend()).toBe('api');
  });

  it('honors FAB_INFERENCE=bedrock', () => {
    process.env.FAB_INFERENCE = 'bedrock';
    expect(resolveInferenceBackend()).toBe('bedrock');
  });

  it('honors FAB_INFERENCE=api explicitly', () => {
    process.env.FAB_INFERENCE = 'api';
    expect(resolveInferenceBackend()).toBe('api');
  });

  it('tolerates surrounding whitespace', () => {
    process.env.FAB_INFERENCE = '  bedrock  ';
    expect(resolveInferenceBackend()).toBe('bedrock');
  });

  it('errors loudly on unknown FAB_INFERENCE values', () => {
    process.env.FAB_INFERENCE = 'vertex';
    expect(() => resolveInferenceBackend()).toThrow(/Unknown FAB_INFERENCE/);
  });
});

describe('model id resolution', () => {
  it('passes canonical ids through unchanged for the api backend', () => {
    expect(resolveModelId('claude-sonnet-4-6', 'api')).toBe('claude-sonnet-4-6');
    expect(resolveModelId('claude-opus-4-6', 'api')).toBe('claude-opus-4-6');
  });

  it('maps canonical ids to Bedrock ids for the bedrock backend', () => {
    expect(resolveModelId('claude-sonnet-4-6', 'bedrock')).toBe('anthropic.claude-sonnet-4-6');
    expect(resolveModelId('claude-opus-4-7', 'bedrock')).toBe('anthropic.claude-opus-4-7');
    expect(resolveModelId('claude-opus-4-6', 'bedrock')).toBe('anthropic.claude-opus-4-6-v1');
    expect(resolveModelId('claude-haiku-4-5', 'bedrock')).toBe('anthropic.claude-haiku-4-5-20251001-v1:0');
  });

  it('passes an already-Bedrock id through unchanged on the bedrock backend', () => {
    expect(resolveModelId('anthropic.claude-opus-4-7', 'bedrock')).toBe('anthropic.claude-opus-4-7');
  });

  it('passes a cross-region inference-profile id through unchanged', () => {
    expect(resolveModelId('us.anthropic.claude-sonnet-4-6', 'bedrock')).toBe('us.anthropic.claude-sonnet-4-6');
    expect(resolveModelId('eu.anthropic.claude-opus-4-7', 'bedrock')).toBe('eu.anthropic.claude-opus-4-7');
  });

  it('fails fast on a model with no Bedrock mapping', () => {
    expect(() => resolveModelId('claude-sonnet-9-9', 'bedrock')).toThrow(/No AWS Bedrock model id/);
  });

  it('does not touch unmapped models on the api backend', () => {
    expect(resolveModelId('claude-sonnet-9-9', 'api')).toBe('claude-sonnet-9-9');
  });
});

describe('inference env overlay', () => {
  it('returns no overlay for the api backend', () => {
    expect(inferenceEnv('api')).toBeUndefined();
  });

  it('sets CLAUDE_CODE_USE_BEDROCK for the bedrock backend', () => {
    expect(inferenceEnv('bedrock')).toEqual({ CLAUDE_CODE_USE_BEDROCK: '1' });
  });
});
