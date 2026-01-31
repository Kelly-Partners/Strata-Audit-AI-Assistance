/**
 * 前端 Firebase 初始化（步骤 6）
 * 使用 import.meta.env 的 6 个 VITE_FIREBASE_* 构建 config；
 * Firestore 使用默认数据库 (default)。
 * 构建时需在 .env 或 CI 中注入 VITE_FIREBASE_*，否则登录页会提示未配置。
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const env = import.meta.env;
const firebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string) ?? "",
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string) ?? "",
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string) ?? "",
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET as string) ?? "",
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) ?? "",
  appId: (env.VITE_FIREBASE_APP_ID as string) ?? "",
};

export const hasValidFirebaseConfig = !!(
  firebaseConfig.projectId &&
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain
);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { app };
