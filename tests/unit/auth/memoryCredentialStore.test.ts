import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { MemoryCredentialStore } from '@/auth/credentialSession.js';

describe('MemoryCredentialStore', () => {
  it('accepts token updates without touching the filesystem', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ebay-mcp-mem-'));
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      await Effect.runPromise(
        new MemoryCredentialStore().write({ EBAY_USER_ACCESS_TOKEN: 'v^1.1#token' }),
      );
      expect(existsSync(join(dir, '.env'))).toBe(false);
    } finally {
      process.chdir(cwd);
    }
  });
});
