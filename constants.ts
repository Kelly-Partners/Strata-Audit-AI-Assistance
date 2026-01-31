/**
 * Audit Kernel system prompt is now built by src/audit_engine.
 * Re-export for any code that still imports AUDIT_KERNEL_SYSTEM_PROMPT from constants.
 */
import { buildSystemPrompt } from "./src/audit_engine";

export const AUDIT_KERNEL_SYSTEM_PROMPT = buildSystemPrompt();
