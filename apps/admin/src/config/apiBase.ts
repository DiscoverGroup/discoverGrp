const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const RAILWAY_API_BASE = 'https://discovergroup-api-production.up.railway.app';

export function getAdminApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '';
  }

  const explicit = import.meta.env.VITE_ADMIN_API_URL?.trim() || import.meta.env.VITE_API_URL?.trim();
  if (explicit) {
    const normalized = trimTrailingSlash(explicit);

    // Defensive override for stale Render config that causes CORS/503.
    if (normalized.includes('onrender.com')) {
      return RAILWAY_API_BASE;
    }

    return normalized;
  }

  // Fallback to production API when env is missing in the deployed admin build.
  return RAILWAY_API_BASE;
}

export function buildAdminApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getAdminApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
