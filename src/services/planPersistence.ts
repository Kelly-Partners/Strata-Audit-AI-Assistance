/**
 * 将上传文件写入 Storage，并将审计计划与 AI 结果写入 Firestore。
 * Storage 路径：users/{userId}/plans/{planId}/{fileName}
 * Firestore 文档：plans/{planId}，含 userId、name、createdAt、status、filePaths、result、triage、error
 */

import { ref, uploadBytes, listAll, deleteObject, getDownloadURL } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { AuditResponse } from "../audit_outputs/type_definitions";
import type { TriageItem, UserResolution, UserOverride, AiAttemptHistoryEntry, AdditionalRunMeta } from "../audit_outputs/type_definitions";

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
  user_resolutions?: UserResolution[];
  user_overrides?: UserOverride[];
  ai_attempt_history?: AiAttemptHistoryEntry[];
  additional_runs?: AdditionalRunMeta[];
  error?: string | null;
  updatedAt?: number;
}

function safeFileName(name: string, index: number): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return index > 0 ? `${index}_${base}` : base;
}

/**
 * 将计划下的文件上传到 Storage：users/{userId}/plans/{planId}/{fileName}
 * 返回完整路径数组（用于写入 Firestore）。
 */
export async function uploadPlanFiles(
  storageInstance: FirebaseStorage,
  userId: string,
  planId: string,
  files: File[]
): Promise<string[]> {
  const base = `users/${userId}/plans/${planId}`;
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const name = safeFileName(f.name, i);
    const path = `${base}/${name}`;
    const storageRef = ref(storageInstance, path);
    await uploadBytes(storageRef, f, { contentType: f.type || "application/octet-stream" });
    paths.push(path);
  }
  return paths;
}

/**
 * Upload additional run files to Storage: users/{userId}/plans/{planId}/additional/run_{runId}/{fileName}
 * Returns full paths for Firestore.
 */
export async function uploadAdditionalRunFiles(
  storageInstance: FirebaseStorage,
  userId: string,
  planId: string,
  runId: string,
  files: File[]
): Promise<string[]> {
  const base = `users/${userId}/plans/${planId}/additional/run_${runId}`;
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const name = safeFileName(f.name, i);
    const path = `${base}/${name}`;
    const storageRef = ref(storageInstance, path);
    await uploadBytes(storageRef, f, { contentType: f.type || "application/octet-stream" });
    paths.push(path);
  }
  return paths;
}

/**
 * Remove undefined keys from object to avoid Firestore setDoc errors.
 */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * 将计划（含 AI 结果）写入 Firestore plans/{planId}。
 * 规则要求文档含 userId，且仅创建者可读写。
 * 写入前会剔除 undefined 字段，避免 Firestore 报 Unsupported field value。
 */
export async function savePlanToFirestore(
  db: Firestore,
  planId: string,
  data: PlanDoc
): Promise<void> {
  const docRef = doc(db, "plans", planId);
  const payload = omitUndefined({
    ...data,
    updatedAt: Date.now(),
  });
  await setDoc(docRef, payload, { merge: true });
}

/**
 * Subscribe to a plan document for real-time updates (e.g. when Cloud Function writes result after refresh).
 * Returns unsubscribe function.
 */
export function subscribePlanDoc(
  db: Firestore,
  planId: string,
  onUpdate: (data: PlanDoc & { id: string }) => void
): () => void {
  const docRef = doc(db, "plans", planId);
  return onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      onUpdate({ id: snap.id, ...(snap.data() as PlanDoc) });
    }
  });
}

/**
 * Get current user's plans from Firestore (one-time load).
 * Requires Firestore composite index: plans (userId ASC, createdAt DESC).
 */
export async function getPlansFromFirestore(
  db: Firestore,
  userId: string
): Promise<Array<PlanDoc & { id: string }>> {
  const q = query(
    collection(db, "plans"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PlanDoc & { id: string }));
}

/**
 * Load plan files from Storage. Includes initial filePaths + all additional run file paths.
 */
export async function loadPlanFilesFromStorage(
  storageInstance: FirebaseStorage,
  filePaths: string[],
  additionalRuns?: { file_paths: string[] }[]
): Promise<File[]> {
  const allPaths = [
    ...(filePaths ?? []),
    ...(additionalRuns ?? []).flatMap((r) => r.file_paths ?? []),
  ];
  if (!allPaths.length) return [];
  const files: File[] = [];
  for (const path of allPaths) {
    try {
      const storageRef = ref(storageInstance, path);
      const url = await getDownloadURL(storageRef);
      const res = await fetch(url);
      const blob = await res.blob();
      const fileName = path.split("/").pop() || "file";
      files.push(new File([blob], fileName, { type: blob.type || "application/octet-stream" }));
    } catch (_) {
      // Skip failed fetches
    }
  }
  return files;
}

/**
 * Recursively delete all files under a Storage reference (including additional/run_xxx/ subfolders).
 */
async function deleteFolderRecursive(
  storageRef: ReturnType<typeof ref>
): Promise<void> {
  const listResult = await listAll(storageRef);
  await Promise.all(listResult.items.map((itemRef) => deleteObject(itemRef)));
  await Promise.all(listResult.prefixes.map((prefixRef) => deleteFolderRecursive(prefixRef)));
}

/**
 * 删除 Storage 中该计划目录下的所有文件（含 additional/run_xxx/ 子目录）：users/{userId}/plans/{planId}/
 */
export async function deletePlanFilesFromStorage(
  storageInstance: FirebaseStorage,
  userId: string,
  planId: string
): Promise<void> {
  const folderRef = ref(storageInstance, `users/${userId}/plans/${planId}`);
  await deleteFolderRecursive(folderRef);
}

/**
 * 删除 Firestore 中的计划文档 plans/{planId}。
 */
export async function deletePlanFromFirestore(
  db: Firestore,
  planId: string
): Promise<void> {
  const docRef = doc(db, "plans", planId);
  await deleteDoc(docRef);
}
