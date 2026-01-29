// file: config/api.ts
// API configuration - uses environment variable or falls back to localhost

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
