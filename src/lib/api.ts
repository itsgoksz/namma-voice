import { supabase } from './supabase';

export const getCurrentUser = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('namma_user') || 'Anonymous';
  }
  return 'Anonymous';
};

export const getImageUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads')) {
    const fileName = url.split('/').pop();
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/${fileName}`;
  }
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/${url}`;
};
