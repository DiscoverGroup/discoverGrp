const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const normalizePath = (path: string): string => {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
};

const RAILWAY_API_BASE = 'https://discovergroup-api-production.up.railway.app';

export function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '';
  }

  const explicit = import.meta.env.VITE_API_BASE_URL?.trim();

  if (explicit) {
    const normalized = trimTrailingSlash(explicit);

    // Defensive override: old Render URL causes CORS 503 in production.
    if (normalized.includes('discovergroup.onrender.com')) {
      return RAILWAY_API_BASE;
    }

    return normalized;
  }

  // Fallback to production API when no env variable is injected at build time.
  return RAILWAY_API_BASE;
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = normalizePath(path);

  if (!base) {
    return normalizedPath;
  }

  return `${base}${normalizedPath}`;
}
