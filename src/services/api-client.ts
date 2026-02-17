/**
 * Shared API client for Azure Functions endpoints.
 * Provides base URL resolution and Bearer token injection.
 */

import { getAccessToken } from "./azure-auth";

const AZURE_FUNCTION_URL =
  (import.meta.env.VITE_AZURE_FUNCTION_URL as string) ?? "";

/**
 * Get the base URL for the Azure Functions API (without trailing slash).
 * Strips any trailing path like /api/executeFullReview for backward compatibility.
 */
export function getApiBaseUrl(): string {
  if (!AZURE_FUNCTION_URL.trim()) {
    throw new Error(
      "Azure Function URL not configured. Set VITE_AZURE_FUNCTION_URL in environment."
    );
  }
  // Strip trailing /api/executeFullReview or similar paths to get base URL
  return AZURE_FUNCTION_URL.trim()
    .replace(/\/api\/executeFullReview\/?$/i, "")
    .replace(/\/+$/, "");
}

/**
 * Fetch wrapper that adds base URL and Authorization header.
 * All Azure Function API calls should go through this.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  const base = getApiBaseUrl();

  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMessage: string;
    try {
      const errJson = JSON.parse(errText);
      errMessage = errJson.error || errText;
    } catch {
      errMessage = errText || res.statusText;
    }
    throw new Error(errMessage);
  }

  return res;
}
