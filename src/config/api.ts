// file: config/api.ts
// API configuration - uses environment variable or falls back to localhost

export const API_BASE = 'https://ozone-tells-desired-grade.trycloudflare.com';

// Helper function for API calls
export async function apiFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
}
