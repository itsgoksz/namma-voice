export const API_URL = "http://localhost:8000";

// Helper to get the current logged in user from localStorage
export const getCurrentUser = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('namma_user') || 'Anonymous';
  }
  return 'Anonymous';
};

// Wrapper around fetch
export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const defaultHeaders = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    ...(options.headers || {})
  };
  return fetch(`${API_URL}${endpoint}`, {
    cache: 'no-store', // Fixes iOS Safari aggressive caching
    ...options,
    headers: defaultHeaders
  });
};

export const getImageUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads')) return `${API_URL}${url}`;
  return url;
};
