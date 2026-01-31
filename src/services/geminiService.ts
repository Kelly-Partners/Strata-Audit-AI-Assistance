import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt } from "../audit_engine";
import type { AuditResponse } from "../audit_outputs/type_definitions";

export const analyzeAuditFiles = async (
  apiKey: string,
  files: File[],
  previousAudit?: AuditResponse | null
): Promise<AuditResponse> => {
  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = buildSystemPrompt();

  const fileParts = await Promise.all(
    files.map(async (file) => {
      const base64Data = await fileToBase64(file);
      let mimeType = file.type;
      if (!mimeType) {
        if (file.name.toLowerCase().endsWith(".pdf")) mimeType = "application/pdf";
        else if (file.name.toLowerCase().endsWith(".csv")) mimeType = "text/csv";
      }
      return {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || "application/pdf",
        },
      };
    })
  );

  const fileManifest = files.map((f, i) => `File Part ${i + 1}: ${f.name}`).join("\n");

  let userInstruction = "";

  if (previousAudit) {
    userInstruction = `
    ATTACHED FILE MAPPING (Strictly map the binary parts to these names):
    ${fileManifest}

    *** INCREMENTAL AUDIT UPDATE ***
    CONTEXT: The user has provided additional evidence files.
    CURRENT AUDIT STATE: ${JSON.stringify(previousAudit)}

    INSTRUCTIONS:
    1. Update the "document_register" with the new files. Use the exact names from the mapping above.
    2. Check "missing_critical_types" in "intake_summary". If a missing doc is now provided, resolve it.
    3. Return the merged JSON.
    `;
  } else {
    userInstruction = `
    ATTACHED FILE MAPPING (Strictly map the binary parts to these names):
    ${fileManifest}

    INSTRUCTIONS:
    1. Step 0: Create the Document Dictionary. You MUST map "File Part 1" to the first name in the list above, "File Part 2" to the second, etc.
    2. The "Document_Origin_Name" in the JSON MUST match the filename exactly.
    3. Execute Phases 1-6 based on these files.
    `;
  }

  const modelsToTry = ["gemini-3-pro-preview", "gemini-3-flash-preview"];
  let lastError: unknown;

  for (const model of modelsToTry) {
    try {
      console.log(`Executing Audit Kernel with Model: ${model}`);

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [...fileParts, { text: userInstruction }],
        },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
      });

      if (!response.text) {
        throw new Error("Gemini returned an empty response.");
      }

      let jsonString = response.text.trim();
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonString.startsWith("```")) {
        jsonString = jsonString.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      return JSON.parse(jsonString) as AuditResponse;
    } catch (error: unknown) {
      console.warn(`Attempt failed with model ${model}:`, error);
      lastError = error;

      const err = error as { status?: number; code?: number; message?: string };
      const isRateLimit = err.status === 429 || err.code === 429 || (err.message?.includes("429") ?? false);

      if (isRateLimit) {
        if (model === modelsToTry[modelsToTry.length - 1]) {
          throw new Error("Audit failed: API Quota exceeded. Please try again later.");
        }
        continue;
      }
      if (err.message?.startsWith("Gemini")) {
        throw error;
      }
      throw new Error(`Audit failed: ${err.message ?? "Unknown error"}`);
    }
  }

  throw lastError;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64 ?? "");
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};
