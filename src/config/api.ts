// file: config/api.ts
// API configuration

// Detect if running locally (localhost or 127.0.0.1)
const isLocal = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// API Base URL - use localhost for local dev, tunnel for production
export const API_BASE = isLocal 
  ? 'http://localhost:8000'
  : 'https://struct-staff-seeing-valuation.trycloudflare.com';

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
