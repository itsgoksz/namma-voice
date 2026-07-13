import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function compressImageBase64(base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = (e) => reject(e);
  });
}

// Basic profanity list (simplified for demonstration, typically this would be a larger list or an external package)
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'bastard', 'slut', 'whore', 'nigger', 'faggot'];

export function hasProfanity(text: string): boolean {
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const word of BAD_WORDS) {
    if (normalizedText.includes(word)) {
      return true;
    }
  }
  return false;
}

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) return { valid: false, message: "Password must be at least 8 characters long." };
  if (!/[A-Z]/.test(password)) return { valid: false, message: "Password must contain at least one uppercase letter." };
  if (!/[a-z]/.test(password)) return { valid: false, message: "Password must contain at least one lowercase letter." };
  if (!/[0-9]/.test(password)) return { valid: false, message: "Password must contain at least one number." };
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return { valid: false, message: "Password must contain at least one special character." };
  return { valid: true, message: "" };
}
