import compression from 'compression';
import express, { type Express } from 'express';
import { readdir, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startServer, type RunningServer } from './server.js';

export interface ControlState {
  sharedServer: RunningServer | null;
}

export interface ControlAppOptions {
  state?: ControlState;
}

export interface ControlServerOptions {
  host?: string;
  port?: number;
}

export interface ControlRunningServer {
  url: string;
  port: number;
  host: string;
  state: ControlState;
  close: () => Promise<void>;
}

interface BrowseEntry {
  name: string;
  path: string;
}

interface StartPayload {
  rootDir?: unknown;
  host?: unknown;
  port?: unknown;
}

const defaultState = (): ControlState => ({ sharedServer: null });

function normalizePort(value: unknown): number {
  if (value === undefined || value === null || value === '') return 8080;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Port must be an integer from 0 to 65535');
  }
  return port;
}

function normalizeHost(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '0.0.0.0';
}

async function assertDirectory(rootDir: string): Promise<string> {
  const resolved = path.resolve(rootDir);
  const info = await stat(resolved);
  if (!info.isDirectory()) {
    throw new Error(`Selected path is not a directory: ${resolved}`);
  }
  return resolved;
}

async function browseDirectories(inputPath: string): Promise<{ currentPath: string; parentPath: string | null; directories: BrowseEntry[] }> {
  const currentPath = await assertDirectory(inputPath || os.homedir());
  const dirents = await readdir(currentPath, { withFileTypes: true });
  const directories = dirents
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => ({ name: entry.name, path: path.join(currentPath, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const parent = path.dirname(currentPath);

  return {
    currentPath,
    parentPath: parent === currentPath ? null : parent,
    directories,
  };
}

function statusPayload(state: ControlState): Record<string, unknown> {
  const server = state.sharedServer;
  return {
    running: Boolean(server),
    rootDir: server?.rootDir ?? null,
    url: server?.url ?? null,
    lanUrls: server?.lanUrls ?? [],
    port: server?.port ?? null,
    host: server?.host ?? null,
  };
}

function renderControlUi(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LAN File Server Control</title>
  <style>
    :root { color-scheme: dark; --bg: #090b0f; --panel: #111722; --panel-2: #151d2b; --line: #263244; --text: #edf4ff; --muted: #8e9caf; --accent: #7bb2ff; --good: #7ef0b2; --bad: #ff8a9a; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--text); background: radial-gradient(circle at top left, #1b2a45, transparent 34rem), var(--bg); }
    main { width: min(1080px, calc(100vw - 32px)); margin: 42px auto; }
    .shell { display: grid; grid-template-columns: 1fr 360px; gap: 18px; }
    .card { background: color-mix(in oklab, var(--panel) 92%, transparent); border: 1px solid var(--line); border-radius: 24px; box-shadow: 0 24px 80px rgb(0 0 0 / 32%); overflow: hidden; }
    header { padding: 30px; border-bottom: 1px solid var(--line); }
    h1 { margin: 0; font-size: clamp(30px, 4vw, 48px); letter-spacing: -0.05em; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    p { margin: 8px 0 0; color: var(--muted); }
    .body { padding: 22px; }
    label { display: block; color: var(--muted); font-size: 13px; margin-bottom: 8px; }
    input { width: 100%; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); border-radius: 14px; padding: 13px 14px; font: inherit; outline: none; }
    input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgb(123 178 255 / 16%); }
    .grid { display: grid; grid-template-columns: 1fr 120px 110px; gap: 12px; align-items: end; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    button, .button { border: 1px solid var(--line); background: var(--panel-2); color: var(--text); border-radius: 14px; padding: 12px 14px; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; }
    button.primary { background: linear-gradient(135deg, #579cff, #8c6dff); border-color: transparent; }
    button.danger { color: var(--bad); }
    button:hover, .button:hover { transform: translateY(-1px); border-color: var(--accent); }
    button:disabled { opacity: .48; cursor: not-allowed; transform: none; }
    .browser { margin-top: 18px; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; }
    .browser-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 13px 14px; background: rgb(255 255 255 / 3%); color: var(--muted); overflow-wrap: anywhere; }
    .list { max-height: 420px; overflow: auto; padding: 8px; }
    .dir { width: 100%; display: grid; grid-template-columns: 28px 1fr; gap: 10px; align-items: center; text-align: left; margin: 4px 0; border-color: transparent; }
    .status { display: grid; gap: 12px; }
    .pill { display: inline-flex; width: fit-content; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 999px; padding: 8px 12px; color: var(--muted); }
    .dot { width: 9px; height: 9px; border-radius: 999px; background: var(--bad); box-shadow: 0 0 18px currentColor; }
    .running .dot { background: var(--good); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
    .toast { min-height: 24px; color: var(--muted); margin-top: 14px; }
    .toast.error { color: var(--bad); }
    @media (max-width: 860px) { .shell { grid-template-columns: 1fr; } .grid { grid-template-columns: 1fr; } main { margin: 20px auto; } }
  </style>
</head>
<body>
  <main>
    <div class="shell">
      <section class="card">
        <header>
          <h1>Serve a Folder</h1>
          <p>Browse this machine's directories, pick one, then start or stop the LAN file server without touching the terminal.</p>
        </header>
        <div class="body">
          <div class="grid">
            <div>
              <label for="folderPath">Folder path</label>
              <input id="folderPath" name="folderPath" aria-label="Folder path" autocomplete="off" />
            </div>
            <div>
              <label for="port">Port</label>
              <input id="port" name="port" aria-label="Port" value="8080" inputmode="numeric" />
            </div>
            <div>
              <label for="host">Host</label>
              <input id="host" name="host" aria-label="Host" value="0.0.0.0" />
            </div>
          </div>
          <div class="actions">
            <button id="browse" type="button">Browse folders</button>
            <button id="start" class="primary" type="button">Start server</button>
            <button id="stop" class="danger" type="button">Stop server</button>
          </div>
          <div class="browser" aria-label="Directory browser">
            <div class="browser-head">
              <span id="currentPath" class="mono">No folder loaded</span>
              <button id="parent" type="button">Parent</button>
            </div>
            <div id="directoryList" class="list"></div>
          </div>
          <div id="message" class="toast" role="status"></div>
        </div>
      </section>
      <aside class="card">
        <div class="body status" id="statusPanel">
          <span id="statusPill" class="pill"><span class="dot"></span><span id="statusText">Server stopped.</span></span>
          <div>
            <h2>Served URL</h2>
            <p id="servedUrl" data-testid="served-url" class="mono">Not running</p>
          </div>
          <div>
            <h2>LAN URLs</h2>
            <p id="lanUrls" class="mono">Start the server to see LAN addresses.</p>
          </div>
          <div>
            <h2>Shared folder</h2>
            <p id="sharedRoot" class="mono">None</p>
          </div>
        </div>
      </aside>
    </div>
  </main>
<script>
const folderPath = document.querySelector('#folderPath');
const port = document.querySelector('#port');
const host = document.querySelector('#host');
const message = document.querySelector('#message');
const currentPath = document.querySelector('#currentPath');
const directoryList = document.querySelector('#directoryList');
const parentButton = document.querySelector('#parent');
const statusPanel = document.querySelector('#statusPanel');
const statusPill = document.querySelector('#statusPill');
const statusText = document.querySelector('#statusText');
const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const servedUrl = document.querySelector('#servedUrl');
const lanUrls = document.querySelector('#lanUrls');
const sharedRoot = document.querySelector('#sharedRoot');
let parentPath = null;

function setMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

function renderStatus(status) {
  statusPanel.classList.toggle('running', status.running);
  statusPill.classList.toggle('running', status.running);
  statusText.textContent = status.running ? 'Server running' : 'Server stopped.';
  startButton.disabled = status.running;
  stopButton.disabled = !status.running;
  servedUrl.textContent = status.url || 'Not running';
  sharedRoot.textContent = status.rootDir || 'None';
  lanUrls.innerHTML = status.lanUrls?.length ? status.lanUrls.map((url) => '<a class="button mono" href="' + url + '" target="_blank" rel="noreferrer">' + url + '</a>').join(' ') : 'Start the server to see LAN addresses.';
}

function renderDirectories(payload) {
  currentPath.textContent = payload.currentPath;
  folderPath.value = payload.currentPath;
  parentPath = payload.parentPath;
  parentButton.disabled = !parentPath;
  directoryList.innerHTML = payload.directories.length ? '' : '<p>No child folders.</p>';
  for (const dir of payload.directories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dir';
    button.innerHTML = '<span aria-hidden="true">📁</span><span>' + dir.name + '</span>';
    button.addEventListener('click', () => browse(dir.path));
    directoryList.append(button);
  }
}

async function browse(path = folderPath.value) {
  try {
    const payload = await api('/api/browse?path=' + encodeURIComponent(path || ''));
    renderDirectories(payload);
    setMessage('');
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function refreshStatus() {
  renderStatus(await api('/api/server/status'));
}

document.querySelector('#browse').addEventListener('click', () => browse());
parentButton.addEventListener('click', () => parentPath && browse(parentPath));
document.querySelector('#start').addEventListener('click', async () => {
  try {
    const status = await api('/api/server/start', { method: 'POST', body: JSON.stringify({ rootDir: folderPath.value, host: host.value, port: port.value }) });
    renderStatus(status);
    setMessage('Serving started.');
  } catch (error) {
    setMessage(error.message, true);
  }
});
document.querySelector('#stop').addEventListener('click', async () => {
  try {
    const status = await api('/api/server/stop', { method: 'POST', body: '{}' });
    renderStatus(status);
    setMessage('Server stopped.');
  } catch (error) {
    setMessage(error.message, true);
  }
});

refreshStatus().catch((error) => setMessage(error.message, true));
browse().catch(() => undefined);
</script>
</body>
</html>`;
}

export function createControlApp(options: ControlAppOptions = {}): Express {
  const state = options.state ?? defaultState();
  const app = express();
  app.disable('x-powered-by');
  app.use(compression());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.type('html').send(renderControlUi());
  });

  app.get('/api/browse', async (req, res) => {
    try {
      const requestedPath = typeof req.query.path === 'string' && req.query.path ? req.query.path : os.homedir();
      res.json(await browseDirectories(requestedPath));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to browse directory' });
    }
  });

  app.get('/api/server/status', (_req, res) => {
    res.json(statusPayload(state));
  });

  app.post('/api/server/start', async (req, res) => {
    try {
      const body = req.body as StartPayload;
      if (typeof body.rootDir !== 'string' || !body.rootDir.trim()) {
        res.status(400).json({ error: 'rootDir must be a directory path' });
        return;
      }
      const rootDir = await assertDirectory(body.rootDir);
      await state.sharedServer?.close();
      state.sharedServer = await startServer({ rootDir, host: normalizeHost(body.host), port: normalizePort(body.port) });
      res.json(statusPayload(state));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to start server' });
    }
  });

  app.post('/api/server/stop', async (_req, res) => {
    await state.sharedServer?.close();
    state.sharedServer = null;
    res.json(statusPayload(state));
  });

  return app;
}

export async function startControlServer(options: ControlServerOptions = {}): Promise<ControlRunningServer> {
  const host = options.host ?? '127.0.0.1';
  const state = defaultState();
  const app = createControlApp({ state });
  const httpServer: Server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(options.port ?? 7070, host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine control server address');
  }

  return {
    url: `http://${host}:${address.port}`,
    port: address.port,
    host,
    state,
    close: async () => {
      await state.sharedServer?.close();
      state.sharedServer = null;
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
