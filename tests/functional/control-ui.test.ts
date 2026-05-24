import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startControlServer, type ControlRunningServer } from '../../src/control.js';

let root: string;
let child: string;
let browser: Browser;
let control: ControlRunningServer;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lan-file-control-functional-'));
  child = path.join(root, 'share-me');
  await mkdir(child);
  await writeFile(path.join(child, 'browser.txt'), 'browser controlled file');
  control = await startControlServer({ host: '127.0.0.1', port: 0 });
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
  await control?.close();
});

describe('control UI browser flow', () => {
  it('browses to a directory, starts serving, and stops serving', async () => {
    const page = await browser.newPage();
    await page.goto(control.url);

    await expect(page.getByRole('heading', { name: 'Serve a Folder' }).isVisible()).resolves.toBe(true);

    await page.getByLabel('Folder path').fill(root);
    await page.getByLabel('Port').fill('0');
    await page.getByLabel('Host').fill('127.0.0.1');
    await page.getByRole('button', { name: 'Browse folders' }).click();
    await page.getByRole('button', { name: 'share-me' }).click();
    await expect.poll(() => page.getByLabel('Folder path').inputValue()).toBe(child);

    await page.getByRole('button', { name: 'Start server' }).click();
    await expect.poll(() => page.getByText(/Server running/).isVisible()).toBe(true);

    const servedUrl = await page.getByTestId('served-url').textContent();
    expect(servedUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const servedResponse = await page.goto(`${servedUrl}/browser.txt`);
    expect(await servedResponse?.text()).toBe('browser controlled file');

    await page.goto(control.url);
    await page.getByRole('button', { name: 'Stop server' }).click();
    await expect.poll(() => page.locator('#message').textContent()).toBe('Server stopped.');
    await page.close();
  });
});
