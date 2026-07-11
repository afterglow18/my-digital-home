import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(path: string | null | undefined) {
  if (!path) return null;
  // Data URLs are stored directly — return as-is
  if (path.startsWith("data:")) return path;
  return `/api/storage${path}`;
}
