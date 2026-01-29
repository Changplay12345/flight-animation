// file: config/api.ts
// API configuration - uses environment variable or falls back to localhost

export const API_BASE = 'https://unsyllabled-bronson-sulfonyl.ngrok-free.dev';

// Helper function for API calls with ngrok bypass
export async function apiFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
}
