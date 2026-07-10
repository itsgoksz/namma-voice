export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://namma-voice-production.up.railway.app";

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
    ...(options.headers || {})
  };
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: defaultHeaders
  });
};
