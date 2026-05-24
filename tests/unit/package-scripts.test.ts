import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
}

async function readPackageJson(): Promise<PackageJson> {
  return JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as PackageJson;
}

describe('package CLI wiring', () => {
  it('runs the compiled CLI path produced by TypeScript', async () => {
    const packageJson = await readPackageJson();

    expect(packageJson.bin?.['lanshare']).toBe('dist/src/cli.js');
    expect(packageJson.scripts?.start).toBe('node dist/src/cli.js');
  });

  it('builds before npm start so fresh clones have a dist entrypoint', async () => {
    const packageJson = await readPackageJson();

    expect(packageJson.scripts?.prestart).toBe('npm run build');
  });
});
