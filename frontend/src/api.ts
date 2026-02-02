// API base URL: empty = same origin (use with nginx proxy in production)
const API_BASE = process.env.REACT_APP_API_URL ?? '';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}
