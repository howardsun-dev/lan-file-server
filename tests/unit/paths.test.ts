import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { safeJoin, normalizeRoutePath } from '../../src/paths.js';

describe('path safety helpers', () => {
  it('normalizes root and nested route paths', () => {
    expect(normalizeRoutePath('/')).toBe('');
    expect(normalizeRoutePath('/docs/readme.txt')).toBe('docs/readme.txt');
    expect(normalizeRoutePath('/docs%20space/file.txt')).toBe('docs space/file.txt');
  });

  it('rejects traversal outside of the shared root', () => {
    const root = path.resolve('/tmp/share');
    expect(() => safeJoin(root, '../secret.txt')).toThrow(/outside/i);
    expect(() => safeJoin(root, 'nested/../../secret.txt')).toThrow(/outside/i);
  });

  it('allows files inside the shared root', () => {
    const root = path.resolve('/tmp/share');
    expect(safeJoin(root, 'nested/file.txt')).toBe(path.join(root, 'nested/file.txt'));
  });
});
