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
    {region: "australia-southeast1", secrets: [geminiApiKeySecret]},
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

        const apiKey = geminiApiKeySecret.value() || body.apiKey;
        if (!apiKey) {
          res.status(500).json({
            error: "Gemini API Key not configured. Set GEMINI_API_KEY in Secret Manager or pass apiKey in body.",
          });
          return;
        }

        const result = await executeFullReview({
          apiKey,
          systemPrompt: body.systemPrompt,
          fileManifest: body.fileManifest,
          files: body.files || [],
          previousAudit: body.previousAudit,
        });

        res.status(200).json(result);
      } catch (err) {
        logger.error("executeFullReview error", err);
        res.status(500).json({
          error: err.message || "Audit failed",
        });
      }
    },
);
