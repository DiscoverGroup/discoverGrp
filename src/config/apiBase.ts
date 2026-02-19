const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const normalizePath = (path: string): string => {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
};

export function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '';
  }

  const explicit = import.meta.env.VITE_API_BASE_URL?.trim();

  if (explicit) {
    return trimTrailingSlash(explicit);
  }

  return '';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = normalizePath(path);

  if (!base) {
    return normalizedPath;
  }

  return `${base}${normalizedPath}`;
}
