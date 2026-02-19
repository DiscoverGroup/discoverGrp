const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export function getAdminApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '';
  }

  const explicit = import.meta.env.VITE_ADMIN_API_URL?.trim() || import.meta.env.VITE_API_URL?.trim();
  if (explicit) {
    return trimTrailingSlash(explicit);
  }

  return '';
}

export function buildAdminApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getAdminApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
