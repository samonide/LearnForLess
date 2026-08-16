import type { TokenHashResult } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// TOKEN GENERATION & HASHING (Server-side only)
// ============================================================

/**
 * Generates a cryptographically secure random access token.
 * Format: XXXXXX groups separated by dashes (24 chars total, uppercase A-Z + 0-9)
 * Example: 9K2M-7QX4-TP6R-H8ND-W3LZ-5CJF
 * 
 * IMPORTANT: This function is only safe to call on the server.
 * The raw token must never be stored — only the hash.
 */
export async function generateSecureToken(): Promise<TokenHashResult> {
  // Avoid ambiguous characters for easier manual entry.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const groups = 6;
  const charsPerGroup = 4;
  const totalChars = groups * charsPerGroup;

  const array = new Uint8Array(totalChars);
  crypto.getRandomValues(array);

  const raw = Array.from(array)
    .map((b) => alphabet[b % alphabet.length])
    .join("");

  const rawToken = Array.from({ length: groups }, (_, idx) =>
    raw.slice(idx * charsPerGroup, (idx + 1) * charsPerGroup)
  ).join("-");

  // Hash using SHA-256 (Web Crypto API — available in Node.js 18+)
  const tokenHash = await hashToken(rawToken);

  // Token hint = first segment (safe to display, hard to brute force)
  const tokenHint = rawToken.slice(0, 4);

  return { rawToken, tokenHash, tokenHint };
}

export function buildStudentTokenLoginEmail(tokenId: string): string {
  return `student-${tokenId.replace(/-/g, "")}@learnforless.local`;
}

/**
 * SHA-256 hash of a token string.
 * Returns hex-encoded hash.
 */
export async function hashToken(rawToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken.toUpperCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================
// SLUG UTILITIES
// ============================================================

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================================
// DATE FORMATTING
// ============================================================

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date | null): string {
  if (!date) return "—";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

// ============================================================
// NUMBER FORMATTING
// ============================================================

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

// ============================================================
// PROGRESS UTILITIES
// ============================================================

export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

// ============================================================
// FILE UTILITIES
// ============================================================

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

// ============================================================
// URL UTILITIES
// ============================================================

export function buildStoragePath(
  courseId: string,
  moduleId: string,
  lessonId: string,
  filename: string
): string {
  return `${courseId}/${moduleId}/${lessonId}/${filename}`;
}

// ============================================================
// ERROR MESSAGE UTILITIES
// ============================================================

export function getTokenErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    invalid_token: "Invalid or incorrect access token. Please check and try again.",
    token_disabled: "This access token has been deactivated. Please contact your administrator.",
    token_expired: "This access token has expired. Please contact your administrator for a new token.",
    token_assigned_to_another_student: "This token is assigned to another student account. Please contact your administrator.",
    token_max_uses_reached: "This access token has reached its maximum usage limit. Please contact your administrator.",
    no_courses_assigned: "No courses are currently assigned to this token. Please contact your administrator.",
    unknown_error: "An unexpected error occurred. Please try again.",
  };
  return messages[error] ?? messages.unknown_error;
}
