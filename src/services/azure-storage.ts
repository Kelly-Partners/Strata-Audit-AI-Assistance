/**
 * Azure Blob Storage for plan files — proxied through Azure Functions.
 *
 * All operations go through the Azure Functions backend, which holds the
 * Storage connection string server-side and extracts userId from the Bearer token.
 *
 * The exported function signatures are identical to the original direct-SDK
 * version so that App.tsx requires zero changes.
 */

import { apiFetch } from "./api-client";

function safeFileName(name: string, index: number): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return index > 0 ? `${index}_${base}` : base;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

/**
 * Upload plan files via Azure Function → Blob Storage.
 * userId parameter is kept for backward compatibility but is ignored —
 * the server extracts it from the Bearer token.
 */
export async function uploadPlanFiles(
  _userId: string,
  planId: string,
  files: File[]
): Promise<string[]> {
  const filesPayload = await Promise.all(
    files.map(async (f, i) => ({
      name: safeFileName(f.name, i),
      data: await fileToBase64(f),
      mimeType: f.type || "application/pdf",
    }))
  );

  const res = await apiFetch(`/plans/${planId}/files`, {
    method: "POST",
    body: JSON.stringify({ files: filesPayload }),
  });

  const json = (await res.json()) as { filePaths: string[] };
  return json.filePaths;
}

/**
 * Load plan files from Azure Function → Blob Storage.
 * Downloads blobs and converts to File objects for PDF preview.
 */
export async function loadPlanFilesFromStorage(
  filePaths: string[]
): Promise<File[]> {
  if (!filePaths?.length) return [];

  // Extract planId from the first path: users/{userId}/plans/{planId}/{fileName}
  const parts = filePaths[0].split("/");
  const planId = parts[3]; // index 3 is planId
  if (!planId) return [];

  const res = await apiFetch(`/plans/${planId}/files/load`, {
    method: "POST",
    body: JSON.stringify({ filePaths }),
  });

  const json = (await res.json()) as {
    files: Array<{ name: string; data: string; mimeType: string }>;
  };

  return json.files.map((f) => {
    const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
    return new File([bytes], f.name, { type: f.mimeType });
  });
}

/**
 * Delete all files for a plan via Azure Function → Blob Storage.
 * userId parameter is kept for backward compatibility but is ignored —
 * the server extracts it from the Bearer token.
 */
export async function deletePlanFilesFromStorage(
  _userId: string,
  planId: string
): Promise<void> {
  await apiFetch(`/plans/${planId}/files`, { method: "DELETE" });
}
