import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lanshare-'));
  await writeFile(path.join(root, 'hello.txt'), 'hello lan');
  await mkdir(path.join(root, 'docs'));
  await writeFile(path.join(root, 'docs', 'guide.md'), '# Guide');
});

afterEach(() => {
  root = '';
});

describe('HTTP file server', () => {
  it('renders a minimalist directory UI with file links', async () => {
    const app = await createApp({ rootDir: root });

    const response = await request(app).get('/').expect(200).expect('Content-Type', /html/);

    expect(response.text).toContain('LANShare');
    expect(response.text).toContain('hello.txt');
    expect(response.text).toContain('docs/');
    expect(response.text).toContain('class="shell"');
  });

  it('serves file bytes with the correct content type', async () => {
    const app = await createApp({ rootDir: root });

    const response = await request(app).get('/hello.txt').expect(200).expect('Content-Type', /text\/plain/);

    expect(response.text).toBe('hello lan');
  });

  it('renders nested directories', async () => {
    const app = await createApp({ rootDir: root });

    const response = await request(app).get('/docs/').expect(200).expect('Content-Type', /html/);

    expect(response.text).toContain('guide.md');
    expect(response.text).toContain('href="/docs/guide.md"');
  });

  it('blocks traversal attempts', async () => {
    const app = await createApp({ rootDir: root });

    await request(app).get('/..%2F..%2Fetc%2Fpasswd').expect(400);
  });
});
