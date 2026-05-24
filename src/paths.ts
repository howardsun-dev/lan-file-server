import path from 'node:path';

export function normalizeRoutePath(routePath: string): string {
  const withoutQuery = routePath.split('?')[0] ?? '/';
  const decoded = decodeURIComponent(withoutQuery);
  return decoded.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function safeJoin(rootDir: string, routePath: string): string {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, routePath);
  const relative = path.relative(root, target);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Requested path is outside the shared root');
  }

  return target;
}
