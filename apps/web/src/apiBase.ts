export function joinApiUrl(base: string | undefined, path: string): string {
  if (!path.startsWith('/')) {
    throw new Error('API path must start with /');
  }
  const trimmed = (base ?? '').trim().replace(/\/$/, '');
  if (trimmed.length > 0) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error('VITE_API_BASE_URL must be an http(s) URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('VITE_API_BASE_URL must be an http(s) URL');
    }
    if (url.username || url.password) {
      throw new Error('VITE_API_BASE_URL must not include credentials');
    }
  }
  return `${trimmed}${path}`;
}

export function apiUrl(path: string): string {
  return joinApiUrl(import.meta.env.VITE_API_BASE_URL, path);
}
