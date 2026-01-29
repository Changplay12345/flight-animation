// file: config/api.ts
// API configuration - uses environment variable or falls back to localhost

export const API_BASE = 'http://192.168.27.150:8000';

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
