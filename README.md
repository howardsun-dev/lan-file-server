# LAN File Server

A tiny TypeScript HTTP server for sharing any local folder across your LAN. Point it at a directory, open the printed LAN URL from another device, and browse/download files through a polished minimalist web UI.

## What it does

- Serves files from a folder you choose
- Renders a clean responsive directory browser
- Works on your local network by binding to `0.0.0.0` by default
- Blocks path traversal attempts so requests cannot escape the shared root
- Streams file bytes directly with correct content types and lengths
- Provides `/healthz` for simple uptime checks
- Ships with unit, integration, and browser-level functional tests

## Why this exists

Sometimes you just need to move a file from one machine to another without setting up SMB, Syncthing, cloud storage, or a full web server. This is intentionally small: one command, one folder, one LAN URL.

## Quick start

```bash
git clone https://github.com/howardsun-dev/lan-file-server.git
cd lan-file-server
npm install
npm run build
npm start -- ~/Downloads --port 8080
```

Then open the printed LAN URL from another device on the same network, for example:

```text
http://192.168.1.42:8080
```

## Development mode

```bash
npm install
npm run dev -- /path/to/share --port 8080
```

If you omit the folder, the server shares the current working directory.

## CLI

```bash
lan-file-server <folder> [--host 0.0.0.0] [--port 8080]
```

Examples:

```bash
lan-file-server ~/Downloads
lan-file-server /srv/share --port 3000
lan-file-server ~/Pictures --host 127.0.0.1 --port 9000
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `<folder>` | current directory | Folder to expose over HTTP |
| `--host` | `0.0.0.0` | Bind address. Use `127.0.0.1` for local-only access. |
| `--port` | `8080` | HTTP port. Use `0` to pick a random free port in tests or embedded use. |

## Security notes

This is a convenience LAN file server, not an internet-facing hardened gateway.

- It has no authentication.
- Anyone who can reach the bound host/port can read the shared files.
- It does not allow writes, deletes, uploads, or directory traversal outside the shared root.
- Prefer trusted networks. Do not port-forward it to the public internet.

## Test coverage

The project intentionally tests three layers:

```bash
npm run test:unit          # path normalization and traversal protection helpers
npm run test:integration   # Express app behavior with real temp files
npm run test:functional    # browser flow against a running server
npm test                   # all tests
npm run check              # lint + tests + TypeScript build
```

Current coverage areas:

- Safe path joins reject traversal
- Directory pages render the minimalist UI
- Nested directories are browsable
- File downloads return correct bytes/content type
- Browser can load the UI and open a listed file

## API surface for embedding

You can import the server from TypeScript/Node code:

```ts
import { startServer } from 'lan-file-server';

const server = await startServer({
  rootDir: '/path/to/share',
  host: '0.0.0.0',
  port: 8080,
});

console.log(server.url);
console.log(server.lanUrls);

await server.close();
```

## Project structure

```text
src/
  cli.ts       CLI entrypoint
  server.ts    Express app, file streaming, directory UI
  paths.ts     route normalization and traversal protection
  html.ts      HTML escaping and byte formatting helpers
  lan.ts       LAN address discovery
tests/
  unit/         pure helper tests
  integration/  HTTP behavior tests via supertest
  functional/   browser flow tests via Playwright
```

## License

MIT
