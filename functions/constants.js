/**
 * Cloud Functions 常量（等效参考项目）
 * CORS 白名单：Hosting 域名 + 本地开发
 */

const PROJECT_ID = "strata-audit-ai-reviewer";

const CORS_ALLOWED_ORIGINS = [
  `https://${PROJECT_ID}.web.app`,
  `https://${PROJECT_ID}.firebaseapp.com`,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

module.exports = {
  CORS_ALLOWED_ORIGINS,
  PROJECT_ID,
};
