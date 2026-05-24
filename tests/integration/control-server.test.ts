import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createControlApp, type ControlState } from '../../src/control.js';

let root: string;
let child: string;
let state: ControlState;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lan-file-control-'));
  child = path.join(root, 'share-me');
  await mkdir(child);
  await writeFile(path.join(child, 'hello.txt'), 'hello from controlled server');
  state = { sharedServer: null };
});

afterEach(async () => {
  await state.sharedServer?.close();
  state.sharedServer = null;
});

describe('control UI server', () => {
  it('renders a directory picker UI with start and stop controls', async () => {
    const app = createControlApp({ state });

    const response = await request(app).get('/').expect(200).expect('Content-Type', /html/);

    expect(response.text).toContain('Serve a Folder');
    expect(response.text).not.toContain('Browse folders');
    expect(response.text).toContain('Start server');
    expect(response.text).toContain('Stop server');
  });

  it('lists child directories for server-side browsing', async () => {
    const app = createControlApp({ state });

    const response = await request(app).get('/api/browse').query({ path: root }).expect(200);

    expect(response.body.currentPath).toBe(root);
    expect(response.body.parentPath).toBe(path.dirname(root));
    expect(response.body.directories).toEqual([{ name: 'share-me', path: child }]);
  });

  it('starts a LAN file server for the selected directory and stops it', async () => {
    const app = createControlApp({ state });

    const start = await request(app)
      .post('/api/server/start')
      .send({ rootDir: child, host: '127.0.0.1', port: 0 })
      .expect(200);

    expect(start.body.running).toBe(true);
    expect(start.body.rootDir).toBe(child);
    expect(start.body.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    await request(start.body.url).get('/hello.txt').expect(200, 'hello from controlled server');

    const stop = await request(app).post('/api/server/stop').expect(200);
    expect(stop.body.running).toBe(false);
    expect(state.sharedServer).toBeNull();
  });

  it('rejects attempts to start with a non-directory path', async () => {
    const app = createControlApp({ state });
    const filePath = path.join(child, 'hello.txt');

    const response = await request(app).post('/api/server/start').send({ rootDir: filePath }).expect(400);

    expect(response.body.error).toContain('directory');
    expect(state.sharedServer).toBeNull();
  });
});
