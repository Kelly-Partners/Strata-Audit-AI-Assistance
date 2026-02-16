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

/** Get effective expense_samples from result (expense_runs combined or legacy expense_samples). */
function getEffectiveExpenseSamples(result) {
  if (!result) return [];
  if (result.expense_runs?.length) {
    const list = [];
    const indexByGlId = new Map();
    for (let r = 0; r < result.expense_runs.length; r++) {
      const run = result.expense_runs[r];
      const runSamples = run.expense_samples || [];
      for (let i = 0; i < runSamples.length; i++) {
        const s = runSamples[i];
        const key = s.GL_ID ?? `_${r}_${i}`;
        const idx = indexByGlId.get(key);
        if (idx !== undefined) {
          list[idx] = s;
        } else {
          indexByGlId.set(key, list.length);
          list.push(s);
        }
      }
    }
    return list;
  }
  return result.expense_samples || [];
}

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
        if (!Array.isArray(body.filePaths) || body.filePaths.length === 0) {
          res.status(400).json({error: "Missing or invalid filePaths array in body"});
          return;
        }

        const isExpensesAdditional = body.mode === "expenses_additional";
        if (isExpensesAdditional) {
          const ar = body.additionalRunPaths;
          if (!ar || typeof ar.runId !== "string" || !Array.isArray(ar.paths) || ar.paths.length === 0) {
            res.status(400).json({error: "expenses_additional requires additionalRunPaths: { runId, paths }"});
            return;
          }
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

        const basePaths = body.filePaths || [];
        const addRunPaths = body.additionalRunPaths?.paths || [];
        const allPaths = isExpensesAdditional ?
          [...basePaths, ...addRunPaths] :
          basePaths;

        const bucket = admin.storage().bucket();
        const files = [];
        for (const p of allPaths) {
          try {
            const [buf] = await bucket.file(p).download();
            const base64 = buf.toString("base64");
            const ext = (p.split("/").pop() || "").toLowerCase();
            let mimeType = "application/pdf";
            if (ext.endsWith(".csv")) mimeType = "text/csv";
            else if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
              mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            }
            const name = p.split("/").pop() || "file";
            files.push({name, data: base64, mimeType});
          } catch (fetchErr) {
            logger.warn("Storage fetch failed for " + p, fetchErr);
          }
        }
        if (files.length === 0) {
          res.status(400).json({error: "Could not fetch any files from Storage"});
          return;
        }

        const fileMeta = body.fileMeta || [];
        const effectiveMeta = isExpensesAdditional ?
          [
            ...(basePaths.map(() => ({batch: "initial"}))),
            ...(addRunPaths.map(() => ({batch: "additional"}))),
          ] :
          fileMeta;
        const buildManifest = (withAdditional) =>
          files.map((f, i) => {
            const meta = effectiveMeta[i];
            const isAdd = withAdditional && meta && meta.batch === "additional";
            const suffix = isAdd ?
              " [ADDITIONAL]" :
              "";
            return `File Part ${i + 1}: ${f.name}${suffix}`;
          }).join("\n");
        const fileManifest = effectiveMeta.length === files.length ? buildManifest(true) : buildManifest(false);

        const result = await executeFullReview({
          apiKey,
          systemPrompt: body.systemPrompt,
          fileManifest,
          files,
          previousAudit: body.previousAudit,
          mode: body.mode || "full",
          aiAttemptTargets: body.aiAttemptTargets,
        });

        const planId = body.planId;
        const userId = body.userId;
        const mode = body.mode || "full";
        const call2Phases = ["levy", "phase4", "expenses", "compliance"];

        if (planId && userId && mode !== "expenses_additional") {
          const db = admin.firestore();
          const planRef = db.doc(`plans/${planId}`);
          try {
            if (call2Phases.includes(mode)) {
              await db.runTransaction(async (tx) => {
                const snap = await tx.get(planRef);
                const current = snap.exists ? snap.data() : {};
                const prev = current.result || body.previousAudit || {};
                const merged = {...prev};
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
              let fullResult;
              if (mode === "aiAttempt") {
                const prev = body.previousAudit || {};
                const ups = result.ai_attempt_updates;
                fullResult = {...prev};
                if (ups?.levy_reconciliation) fullResult.levy_reconciliation = ups.levy_reconciliation;
                if (ups?.balance_sheet_updates?.length && fullResult.assets_and_cash?.balance_sheet_verification) {
                  const verif = [...fullResult.assets_and_cash.balance_sheet_verification];
                  const key = (b) => `${b.line_item || ""}|${b.fund || "N/A"}`;
                  const updateMap = new Map(ups.balance_sheet_updates.map((b) => [key(b), b]));
                  for (let i = 0; i < verif.length; i++) {
                    const u = updateMap.get(key(verif[i]));
                    if (u) verif[i] = u;
                  }
                  fullResult.assets_and_cash = {...fullResult.assets_and_cash, balance_sheet_verification: verif};
                }
                if (ups?.expense_updates?.length) {
                  const effective = getEffectiveExpenseSamples(fullResult);
                  if (effective.length > 0) {
                    const samples = [...effective];
                    for (const u of ups.expense_updates) {
                      const match = (u.merge_key || "").match(/^exp_(\d+)$/);
                      if (match) {
                        const idx = parseInt(match[1], 10);
                        if (idx >= 0 && idx < samples.length && u.item) samples[idx] = u.item;
                      }
                    }
                    fullResult.expense_samples = samples;
                  }
                }
                if (ups?.statutory_compliance && Object.keys(ups.statutory_compliance).length > 0) {
                  fullResult.statutory_compliance = {...fullResult.statutory_compliance, ...ups.statutory_compliance};
                }
                if (Array.isArray(result.ai_attempt_resolution_table)) {
                  fullResult.ai_attempt_resolution_table = result.ai_attempt_resolution_table;
                }
              } else if (mode === "completion") {
                fullResult = {...(body.previousAudit || {}), completion_outputs: result.completion_outputs};
              } else {
                fullResult = result;
              }
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
          } catch (e) {
            void e;
          }
        }
        res.status(500).json({
          error: msg,
        });
      }
    },
);
