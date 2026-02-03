/**
 * Cloud Functions – Strata Audit AI（等效参考项目）
 * executeFullReview: 接收前端请求，调用 Gemini 执行审计，返回 JSON；
 * Gemini API Key 优先从 Secret Manager 的 GEMINI_API_KEY 读取，否则使用请求体中的 apiKey（本地/覆盖用）。
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {CORS_ALLOWED_ORIGINS} = require("./constants");
const {executeFullReview} = require("./geminiReview");

if (!admin.apps.length) admin.initializeApp();

setGlobalOptions({maxInstances: 10});

const geminiApiKeySecret = defineSecret("GEMINI_API_KEY");

function getCorsOrigin(requestOrigin) {
  if (!requestOrigin) return null;
  return CORS_ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null;
}

function setCorsHeaders(res, origin) {
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Max-Age", "3600");
}

exports.executeFullReview = onRequest(
    {
      region: "australia-southeast1",
      secrets: [geminiApiKeySecret],
      timeoutSeconds: 540,
      memory: "1GiB",
      invoker: "public",
      cors: CORS_ALLOWED_ORIGINS,
    },
    async (req, res) => {
      const origin = getCorsOrigin(req.get("Origin") || req.get("origin"));
      setCorsHeaders(res, origin);

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({error: "Method Not Allowed"});
        return;
      }

      try {
        const body = req.body;
        if (!body || typeof body !== "object") {
          res.status(400).json({error: "Missing or invalid JSON body"});
          return;
        }
        if (typeof body.systemPrompt !== "string" || !body.systemPrompt.trim()) {
          res.status(400).json({error: "Missing or empty systemPrompt in body"});
          return;
        }
        if (typeof body.fileManifest !== "string") {
          res.status(400).json({error: "Missing or invalid fileManifest in body"});
          return;
        }
        if (!Array.isArray(body.files)) {
          res.status(400).json({error: "Missing or invalid files array in body"});
          return;
        }

        let apiKey = null;
        try {
          apiKey = geminiApiKeySecret.value() || body.apiKey;
        } catch (secretErr) {
          logger.warn("Secret access failed", secretErr);
        }
        if (!apiKey) {
          const noKeyMsg = "Gemini API Key not configured. Create GEMINI_API_KEY in Secret Manager, then redeploy.";
          res.status(500).json({error: noKeyMsg});
          return;
        }

        const result = await executeFullReview({
          apiKey,
          systemPrompt: body.systemPrompt,
          fileManifest: body.fileManifest,
          files: body.files || [],
          previousAudit: body.previousAudit,
          mode: body.mode || "full",
          aiAttemptTargets: body.aiAttemptTargets,
        });

        const planId = body.planId;
        const userId = body.userId;
        const mode = body.mode || "full";
        const call2Phases = ["levy", "phase4", "expenses", "compliance"];

        if (planId && userId) {
          const db = admin.firestore();
          const planRef = db.doc(`plans/${planId}`);
          try {
            if (call2Phases.includes(mode)) {
              await db.runTransaction(async (tx) => {
                const snap = await tx.get(planRef);
                const current = snap.exists ? snap.data() : {};
                const prev = current.result || body.previousAudit || {};
                let merged = {...prev};
                if (mode === "levy") merged.levy_reconciliation = result.levy_reconciliation;
                else if (mode === "phase4") merged.assets_and_cash = result.assets_and_cash;
                else if (mode === "expenses") merged.expense_samples = result.expense_samples;
                else if (mode === "compliance") merged.statutory_compliance = result.statutory_compliance;
                const allDone = merged.levy_reconciliation && merged.assets_and_cash &&
                  merged.expense_samples && merged.statutory_compliance;
                tx.set(planRef, {
                  result: merged,
                  status: allDone ? "completed" : "processing",
                  error: null,
                  updatedAt: Date.now(),
                }, {merge: true});
              });
            } else {
              const fullResult = mode === "aiAttempt" ? (() => {
                const prev = body.previousAudit || {};
                const ups = result.ai_attempt_updates;
                const m = {...prev};
                if (ups?.levy_reconciliation) m.levy_reconciliation = ups.levy_reconciliation;
                if (ups?.balance_sheet_updates?.length) {
                  const v = m.assets_and_cash?.balance_sheet_verification || [];
                  for (const u of ups.balance_sheet_updates) {
                    const i = v.findIndex((r) => r.line_item === u.line_item && r.fund === u.fund);
                    if (i >= 0) v[i] = {...v[i], ...u}; else v.push(u);
                  }
                  m.assets_and_cash = {...(m.assets_and_cash || {}), balance_sheet_verification: v};
                }
                if (ups?.expense_updates?.length) {
                  const ex = m.expense_samples || [];
                  for (const u of ups.expense_updates) {
                    const i = ex.findIndex((e) => e.GL_ID === u.item?.GL_ID || e.GL_Payee === u.item?.GL_Payee);
                    if (i >= 0 && u.item) ex[i] = u.item; else if (u.item) ex.push(u.item);
                  }
                  m.expense_samples = ex;
                }
                if (ups?.statutory_compliance) m.statutory_compliance = {...m.statutory_compliance, ...ups.statutory_compliance};
                if (Array.isArray(result.ai_attempt_resolution_table)) m.ai_attempt_resolution_table = result.ai_attempt_resolution_table;
                return m;
              })() : (mode === "completion" ? {...(body.previousAudit || {}), completion_outputs: result.completion_outputs} : result);
              await planRef.set({
                result: fullResult,
                status: "completed",
                error: null,
                updatedAt: Date.now(),
              }, {merge: true});
            }
          } catch (writeErr) {
            logger.warn("Firestore write failed (client will still get response)", writeErr);
          }
        }

        res.status(200).json(result);
      } catch (err) {
        const msg = (err && err.message) || "Audit failed";
        const stack = err && err.stack;
        logger.error("executeFullReview error", msg, stack);
        const planId = req.body?.planId;
        const userId = req.body?.userId;
        if (planId && userId) {
          try {
            await admin.firestore().doc(`plans/${planId}`).set({
              status: "failed",
              error: msg,
              updatedAt: Date.now(),
            }, {merge: true});
          } catch (_) {}
        }
        res.status(500).json({
          error: msg,
        });
      }
    },
);
