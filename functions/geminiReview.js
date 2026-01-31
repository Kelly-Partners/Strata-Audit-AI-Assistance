/**
 * Strata Audit – 调用 Gemini 执行完整审计（等效参考项目 geminiReview）
 * 请求体：apiKey, systemPrompt, fileManifest, files: [{ name, data (base64), mimeType }], previousAudit?
 */

const {GoogleGenAI} = require("@google/genai");

const MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

/**
 * @param {object} opts
 * @param {string} opts.apiKey - Gemini API Key
 * @param {string} opts.systemPrompt - Audit Kernel system prompt（由前端 buildSystemPrompt() 传入）
 * @param {string} opts.fileManifest - "File Part 1: name1\nFile Part 2: name2..."
 * @param {Array<{name: string, data: string, mimeType?: string}>} opts.files - base64 文件列表
 * @param {object} [opts.previousAudit] - 增量更新时的当前审计结果
 * @returns {Promise<object>} AuditResponse JSON
 */
async function executeFullReview(opts) {
  const {apiKey, systemPrompt, fileManifest, files, previousAudit} = opts;
  if (!apiKey || !systemPrompt || !fileManifest || !Array.isArray(files)) {
    throw new Error("Missing required: apiKey, systemPrompt, fileManifest, files");
  }

  const ai = new GoogleGenAI({apiKey});
  const fileParts = files.map((f) => ({
    inlineData: {
      data: f.data,
      mimeType: f.mimeType || "application/pdf",
    },
  }));

  const userInstruction = previousAudit ?
    `
ATTACHED FILE MAPPING (Strictly map the binary parts to these names):
${fileManifest}

*** INCREMENTAL AUDIT UPDATE ***
CONTEXT: The user has provided additional evidence files.
CURRENT AUDIT STATE: ${JSON.stringify(previousAudit)}

INSTRUCTIONS:
1. Update the "document_register" with the new files. Use the exact names from the mapping above.
2. Check "missing_critical_types" in "intake_summary". If a missing doc is now provided, resolve it.
3. Return the merged JSON.
` :
    `
ATTACHED FILE MAPPING (Strictly map the binary parts to these names):
${fileManifest}

INSTRUCTIONS:
1. Step 0: Create the Document Dictionary. You MUST map "File Part 1" to the first name in the list above,
   "File Part 2" to the second, etc.
2. The "Document_Origin_Name" in the JSON MUST match the filename exactly.
3. Execute Phases 1-6 based on these files.
`;

  let lastError;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [...fileParts, {text: userInstruction}],
        },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
      });

      if (!response.text) throw new Error("Gemini returned an empty response.");

      let jsonString = response.text.trim();
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonString.startsWith("```")) {
        jsonString = jsonString.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      return JSON.parse(jsonString);
    } catch (err) {
      lastError = err;
      if (err.message && err.message.startsWith("Gemini")) throw err;
      continue;
    }
  }
  throw lastError || new Error("Audit failed");
}

module.exports = {executeFullReview};
