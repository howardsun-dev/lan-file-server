# LANShare

LANShare is a tiny TypeScript app for sharing any local folder across your LAN. Use the local control UI to browse to a directory and start/stop serving, or pass a folder directly from the CLI.

## What it does

- Provides a local control UI for browsing this machine's folders
- Starts and stops LANShare from the browser
- Serves files from the folder you choose
- Renders a clean responsive directory browser for downloading files
- Works on your local network by binding the file server to `0.0.0.0` by default
- Blocks path traversal attempts so requests cannot escape the shared root
- Streams file bytes directly with correct content types and lengths
- Provides `/healthz` for simple uptime checks
- Ships with unit, integration, and browser-level functional tests

## Why this exists

Sometimes you just need to move a file from one machine to another without setting up SMB, Syncthing, cloud storage, or a full web server. This is intentionally small: one control UI, one folder, one LAN URL.

## Quick start: control UI

```bash
git clone https://github.com/howardsun-dev/LANShare.git
cd LANShare
npm install
npm start
```

`npm start` automatically builds first. With no folder argument, it starts the local control UI and opens it in your default browser:

```text
http://127.0.0.1:7070
```

From there you can:

1. Browse this machine's folders.
2. Pick the folder you want to share.
3. Click **Start server**.
4. Open the printed/visible LAN URL from another device.
5. Click **Stop server** when done.

The control UI binds to localhost by default so random LAN devices cannot control what you share. The file server it starts still binds to `0.0.0.0` by default so other LAN devices can download files.

## Direct CLI mode

If you already know the folder path, pass it directly:

```bash
npm start -- ~/Downloads --port 8080
```

The `--` is required: it tells npm to pass the folder and `--port` through to the app instead of parsing them as npm options.

On Windows PowerShell:

```powershell
npm start -- "C:\Users\alex\Downloads" --port 8080
```

Then open the printed LAN URL from another device on the same network, for example:

```text
http://192.168.1.42:8080
```

## Development mode

Control UI:

```bash
npm install
npm run dev
```

Direct folder serving:

```bash
npm run dev -- /path/to/share --port 8080
```

For Windows paths, quote the folder if it contains backslashes, spaces, or shell-sensitive characters:

```powershell
npm run dev -- "C:\Users\alex\Downloads" --port 8080
```

## CLI

```bash
lan-file-server                 # Start the local control UI and open it in your browser
lan-file-server --ui            # Start the local control UI and open it in your browser
lan-file-server <folder>        # Serve a folder immediately
lan-file-server <folder> [--host 0.0.0.0] [--port 8080]
```

Examples:

```bash
lan-file-server
lan-file-server --ui --port 7070
lan-file-server ~/Downloads
lan-file-server /srv/share --port 3000
lan-file-server ~/Pictures --host 127.0.0.1 --port 9000
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `<folder>` | none | Folder to expose immediately. Omit it to start the control UI and open it in your browser. |
| `--ui` | off | Start the control UI instead of immediately serving a folder. |
| `--host` | UI: `127.0.0.1`, direct: `0.0.0.0` | Bind address. Use `127.0.0.1` for local-only access. |
| `--port` | UI: `7070`, direct: `8080` | HTTP port. Use `0` to pick a random free port in tests or embedded use. |

## Security notes

This is a convenience LAN file server, not an internet-facing hardened gateway.

- It has no authentication.
- Anyone who can reach the file server host/port can read the shared files.
- The control UI defaults to `127.0.0.1`; keep it local unless you intentionally want remote control.
- It does not allow writes, deletes, uploads, or directory traversal outside the shared root.
- Prefer trusted networks. Do not port-forward it to the public internet.

## Test coverage

The project intentionally tests three layers:

```bash
npm run test:unit          # path normalization, package wiring, traversal protection helpers
npm run test:integration   # Express app/control API behavior with real temp files
npm run test:functional    # browser flows against running file/control servers
npm test                   # all tests
npm run check              # lint + tests + TypeScript build
```

Current coverage areas:

- Safe path joins reject traversal
- Package scripts point at emitted CLI files
- Directory pages render the minimalist file browser UI
- Control UI renders browse/start/stop controls
- Control API lists child directories
- Control API starts and stops a real file server
- Nested directories are browsable
- File downloads return correct bytes/content type
- Browser can use the control UI to browse, start serving, fetch a file, and stop serving

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
  control.ts   Local control UI and start/stop API
  server.ts    Express app, file streaming, directory UI
  paths.ts     route normalization and traversal protection
  html.ts      HTML escaping and byte formatting helpers
  lan.ts       LAN address discovery
tests/
  unit/         pure helper/package wiring tests
  integration/  HTTP/control API behavior tests via supertest
  functional/   browser flow tests via Playwright
```

## License

MIT
