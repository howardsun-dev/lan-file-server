import compression from 'compression';
import express, { type Express } from 'express';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { lookup } from 'mime-types';
import { escapeHtml, formatBytes } from './html.js';
import { getLanAddresses } from './lan.js';
import { normalizeRoutePath, safeJoin } from './paths.js';

export interface ServerOptions {
  rootDir: string;
  host?: string;
  port?: number;
}

export interface RunningServer {
  url: string;
  port: number;
  host: string;
  rootDir: string;
  lanUrls: string[];
  close: () => Promise<void>;
}

interface DirectoryEntry {
  name: string;
  href: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: Date;
}

function joinUrl(base: string, child: string, isDirectory: boolean): string {
  const prefix = base === '' ? '' : `${base}/`;
  return `/${encodeURI(`${prefix}${child}`)}${isDirectory ? '/' : ''}`;
}

function parentHref(routePath: string): string | null {
  if (!routePath) return null;
  const parent = routePath.split('/').slice(0, -1).join('/');
  return parent ? `/${encodeURI(parent)}/` : '/';
}

function renderDirectory(rootDir: string, routePath: string, entries: DirectoryEntry[]): string {
  const title = routePath ? `/${routePath}` : '/';
  const parent = parentHref(routePath);
  const rows = entries
    .map((entry) => {
      const icon = entry.isDirectory ? '📁' : '📄';
      const displayName = `${entry.name}${entry.isDirectory ? '/' : ''}`;
      return `<a class="row" href="${escapeHtml(entry.href)}">
        <span class="icon" aria-hidden="true">${icon}</span>
        <span class="name">${escapeHtml(displayName)}</span>
        <span class="meta">${entry.isDirectory ? 'folder' : formatBytes(entry.size)}</span>
        <time class="meta" datetime="${entry.modifiedAt.toISOString()}">${entry.modifiedAt.toLocaleString()}</time>
      </a>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LAN File Server ${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; --bg: #0b0d10; --card: #11151b; --muted: #8b98a9; --line: #222a35; --text: #eef3f8; --accent: #78a8ff; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at top, #172033, var(--bg) 42rem); color: var(--text); }
    main { width: min(980px, calc(100vw - 32px)); margin: 48px auto; }
    .shell { background: color-mix(in oklab, var(--card) 92%, transparent); border: 1px solid var(--line); border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgb(0 0 0 / 35%); }
    header { padding: 28px 30px 22px; border-bottom: 1px solid var(--line); }
    h1 { margin: 0; font-size: clamp(26px, 4vw, 42px); letter-spacing: -0.04em; }
    .subtitle { margin: 8px 0 0; color: var(--muted); overflow-wrap: anywhere; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; padding: 18px 30px; border-bottom: 1px solid var(--line); }
    .pill { border: 1px solid var(--line); border-radius: 999px; color: var(--muted); padding: 8px 12px; text-decoration: none; background: rgb(255 255 255 / 3%); }
    a.pill:hover, .row:hover { border-color: color-mix(in oklab, var(--accent) 55%, var(--line)); color: var(--text); }
    .list { padding: 14px; }
    .row { display: grid; grid-template-columns: 34px 1fr minmax(80px, auto) minmax(150px, auto); gap: 14px; align-items: center; padding: 14px 16px; border: 1px solid transparent; border-radius: 16px; color: var(--text); text-decoration: none; }
    .name { font-weight: 650; overflow-wrap: anywhere; }
    .meta { color: var(--muted); font-size: 13px; white-space: nowrap; }
    .empty { color: var(--muted); padding: 26px 16px; text-align: center; }
    @media (max-width: 700px) { main { margin: 20px auto; } .row { grid-template-columns: 28px 1fr; } .row .meta { display: none; } header, .toolbar { padding-inline: 20px; } }
  </style>
</head>
<body>
  <main>
    <section class="shell">
      <header>
        <h1>LAN File Server</h1>
        <p class="subtitle">Serving <strong>${escapeHtml(rootDir)}</strong>${routePath ? ` · ${escapeHtml(title)}` : ''}</p>
      </header>
      <nav class="toolbar" aria-label="Directory navigation">
        ${parent ? `<a class="pill" href="${escapeHtml(parent)}">← Parent folder</a>` : '<span class="pill">Root folder</span>'}
        <span class="pill">${entries.length} item${entries.length === 1 ? '' : 's'}</span>
      </nav>
      <div class="list">
        ${rows || '<p class="empty">This folder is empty.</p>'}
      </div>
    </section>
  </main>
</body>
</html>`;
}

async function listDirectory(rootDir: string, routePath: string, absolutePath: string): Promise<string> {
  const dirents = await readdir(absolutePath, { withFileTypes: true });
  const entries = await Promise.all(
    dirents
      .filter((entry) => !entry.name.startsWith('.'))
      .map(async (entry) => {
        const entryPath = path.join(absolutePath, entry.name);
        const entryStat = await stat(entryPath);
        return {
          name: entry.name,
          href: joinUrl(routePath, entry.name, entry.isDirectory()),
          isDirectory: entry.isDirectory(),
          size: entryStat.size,
          modifiedAt: entryStat.mtime,
        } satisfies DirectoryEntry;
      }),
  );

  entries.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
  return renderDirectory(rootDir, routePath, entries);
}

export async function createApp(options: Pick<ServerOptions, 'rootDir'>): Promise<Express> {
  const rootDir = path.resolve(options.rootDir);
  const rootStat = await stat(rootDir);
  if (!rootStat.isDirectory()) {
    throw new Error(`Shared root is not a directory: ${rootDir}`);
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(compression());

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, rootDir });
  });

  app.get(/.*/, async (req, res, next) => {
    try {
      const routePath = normalizeRoutePath(req.path);
      const absolutePath = safeJoin(rootDir, routePath);
      const entryStat = await stat(absolutePath);

      if (entryStat.isDirectory()) {
        if (!req.path.endsWith('/')) {
          res.redirect(308, `${req.path}/`);
          return;
        }
        res.type('html').send(await listDirectory(rootDir, routePath, absolutePath));
        return;
      }

      res.type(lookup(absolutePath) || 'application/octet-stream');
      res.setHeader('Content-Length', entryStat.size);
      createReadStream(absolutePath).pipe(res);
    } catch (error) {
      if (error instanceof Error && error.message.includes('outside')) {
        res.status(400).send('Bad request');
        return;
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        res.status(404).send('Not found');
        return;
      }
      next(error);
    }
  });

  return app;
}

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const host = options.host ?? '0.0.0.0';
  const app = await createApp(options);
  const httpServer: Server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(options.port ?? 8080, host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine server address');
  }

  const localHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  const url = `http://${localHost}:${address.port}`;

  return {
    url,
    port: address.port,
    host,
    rootDir: path.resolve(options.rootDir),
    lanUrls: getLanAddresses(address.port),
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
