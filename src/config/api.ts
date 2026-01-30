// file: config/api.ts
// API configuration

// Cloudflare Tunnel URL (only needed for creating datasets)
export const API_BASE = 'https://ozone-tells-desired-grade.trycloudflare.com';

// R2 Public URL (for loading parquets and dataset list - no tunnel needed)
export const R2_PUBLIC_URL = 'https://pub-f32d1de24fcd4e239c43ee1c3e9777f9.r2.dev';

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
