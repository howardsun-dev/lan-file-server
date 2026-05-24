#!/usr/bin/env node
import path from 'node:path';
import { openBrowser } from './browser.js';
import { startControlServer } from './control.js';
import { startServer } from './server.js';

interface CliArgs {
  rootDir: string;
  host: string;
  port: number;
  controlUi: boolean;
}

function printHelp(): void {
  console.log(`lan-file-server

Share a folder over HTTP on your LAN, either directly or through a local control UI.

Usage:
  lan-file-server                 Start the local control UI
  lan-file-server --ui            Start the local control UI
  lan-file-server <folder>        Serve a folder immediately
  lan-file-server <folder> [--host 0.0.0.0] [--port 8080]

Examples:
  lan-file-server
  lan-file-server --ui --port 7070
  lan-file-server ~/Downloads
  lan-file-server /srv/share --port 3000
`);
}

function parseArgs(argv: string[]): CliArgs {
  const args = [...argv];
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const readOption = (name: string, fallback: string): string => {
    const index = args.indexOf(name);
    return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
  };

  const optionNamesWithValues = new Set(['--host', '--port']);
  const positionalArgs: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (optionNamesWithValues.has(arg)) {
      index += 1;
      continue;
    }
    if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }

  const rootArg = positionalArgs[0];
  const controlUi = args.includes('--ui') || rootArg === undefined;
  const rootDir = path.resolve(rootArg ?? process.cwd());

  const port = Number(readOption('--port', process.env.PORT ?? (controlUi ? '7070' : '8080')));
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }

  return {
    rootDir,
    host: readOption('--host', process.env.HOST ?? (controlUi ? '127.0.0.1' : '0.0.0.0')),
    port,
    controlUi,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.controlUi) {
    const control = await startControlServer({ host: options.host, port: options.port });
    console.log('LAN File Server control UI is running');
    console.log(`Control UI: ${control.url}`);
    console.log('Opening the control UI in your browser so you can choose a folder to serve.');
    openBrowser(control.url);
    console.log('Press Ctrl+C to stop.');
    return;
  }

  const server = await startServer(options);

  console.log('LAN File Server is running');
  console.log(`Local: ${server.url}`);
  for (const url of server.lanUrls) {
    console.log(`LAN:   ${url}`);
  }
  console.log(`Root:  ${options.rootDir}`);
  console.log('Press Ctrl+C to stop.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
