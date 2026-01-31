/**
 * 逐字比对：当前 app 的 buildSystemPrompt() 与远端 GitHub 上的原始 AUDIT_KERNEL_SYSTEM_PROMPT 是否完整一致。
 * 用法: node scripts/verify-prompts.js
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function extractAllTemplateLiterals(fileContent) {
  const segments = [];
  let pos = 0;
  while (pos < fileContent.length) {
    const startMarker = "= `";
    const startIdx = fileContent.indexOf(startMarker, pos);
    if (startIdx === -1) break;
    const contentStart = startIdx + startMarker.length;
    const endIdx = fileContent.indexOf("`;", contentStart);
    if (endIdx === -1) break;
    segments.push(fileContent.slice(contentStart, endIdx));
    pos = endIdx + 2;
  }
  return segments;
}

function getRemotePrompt() {
  try {
    const out = execSync("git show origin/main:constants.ts", {
      encoding: "utf8",
      cwd: ROOT,
    });
    const segments = extractAllTemplateLiterals(out);
    if (segments.length === 0) throw new Error("远端 constants.ts 中未找到模板字面量");
    return segments[0];
  } catch (e) {
    throw new Error("无法读取远端 constants.ts: " + e.message);
  }
}

function getCurrentCombinedPrompt() {
  const readSegments = (relPath) => {
    const content = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    return extractAllTemplateLiterals(content);
  };
  const c0 = readSegments("src/audit_engine/kernel/00_constitution.ts");
  const e0 = readSegments("src/audit_engine/kernel/20_evidence_rules.ts");
  const s0 = readSegments("src/audit_engine/workflow/step_0_intake.ts");
  const p1 = readSegments("src/audit_engine/workflow/phase_1_verify.ts");
  const p2 = readSegments("src/audit_engine/workflow/phase_2_revenue.ts");
  const p4 = readSegments("src/audit_engine/workflow/phase_4_assets.ts");
  const p3 = readSegments("src/audit_engine/workflow/phase_3_expenses.ts");
  const p5 = readSegments("src/audit_engine/workflow/phase_5_compliance.ts");
  const out = readSegments("src/audit_outputs/output_registry.ts");
  return (
    c0[0] + e0[0] + c0[1] +
    s0[0] + p1[0] + p2[0] + p4[0] + p3[0] + p5[0] + out[0]
  );
}

function normalize(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function findFirstDiff(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i])
      return {
        index: i,
        charA: a[i],
        charB: b[i],
        codeA: a[i].charCodeAt(0),
        codeB: b[i].charCodeAt(0),
        context: a.slice(Math.max(0, i - 50), i + 51),
      };
  }
  if (a.length !== b.length)
    return {
      index: len,
      charA: a[len],
      charB: b[len],
      context: "(长度不同，在末尾)",
    };
  return null;
}

function main() {
  console.log("=== 校验：当前 app 组合 prompt 与远端 GitHub 版本 ===\n");

  let remote, current;
  try {
    remote = normalize(getRemotePrompt());
    console.log("远端 origin/main constants.ts 中 AUDIT_KERNEL_SYSTEM_PROMPT 长度:", remote.length);
  } catch (e) {
    console.error("错误:", e.message);
    process.exit(1);
  }

  try {
    current = normalize(getCurrentCombinedPrompt());
    console.log("当前 app (buildSystemPrompt 等效拼接) 长度:", current.length);
  } catch (e) {
    console.error("错误:", e.message);
    process.exit(1);
  }

  console.log("");

  if (remote === current) {
    console.log("结果: 完全一致，无遗漏。");
    return;
  }

  const diff = findFirstDiff(remote, current);
  console.log("结果: 存在差异。");
  console.log("远端长度:", remote.length, "当前长度:", current.length);
  if (diff) {
    console.log("首次差异位置 (0-based):", diff.index);
    if (diff.charA != null) console.log("远端该处字符 (code):", diff.codeA, "当前:", diff.codeB);
    console.log("差异附近上下文:", JSON.stringify(diff.context));
  }
  process.exit(1);
}

main();
