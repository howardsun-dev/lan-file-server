import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type RunningServer } from '../../src/server.js';

let root: string;
let server: RunningServer;
let browser: Browser;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lan-file-server-functional-'));
  await writeFile(path.join(root, 'photo.txt'), 'pretend image metadata');
  server = await startServer({ rootDir: root, host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe('browser functional flow', () => {
  it('loads the polished UI and downloads a listed file', async () => {
    const page = await browser.newPage();
    await page.goto(server.url);

    await expect(page.getByRole('heading', { name: 'LAN File Server' }).isVisible()).resolves.toBe(true);
    await expect(page.getByText(root).isVisible()).resolves.toBe(true);
    await expect(page.getByRole('link', { name: /photo\.txt/ }).isVisible()).resolves.toBe(true);

    const fileResponse = await page.goto(`${server.url}/photo.txt`);
    expect(await fileResponse?.text()).toBe('pretend image metadata');
    await page.close();
  });
});
