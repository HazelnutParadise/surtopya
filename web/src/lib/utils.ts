import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getContrastColor(hexColor: string | undefined): "white" | "black" {
  if (!hexColor) return "black";

  // Clean hex code
  const hex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate brightness using YIQ formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  return yiq >= 128 ? "black" : "white";
}
