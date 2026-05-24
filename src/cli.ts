#!/usr/bin/env node
import path from 'node:path';
import { startServer } from './server.js';

interface CliArgs {
  rootDir: string;
  host: string;
  port: number;
}

function printHelp(): void {
  console.log(`lan-file-server

Share a folder over HTTP on your LAN.

Usage:
  lan-file-server <folder> [--host 0.0.0.0] [--port 8080]

Examples:
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

  const rootArg = args.find((arg) => !arg.startsWith('-'));
  const rootDir = path.resolve(rootArg ?? process.cwd());

  const readOption = (name: string, fallback: string): string => {
    const index = args.indexOf(name);
    return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
  };

  const port = Number(readOption('--port', process.env.PORT ?? '8080'));
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }

  return {
    rootDir,
    host: readOption('--host', process.env.HOST ?? '0.0.0.0'),
    port,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
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
