// Prefixes a root-relative path with the configured base so it resolves under a project site.
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return import.meta.env.BASE_URL.replace(/\/$/, "") + path;
}
