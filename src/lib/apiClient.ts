let sessionToken: string | null = null;

export function setAuthToken(token: string | null) {
  sessionToken = token;
}

export function getAuthToken(): string | null {
  return sessionToken;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (sessionToken) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    const errMsg = (data as { error?: string })?.error || `Error HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return data as T;
}

export function getRawFileUrl(virtualPath: string): string {
  const params = new URLSearchParams({ path: virtualPath });
  if (sessionToken) params.set('token', sessionToken);
  return `/api/fs/raw?${params.toString()}`;
}
