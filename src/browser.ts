import { spawn } from 'node:child_process';

function quoteForShell(value: string): string {
  if (process.platform === 'win32') {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function spawnAndDetach(command: string, args: string[], options: { shell?: boolean } = {}): void {
  const child = spawn(command, args, {
    detached: true,
    shell: options.shell ?? false,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

export function openBrowser(url: string): void {
  const configuredCommand = process.env.LAN_FILE_SERVER_BROWSER_COMMAND;
  if (configuredCommand) {
    spawnAndDetach(`${configuredCommand} ${quoteForShell(url)}`, [], { shell: true });
    return;
  }

  if (process.platform === 'darwin') {
    spawnAndDetach('open', [url]);
    return;
  }

  if (process.platform === 'win32') {
    spawnAndDetach('cmd', ['/c', 'start', '', url]);
    return;
  }

  spawnAndDetach('xdg-open', [url]);
}
