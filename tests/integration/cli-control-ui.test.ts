import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

let childProcess: ChildProcessWithoutNullStreams | undefined;

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for condition');
}

afterEach(async () => {
  if (childProcess && childProcess.exitCode === null && !childProcess.killed) {
    childProcess.kill('SIGTERM');
    await new Promise((resolve) => childProcess?.once('exit', resolve));
  }
  childProcess = undefined;
});

describe('CLI control UI launch', () => {
  it('starts the control UI and opens the browser when no folder is provided', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'lan-file-cli-control-'));
    const openedUrlPath = path.join(tempDir, 'opened-url.txt');
    const openerPath = path.join(tempDir, 'opener.mjs');
    await writeFile(
      openerPath,
      `import { writeFile } from 'node:fs/promises';\nawait writeFile(${JSON.stringify(openedUrlPath)}, process.argv[2] ?? '', 'utf8');\n`,
    );

    let stdout = '';
    childProcess = spawn(process.execPath, ['node_modules/.bin/tsx', 'src/cli.ts', '--port', '0'], {
      cwd: path.resolve(import.meta.dirname, '../..'),
      env: {
        ...process.env,
        LAN_FILE_SERVER_BROWSER_COMMAND: `${process.execPath} ${openerPath}`,
      },
    });
    childProcess.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    await waitFor(async () => stdout.includes('Control UI: http://127.0.0.1:'));
    await waitFor(async () => {
      try {
        return (await readFile(openedUrlPath, 'utf8')).startsWith('http://127.0.0.1:');
      } catch {
        return false;
      }
    });

    const openedUrl = await readFile(openedUrlPath, 'utf8');
    expect(openedUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  }, 15_000);
});
