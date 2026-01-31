/**
 * 将上传文件写入 Storage，并将审计计划与 AI 结果写入 Firestore。
 * Storage 路径：users/{userId}/plans/{planId}/{fileName}
 * Firestore 文档：plans/{planId}，含 userId、name、createdAt、status、filePaths、result、triage、error
 */

import { ref, uploadBytes } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import type { AuditResponse } from "../audit_outputs/type_definitions";
import type { TriageItem } from "../audit_outputs/type_definitions";

export interface PlanDoc {
  userId: string;
  name: string;
  createdAt: number;
  status: string;
  filePaths?: string[];
  result?: AuditResponse | null;
  triage?: TriageItem[];
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
 * 将计划（含 AI 结果）写入 Firestore plans/{planId}。
 * 规则要求文档含 userId，且仅创建者可读写。
 */
export async function savePlanToFirestore(
  db: Firestore,
  planId: string,
  data: PlanDoc
): Promise<void> {
  const docRef = doc(db, "plans", planId);
  await setDoc(docRef, {
    ...data,
    updatedAt: Date.now(),
  }, { merge: true });
}

/**
 * 获取当前用户的所有计划（用于从 Firestore 加载列表）。
 * 需要 Firestore 复合索引：plans 集合 (userId ASC, createdAt DESC)。
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
