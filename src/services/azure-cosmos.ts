/**
 * Azure Cosmos DB plan persistence — proxied through Azure Functions.
 *
 * All operations go through the Azure Functions backend, which holds the
 * Cosmos DB keys server-side and extracts userId from the MSAL Bearer token.
 *
 * The exported function signatures are identical to the original direct-SDK
 * version so that App.tsx requires zero changes.
 */

import type { AuditResponse } from "../audit_outputs/type_definitions";
import type { TriageItem } from "../audit_outputs/type_definitions";
import { apiFetch } from "./api-client";

export interface FileMetaEntry {
  uploadedAt: number;
  batch: "initial" | "additional";
}

export interface PlanDoc {
  userId: string;
  name: string;
  createdAt: number;
  status: string;
  filePaths?: string[];
  fileMeta?: FileMetaEntry[];
  result?: AuditResponse | null;
  triage?: TriageItem[];
  error?: string | null;
  updatedAt?: number;
}

/**
 * Save/update a plan document via Azure Function → Cosmos DB.
 */
export async function savePlanToCosmosDB(
  planId: string,
  data: PlanDoc
): Promise<void> {
  await apiFetch(`/plans/${planId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Get all plans for a user via Azure Function → Cosmos DB.
 * userId parameter is kept for backward compatibility but is ignored —
 * the server extracts it from the Bearer token.
 */
export async function getPlansFromCosmosDB(
  _userId: string
): Promise<Array<PlanDoc & { id: string }>> {
  const res = await apiFetch("/plans");
  return (await res.json()) as Array<PlanDoc & { id: string }>;
}

/**
 * Delete a plan document via Azure Function → Cosmos DB.
 * userId parameter is kept for backward compatibility but is ignored —
 * the server extracts it from the Bearer token.
 */
export async function deletePlanFromCosmosDB(
  planId: string,
  _userId: string
): Promise<void> {
  await apiFetch(`/plans/${planId}`, { method: "DELETE" });
}
