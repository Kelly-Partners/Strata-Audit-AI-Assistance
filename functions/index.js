/**
 * Cloud Functions – Strata Audit AI（等效参考项目）
 * executeFullReview: 接收前端请求，调用 Gemini 执行审计，返回 JSON；
 * Gemini API Key 优先从 Secret Manager 的 GEMINI_API_KEY 读取，否则使用请求体中的 apiKey（本地/覆盖用）。
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const {CORS_ALLOWED_ORIGINS} = require("./constants");
const {executeFullReview} = require("./geminiReview");

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
        });

        res.status(200).json(result);
      } catch (err) {
        const msg = (err && err.message) || "Audit failed";
        const stack = err && err.stack;
        logger.error("executeFullReview error", msg, stack);
        res.status(500).json({
          error: msg,
        });
      }
    },
);
