


import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { AuditReport } from './components/AuditReport';
import { callExecuteFullReview } from './services/gemini';
import { mergeAiAttemptUpdates } from './services/mergeAiAttemptUpdates';
import { buildAiAttemptTargets } from './src/audit_engine/ai_attempt_targets';
import { auth, db, storage, hasValidFirebaseConfig } from './services/firebase';
import { uploadPlanFiles, savePlanToFirestore, deletePlanFilesFromStorage, deletePlanFromFirestore, getPlansFromFirestore, loadPlanFilesFromStorage, subscribePlanDoc } from './services/planPersistence';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Plan, PlanStatus, TriageItem, FileMetaEntry } from './types';

/** Reconcile fileMeta when files change: keep meta for kept files, add 'additional' for new files */
function reconcileFileMeta(
  prevFiles: File[],
  newFiles: File[],
  prevMeta: FileMetaEntry[] | undefined,
  batchForNew: 'initial' | 'additional'
): FileMetaEntry[] {
  const prevNames = new Set(prevFiles.map(f => f.name));
  return newFiles.map(f => {
    const idx = prevFiles.findIndex(pf => pf.name === f.name);
    if (idx >= 0 && prevMeta?.[idx]) return prevMeta[idx];
    return { uploadedAt: Date.now(), batch: batchForNew };
  });
}

const App: React.FC = () => {
  // Global App State
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  // UI State: Create modal only for initial plan creation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  /** After AI Attempt completes, focus the AI Attempt tab so user sees the resolution table */
  const [focusTabAfterAction, setFocusTabAfterAction] = useState<'aiAttempt' | null>(null);
  const [createDraft, setCreateDraft] = useState<{ name: string; files: File[] }>({ name: "", files: [] });
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  // Login page state (参考 strata-tax-review-assistance 登录结构)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setFirebaseUser(u));
    return () => unsub();
  }, []);

  // Load plans from Firestore when user logs in (persistence across refresh)
  useEffect(() => {
    if (!firebaseUser || !hasValidFirebaseConfig) return;
    let cancelled = false;
    (async () => {
      try {
        const firestorePlans = await getPlansFromFirestore(db, firebaseUser.uid);
        if (cancelled) return;
        const mapped: Plan[] = firestorePlans.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          status: (p.status as PlanStatus) || 'idle',
          files: [],
          filePaths: p.filePaths,
          fileMeta: p.fileMeta ?? [],
          result: p.result ?? null,
          triage: p.triage ?? [],
          error: p.error ?? null,
        }));
        setPlans(mapped);
      } catch (err) {
        if (!cancelled) console.warn('Failed to load plans from Firestore:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [firebaseUser?.uid, hasValidFirebaseConfig]);

  // Derived Active Plan（必须在引用它的 useEffect 之前声明，避免 TDZ 错误）
  const activePlan = plans.find(p => p.id === activePlanId) || null;

  // Real-time sync: when active plan is updated in Firestore (e.g. by Cloud Function after refresh), merge into local state
  useEffect(() => {
    if (!activePlanId || !hasValidFirebaseConfig) return;
    const unsub = subscribePlanDoc(db, activePlanId, (docData) => {
      setPlans((prev) => {
        const idx = prev.findIndex((p) => p.id === activePlanId);
        if (idx < 0) return prev;
        const p = prev[idx];
        return prev.map((plan, i) =>
          i === idx
            ? {
                ...plan,
                status: (docData.status as PlanStatus) ?? plan.status,
                result: docData.result ?? plan.result,
                error: docData.error ?? plan.error,
              }
            : plan
        );
      });
    });
    return unsub;
  }, [activePlanId, hasValidFirebaseConfig]);

  // Load files from Storage when user selects a plan that has filePaths but no local files (e.g. after refresh)
  useEffect(() => {
    if (!firebaseUser || !activePlan?.filePaths?.length || activePlan.files.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadPlanFilesFromStorage(storage, activePlan.filePaths!);
        if (!cancelled && loaded.length > 0) {
          const meta = activePlan.fileMeta && activePlan.fileMeta.length === loaded.length
            ? activePlan.fileMeta
            : loaded.map(() => ({ uploadedAt: activePlan!.createdAt, batch: "initial" as const }));
          updatePlan(activePlan.id, { files: loaded, fileMeta: meta });
        }
      } catch (_) {
        // Ignore load errors
      }
    })();
    return () => { cancelled = true; };
  }, [firebaseUser?.uid, activePlanId, activePlan?.id, activePlan?.filePaths?.length, activePlan?.files.length]);

  // --- PLAN MANAGEMENT HELPERS ---

  const createPlan = (initialFiles: File[] = [], name?: string): string => {
    const newPlan: Plan = {
      id: crypto.randomUUID(),
      name: name || (initialFiles.length > 0 ? initialFiles[0].name.split('.')[0] : `Audit Plan ${plans.length + 1}`),
      createdAt: Date.now(),
      status: 'idle',
      files: initialFiles,
      result: null,
      triage: [],
      error: null,
    };
    setPlans((prev) => [...prev, newPlan]);
    return newPlan.id;
  };

  const handleCreatePlanConfirm = async () => {
    const { name, files } = createDraft;
    if (!firebaseUser || files.length === 0) return;
    const planName = name.trim() || files[0]?.name.split('.')[0] || `Audit Plan ${plans.length + 1}`;
    const createdAt = Date.now();
    const id = createPlan(files, planName);
    setIsCreateModalOpen(false);
    setCreateDraft({ name: "", files: [] });
    setActivePlanId(id);
    await savePlanToFirestore(db, id, {
      userId: firebaseUser.uid,
      name: planName,
      createdAt,
      status: "idle",
    });
    try {
      const filePaths = await uploadPlanFiles(storage, firebaseUser.uid, id, files);
      const fileMeta: FileMetaEntry[] = files.map(() => ({ uploadedAt: Date.now(), batch: "initial" }));
      await savePlanToFirestore(db, id, {
        userId: firebaseUser.uid,
        name: planName,
        createdAt,
        status: "idle",
        filePaths,
        fileMeta,
      });
      updatePlan(id, { filePaths, fileMeta });
    } catch (_) {
      updatePlan(id, { error: "Failed to save files." });
    }
  };

  const updatePlan = (id: string, updates: Partial<Plan>) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePlan = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (firebaseUser) {
      try {
        await deletePlanFilesFromStorage(storage, firebaseUser.uid, id);
      } catch (_) {
        // 目录不存在或已空时忽略
      }
      try {
        await deletePlanFromFirestore(db, id);
      } catch (_) {
        // 文档不存在时忽略
      }
    }
    setPlans(prev => prev.filter(p => p.id !== id));
    if (activePlanId === id) setActivePlanId(null);
  };

  // --- TRIAGE / FLAG HANDLER ---
  const handleTriage = (item: TriageItem, action: 'add' | 'remove') => {
    if (!activePlanId) return;
    
    setPlans(prev => prev.map(p => {
       if (p.id !== activePlanId) return p;
       
       if (action === 'add') {
         // Upsert based on rowId to allow editing
         const existing = p.triage.find(t => t.rowId === item.rowId);
         if (existing) {
            return {
               ...p,
               triage: p.triage.map(t => t.rowId === item.rowId ? item : t)
            };
         }
         return { ...p, triage: [...p.triage, item] };
       } else {
         return { ...p, triage: p.triage.filter(t => t.id !== item.id) };
       }
    }));
  };

  // --- LOGIC ENGINE EXECUTION ---

  /** Infer next step: call1 (Step 0), call2 (4 phases), aiAttempt (targeted re-verify), or done (after Phase 6) */
  const getNextStep = (plan: Plan): "call1" | "call2" | "aiAttempt" | "done" => {
    if (!plan.result?.document_register?.length) return "call1";
    const hasCall2 =
      (plan.result.levy_reconciliation != null && Object.keys(plan.result.levy_reconciliation?.master_table || {}).length > 0) ||
      (plan.result.assets_and_cash?.balance_sheet_verification?.length ?? 0) > 0 ||
      (plan.result.expense_samples?.length ?? 0) > 0;
    if (!hasCall2) return "call2";
    const hasCompletion = plan.result.completion_outputs != null;
    return hasCompletion ? "done" : "aiAttempt";
  };

  const handleNextStep = async (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    const step = getNextStep(plan);
    if (step === "call1") return handleRunStep0Only(planId);
    if (step === "call2") return handleRunCall2(planId);
    if (step === "aiAttempt") return handleRunAiAttempt(planId);
  };

  const handleRunCall2 = async (planId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;
    if (!firebaseUser) {
      updatePlan(planId, { error: "Please sign in to run the audit." });
      return;
    }
    if (targetPlan.files.length === 0) {
      updatePlan(planId, { error: "No evidence files found." });
      return;
    }
    const step0 = targetPlan.result;
    if (!step0?.document_register?.length || !step0?.intake_summary) {
      updatePlan(planId, { error: "Please run Step 0 first, then Call 2." });
      return;
    }
    updatePlan(planId, { status: "processing", error: null });
    await savePlanToFirestore(db, planId, { userId: firebaseUser.uid, name: targetPlan.name, createdAt: targetPlan.createdAt, status: "processing", error: null });
    setIsCreateModalOpen(false);
    const userId = firebaseUser.uid;
    const baseDoc = { userId, name: targetPlan.name, createdAt: targetPlan.createdAt };
    let filePaths: string[] = [];
    try {
      filePaths = await uploadPlanFiles(storage, userId, planId, targetPlan.files!);
      const runPhase = (phase: "levy" | "phase4" | "expenses" | "compliance") =>
        callExecuteFullReview({
          files: targetPlan.files,
          expectedPlanId: planId,
          mode: phase,
          step0Output: step0,
        });
      const [levyRes, phase4Res, expensesRes, complianceRes] = await Promise.all([
        runPhase("levy"),
        runPhase("phase4"),
        runPhase("expenses"),
        runPhase("compliance"),
      ]);
      const merged: typeof step0 = {
        ...step0,
        levy_reconciliation: levyRes.levy_reconciliation,
        assets_and_cash: phase4Res.assets_and_cash,
        expense_samples: expensesRes.expense_samples,
        statutory_compliance: complianceRes.statutory_compliance,
      };
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: "completed",
        filePaths,
        fileMeta: targetPlan.fileMeta,
        result: merged,
        triage: targetPlan.triage,
      });
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId ? { ...p, status: "completed" as const, result: merged } : p
        )
      );
    } catch (err: unknown) {
      const errMessage = (err as Error)?.message || "Call 2 Failed";
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: "failed",
        ...(filePaths.length > 0 ? { filePaths } : {}),
        fileMeta: targetPlan.fileMeta,
        error: errMessage,
      });
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId ? { ...p, status: "failed" as const, error: errMessage } : p
        )
      );
    }
  };

  const handleRunAiAttempt = async (planId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;
    if (!firebaseUser) {
      updatePlan(planId, { error: "Please sign in to run the audit." });
      return;
    }
    if (targetPlan.files.length === 0) {
      updatePlan(planId, { error: "No evidence files found." });
      return;
    }
    const mergedSoFar = targetPlan.result;
    if (!mergedSoFar?.document_register?.length || !mergedSoFar?.intake_summary) {
      updatePlan(planId, { error: "Please complete Step 0 and Call 2 before running AI Attempt." });
      return;
    }
    const hasCall2 =
      (mergedSoFar.levy_reconciliation != null && Object.keys(mergedSoFar.levy_reconciliation?.master_table || {}).length > 0) ||
      (mergedSoFar.assets_and_cash?.balance_sheet_verification?.length ?? 0) > 0 ||
      (mergedSoFar.expense_samples?.length ?? 0) > 0;
    if (!hasCall2) {
      updatePlan(planId, { error: "Please complete Call 2 before running AI Attempt." });
      return;
    }
    const targets = buildAiAttemptTargets(mergedSoFar, targetPlan.triage);
    if (targets.length === 0) {
      updatePlan(planId, { error: "No items to re-verify. Add items from System Identified Issues or Triage in the AI Attempt tab, then run." });
      return;
    }
    updatePlan(planId, { status: "processing", error: null });
    await savePlanToFirestore(db, planId, { userId: firebaseUser.uid, name: targetPlan.name, createdAt: targetPlan.createdAt, status: "processing", error: null });
    setIsCreateModalOpen(false);
    const userId = firebaseUser.uid;
    const baseDoc = { userId, name: targetPlan.name, createdAt: targetPlan.createdAt };
    try {
      const res = await callExecuteFullReview({
        files: targetPlan.files,
        expectedPlanId: planId,
        mode: "aiAttempt",
        step0Output: mergedSoFar,
        aiAttemptTargets: targets,
        fileMeta: targetPlan.fileMeta,
      });
      const resJson = res as { ai_attempt_updates?: unknown; ai_attempt_resolution_table?: unknown[] };
      const updates = resJson?.ai_attempt_updates;
      const merged = mergeAiAttemptUpdates(mergedSoFar, updates ?? null);
      if (Array.isArray(resJson?.ai_attempt_resolution_table) && resJson.ai_attempt_resolution_table.length > 0) {
        merged.ai_attempt_resolution_table = resJson.ai_attempt_resolution_table;
      } else {
        // Fallback: build resolution table from targets so user always sees what was processed
        merged.ai_attempt_resolution_table = targets.map((t) => ({
          item: t.description,
          issue_identified: t.source === "triage" ? "User flagged" : t.description,
          ai_attempt_conduct: "(Merged into report – see updated Levy/BS/Expense/Compliance sections)",
          result: "Patched",
          status: "–",
        }));
      }
      setFocusTabAfterAction("aiAttempt");
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: "completed",
        filePaths: targetPlan.filePaths ?? [],
        fileMeta: targetPlan.fileMeta,
        result: merged,
        triage: targetPlan.triage,
      });
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId ? { ...p, status: "completed" as const, result: merged } : p
        )
      );
    } catch (err: unknown) {
      const errMessage = (err as Error)?.message || "AI Attempt Failed";
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: "failed",
        filePaths: targetPlan.filePaths ?? [],
        fileMeta: targetPlan.fileMeta,
        error: errMessage,
      });
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId ? { ...p, status: "failed" as const, error: errMessage } : p
        )
      );
    }
  };

  const handleRunPhase6 = async (planId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;
    if (!firebaseUser) {
      updatePlan(planId, { error: "Please sign in to run the audit." });
      return;
    }
    if (targetPlan.files.length === 0) {
      updatePlan(planId, { error: "No evidence files found." });
      return;
    }
    const mergedSoFar = targetPlan.result;
    if (!mergedSoFar?.document_register?.length || !mergedSoFar?.intake_summary) {
      updatePlan(planId, { error: "Please complete Step 0 and Call 2 before running Phase 6." });
      return;
    }
    const hasCall2 =
      (mergedSoFar.levy_reconciliation != null && Object.keys(mergedSoFar.levy_reconciliation?.master_table || {}).length > 0) ||
      (mergedSoFar.assets_and_cash?.balance_sheet_verification?.length ?? 0) > 0 ||
      (mergedSoFar.expense_samples?.length ?? 0) > 0;
    if (!hasCall2) {
      updatePlan(planId, { error: "Please complete Call 2 (Levy, Balance Sheet, Expenses, Compliance) before running Phase 6." });
      return;
    }
    updatePlan(planId, { status: "processing", error: null });
    await savePlanToFirestore(db, planId, { userId: firebaseUser.uid, name: targetPlan.name, createdAt: targetPlan.createdAt, status: "processing", error: null });
    setIsCreateModalOpen(false);
    const userId = firebaseUser.uid;
    const baseDoc = { userId, name: targetPlan.name, createdAt: targetPlan.createdAt };
    try {
      const completionRes = await callExecuteFullReview({
        files: targetPlan.files,
        expectedPlanId: planId,
        mode: "completion",
        step0Output: mergedSoFar,
      });
      const finalMerged = { ...mergedSoFar, completion_outputs: completionRes.completion_outputs };
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: "completed",
        filePaths: targetPlan.filePaths ?? [],
        fileMeta: targetPlan.fileMeta,
        result: finalMerged,
        triage: targetPlan.triage,
      });
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId ? { ...p, status: "completed" as const, result: finalMerged } : p
        )
      );
    } catch (err: unknown) {
      const errMessage = (err as Error)?.message || "Phase 6 Failed";
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: "failed",
        filePaths: targetPlan.filePaths ?? [],
        fileMeta: targetPlan.fileMeta,
        error: errMessage,
      });
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId ? { ...p, status: "failed" as const, error: errMessage } : p
        )
      );
    }
  };

  const handleRunStep0Only = async (planId: string) => {
    const targetPlan = plans.find(p => p.id === planId);
    if (!targetPlan) return;
    if (!firebaseUser) {
      updatePlan(planId, { error: "Please sign in to run the audit." });
      return;
    }
    if (targetPlan.files.length === 0) {
      updatePlan(planId, { error: "No evidence files found." });
      return;
    }
    updatePlan(planId, { status: 'processing', error: null });
    await savePlanToFirestore(db, planId, { userId: firebaseUser.uid, name: targetPlan.name, createdAt: targetPlan.createdAt, status: 'processing', error: null });
    setIsCreateModalOpen(false);
    const userId = firebaseUser.uid;
    const baseDoc = { userId, name: targetPlan.name, createdAt: targetPlan.createdAt };
    let filePaths: string[] = [];
    try {
      filePaths = await uploadPlanFiles(storage, userId, planId, targetPlan.files);
      const auditResult = await callExecuteFullReview({
        files: targetPlan.files,
        expectedPlanId: planId,
        mode: 'step0_only',
      });
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: 'completed',
        filePaths,
        fileMeta: targetPlan.fileMeta,
        result: auditResult,
        triage: targetPlan.triage,
      });
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: 'completed' as const, result: auditResult } : p));
    } catch (err: unknown) {
      const errMessage = (err as Error)?.message || "Execution Failed";
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: 'failed',
        ...(filePaths.length > 0 ? { filePaths } : {}),
        fileMeta: targetPlan.fileMeta,
        error: errMessage,
      });
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, status: 'failed' as const, error: errMessage } : p));
    }
  };

  const handleRunAudit = async (planId: string) => {
    const targetPlan = plans.find(p => p.id === planId);
    if (!targetPlan) return;

    if (!firebaseUser) {
      updatePlan(planId, { error: "Please sign in to run the audit." });
      return;
    }
    if (targetPlan.files.length === 0) {
      updatePlan(planId, { error: "No evidence files found." });
      return;
    }

    updatePlan(planId, { status: 'processing', error: null });
    await savePlanToFirestore(db, planId, { userId: firebaseUser.uid, name: targetPlan.name, createdAt: targetPlan.createdAt, status: 'processing', error: null });
    setIsCreateModalOpen(false);

    const userId = firebaseUser.uid;
    const baseDoc = {
      userId,
      name: targetPlan.name,
      createdAt: targetPlan.createdAt,
    };
    let filePaths: string[] = [];

    try {
      filePaths = await uploadPlanFiles(storage, userId, planId, targetPlan.files);

      // 2) 调用 Cloud Function 执行审计
      const auditResult = await callExecuteFullReview({
        files: targetPlan.files,
        previousAudit: targetPlan.result ?? undefined,
        expectedPlanId: planId,
      });

      // 3) 将 AI 结果与 filePaths 写入 Firestore
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: 'completed',
        filePaths,
        fileMeta: targetPlan.fileMeta,
        result: auditResult,
        triage: targetPlan.triage,
      });

      setPlans(currentPlans => {
         const currentPlan = currentPlans.find(p => p.id === planId);
         if (currentPlan && currentPlan.status === 'processing') {
             return currentPlans.map(p => p.id === planId ? { ...p, status: 'completed', result: auditResult } : p);
         }
         return currentPlans;
      });
    } catch (err: any) {
      const errMessage = err?.message || "Execution Failed";
      await savePlanToFirestore(db, planId, {
        ...baseDoc,
        status: 'failed',
        ...(filePaths.length > 0 ? { filePaths } : {}),
        fileMeta: targetPlan.fileMeta,
        error: errMessage,
      });
      setPlans(currentPlans => {
         const currentPlan = currentPlans.find(p => p.id === planId);
         if (currentPlan && currentPlan.status !== 'idle') {
             return currentPlans.map(p => p.id === planId ? { ...p, status: 'failed', error: errMessage } : p);
         }
         return currentPlans;
      });
    }
  };

  // --- GLOBAL DRAG & DROP HANDLERS ---
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) setIsDragging(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current === 0) setIsDragging(false);
    };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    
    const handleDrop = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const newFiles = Array.from(e.dataTransfer.files).filter(f => 
             f.name.match(/\.(pdf|xlsx|csv)$/i) || f.type.includes('pdf') || f.type.includes('sheet') || f.type.includes('csv')
        );
        
        if (newFiles.length > 0) {
            if (activePlanId && activePlan) {
                const currentFiles = activePlan.files || [];
                const currentMeta = activePlan.fileMeta || [];
                const addedMeta: FileMetaEntry[] = newFiles.map(() => ({ uploadedAt: Date.now(), batch: "additional" }));
                updatePlan(activePlanId, {
                  files: [...currentFiles, ...newFiles],
                  fileMeta: [...currentMeta, ...addedMeta],
                });
            } else {
                setCreateDraft((d) => ({
                  name: d.name || newFiles[0]?.name.split('.')[0] || "",
                  files: [...(d.files || []), ...newFiles],
                }));
                setIsCreateModalOpen(true);
            }
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [activePlanId, activePlan, plans]); // Re-bind if active context changes

  // Helper to get triage counts
  const getTriageCount = (severity: string) => activePlan?.triage.filter(t => t.severity === severity).length || 0;

  // --- 登录门控：未登录时显示登录页（风格对齐 strata-tax-review-assistance） ---
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!loginEmail.trim() || !loginPassword) {
      setAuthError(isSignUp ? 'Please enter email and password to sign up' : 'Please enter email and password');
      return;
    }
    setAuthLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      } else {
        await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      }
    } catch (err: any) {
      setAuthError(err?.message || (isSignUp ? 'Sign up failed' : 'Sign in failed'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      setAuthError(err?.message || 'Google sign-in failed');
    } finally {
      setAuthLoading(false);
    }
  };

  if (!firebaseUser) {
    return (
      <div className="flex h-screen bg-[#111] text-white font-sans items-center justify-center p-4">
        <div className="w-full max-w-[400px]">
          {/* Brand：与侧栏一致 */}
          <div className="flex items-center gap-3 justify-center mb-10">
            <div className="h-10 w-10 bg-[#C5A059] flex items-center justify-center font-bold text-black rounded-sm shrink-0 text-section">S</div>
            <div className="text-left">
              <h1 className="text-body font-bold tracking-widest uppercase leading-none">Strata</h1>
              <h1 className="text-body font-bold tracking-widest uppercase text-[#C5A059] leading-none">Audit Engine</h1>
            </div>
          </div>

          {!hasValidFirebaseConfig && (
            <div className="mb-6 p-4 bg-amber-900/30 border border-amber-600/50 rounded-sm text-amber-200 text-caption uppercase tracking-wide">
              Firebase not configured. Add VITE_FIREBASE_* to .env in project root, then run npm run build and redeploy.
            </div>
          )}

          {/* Sign In 卡片 */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-8 shadow-xl">
            <h2 className="text-caption font-bold text-gray-400 uppercase tracking-widest mb-6">Sign In</h2>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-micro font-bold text-gray-500 uppercase tracking-wider mb-2">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setAuthError(''); }}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-[#0d0d0d] border border-gray-700 rounded-sm text-body text-white placeholder-gray-500 focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-micro font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => { setLoginPassword(e.target.value); setAuthError(''); }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-[#0d0d0d] border border-gray-700 rounded-sm text-body text-white placeholder-gray-500 focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] focus:outline-none transition-colors"
                />
              </div>
              {authError && (
                <p className="text-label text-red-400 font-medium">{authError}</p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-[#C5A059] hover:bg-[#A08040] disabled:opacity-50 text-black font-bold py-3 px-6 rounded-sm uppercase tracking-wider text-caption transition-colors"
              >
                {authLoading ? '…' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
              className="mt-3 text-label text-gray-500 hover:text-[#C5A059] transition-colors uppercase tracking-wide"
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Create one'}
            </button>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-micro font-bold text-gray-600 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full border border-gray-600 hover:border-[#C5A059] text-gray-300 hover:text-white font-bold py-3 px-6 rounded-sm uppercase tracking-wider text-caption transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>
          </div>

          <p className="mt-6 text-micro text-gray-600 text-center uppercase tracking-wide">
            Enable Email/Password and Google in Firebase Console → Authentication before first use.
            {!hasValidFirebaseConfig && ' If the page is blank, ensure .env has VITE_FIREBASE_* configured and rebuild before deploy.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FAFAFA] text-[#111111] font-sans overflow-hidden relative">
      
      {/* --- GLOBAL DRAG OVERLAY --- */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in m-4 rounded-xl border-4 border-dashed border-[#C5A059] shadow-2xl pointer-events-none">
           <div className="bg-[#C5A059] p-6 rounded-full mb-6 shadow-lg shadow-[#C5A059]/50 animate-bounce">
              <svg className="w-16 h-16 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12"></path></svg>
           </div>
           <h2 className="text-title font-bold text-white uppercase tracking-widest mb-2">
             {activePlanId ? "Add Evidence to Plan" : "Create New Audit Plan"}
           </h2>
           <p className="text-[#C5A059] font-medium tracking-wide">Release files to ingest</p>
        </div>
      )}
      
      {/* --- SIDEBAR NAVIGATION --- */}
      <aside className="w-72 bg-[#111] text-white flex flex-col shrink-0 border-r border-gray-800 relative z-20 shadow-xl">
        {/* Brand */}
        <div className="p-6 border-b border-gray-800 flex items-center gap-3">
           <div className="h-8 w-8 bg-[#C5A059] flex items-center justify-center font-bold text-black rounded-sm shrink-0">S</div>
           <div>
             <h1 className="text-body font-bold tracking-widest uppercase leading-none">Strata</h1>
             <h1 className="text-body font-bold tracking-widest uppercase text-[#C5A059] leading-none">Audit Engine</h1>
           </div>
        </div>

        {/* Global Nav */}
        <div className="px-4 py-4 border-b border-gray-800">
             <button 
               onClick={() => setActivePlanId(null)}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm transition-all text-body font-semibold ${activePlanId === null ? 'bg-[#C5A059] text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                Plan Dashboard
             </button>
        </div>

        {/* Plan List (Project Manager) */}
        <div className="px-6 py-6 flex-1 overflow-y-auto custom-scrollbar">
           
           {!activePlan && (
             <div className="mb-6">
               <div className="flex justify-between items-center mb-3">
                  <h3 className="text-body font-semibold text-gray-500">Your Projects</h3>
                  <span className="text-body font-semibold bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{plans.length}</span>
               </div>
               
               <div className="space-y-1">
                  {plans.length === 0 && <div className="text-body text-gray-600 italic py-2">No active plans.</div>}
                  {plans.map(plan => (
                     <div 
                       key={plan.id}
                       onClick={() => setActivePlanId(plan.id)}
                       className={`group flex items-center gap-3 p-2 rounded cursor-pointer transition-colors border-l-2 border-transparent hover:bg-white/5`}
                     >
                        <div className="relative">
                           <div className={`w-2 h-2 rounded-full ${
                              plan.status === 'completed' ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]' :
                              plan.status === 'processing' ? 'bg-yellow-400 animate-pulse shadow-[0_0_5px_rgba(250,204,21,0.8)]' :
                              plan.status === 'failed' ? 'bg-red-500' : 'bg-gray-600'
                           }`}></div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                           <div className={`text-body font-semibold leading-tight truncate text-gray-400 group-hover:text-gray-200`}>{plan.name}</div>
                        </div>
                     </div>
                  ))}
               </div>
             </div>
           )}

           {/* TRIAGE SECTION (Only if Plan Active) */}
           {activePlan && (
             <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                   <h3 className="text-body font-semibold text-[#C5A059]">Triage Dashboard</h3>
                   <span className="text-body font-semibold text-white bg-red-600/20 px-1.5 rounded text-red-500">{activePlan.triage.length}</span>
                </div>
                
                {activePlan.triage.length === 0 ? (
                    <div className="text-center py-10 opacity-30">
                       <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                       <p className="text-body font-semibold">All Clean</p>
                       <p className="text-body text-gray-400">Hover rows to flag issues</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                       {/* CRITICAL */}
                       {getTriageCount('critical') > 0 && (
                          <div>
                             <h4 className="text-body font-semibold text-red-500 mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> Critical ({getTriageCount('critical')})
                             </h4>
                             <div className="space-y-2">
                                {activePlan.triage.filter(t => t.severity === 'critical').map(t => (
                                   <div key={t.id} className="bg-red-900/20 border-l-2 border-red-500 p-2 rounded-r hover:bg-red-900/40 cursor-pointer group relative">
                                       <button onClick={(e) => { e.stopPropagation(); handleTriage(t, 'remove'); }} className="absolute top-1 right-1 text-red-500 opacity-0 group-hover:opacity-100 text-body hover:text-white">✕</button>
                                       <div className="text-body font-semibold text-red-200 truncate mb-1">{t.title}</div>
                                       <div className="text-body text-gray-400 leading-snug line-clamp-2">{t.comment}</div>
                                       <div className="mt-1 text-caption text-gray-600 font-mono">{t.tab}</div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}

                       {/* MEDIUM */}
                       {getTriageCount('medium') > 0 && (
                          <div>
                             <h4 className="text-body font-semibold text-yellow-500 mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span> Medium ({getTriageCount('medium')})
                             </h4>
                             <div className="space-y-2">
                                {activePlan.triage.filter(t => t.severity === 'medium').map(t => (
                                   <div key={t.id} className="bg-yellow-900/10 border-l-2 border-yellow-500 p-2 rounded-r hover:bg-yellow-900/20 cursor-pointer group relative">
                                       <button onClick={(e) => { e.stopPropagation(); handleTriage(t, 'remove'); }} className="absolute top-1 right-1 text-yellow-500 opacity-0 group-hover:opacity-100 text-body hover:text-white">✕</button>
                                       <div className="text-body font-semibold text-yellow-200 truncate mb-1">{t.title}</div>
                                       <div className="text-body text-gray-400 leading-snug line-clamp-2">{t.comment}</div>
                                       <div className="mt-1 text-caption text-gray-600 font-mono">{t.tab}</div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}

                       {/* LOW */}
                       {getTriageCount('low') > 0 && (
                          <div>
                             <h4 className="text-body font-semibold text-blue-400 mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span> Low ({getTriageCount('low')})
                             </h4>
                             <div className="space-y-2">
                                {activePlan.triage.filter(t => t.severity === 'low').map(t => (
                                   <div key={t.id} className="bg-blue-900/10 border-l-2 border-blue-400 p-2 rounded-r hover:bg-blue-900/20 cursor-pointer group relative">
                                       <button onClick={(e) => { e.stopPropagation(); handleTriage(t, 'remove'); }} className="absolute top-1 right-1 text-blue-400 opacity-0 group-hover:opacity-100 text-body hover:text-white">✕</button>
                                       <div className="text-body font-semibold text-blue-200 truncate mb-1">{t.title}</div>
                                       <div className="text-body text-gray-400 leading-snug line-clamp-2">{t.comment}</div>
                                       <div className="mt-1 text-caption text-gray-600 font-mono">{t.tab}</div>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}
                    </div>
                )}
             </div>
           )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-gray-800 text-body font-semibold text-gray-600">
           <button
             onClick={() => {
               setCreateDraft({ name: "", files: [] });
               setIsCreateModalOpen(true);
             }}
             className="w-full mb-4 border border-gray-700 hover:border-[#C5A059] text-gray-400 hover:text-[#C5A059] py-2 rounded-sm transition-colors flex items-center justify-center gap-2 text-body font-semibold"
           >
              <span>+</span> New Plan
           </button>
           {firebaseUser ? (
             <div className="mb-4 space-y-2">
               <div className="text-body text-gray-500 truncate" title={firebaseUser.email ?? undefined}>{firebaseUser.email ?? firebaseUser.uid}</div>
               <button onClick={() => signOut(auth)} className="w-full border border-gray-700 hover:border-red-500 text-gray-400 hover:text-red-400 py-1.5 rounded-sm transition-colors text-body font-semibold">Sign Out</button>
             </div>
           ) : (
             <button onClick={async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { console.error('Sign in failed', e); } }} className="w-full mb-4 border border-[#C5A059] text-[#C5A059] hover:bg-[#C5A059] hover:text-black py-2 rounded-sm transition-colors text-body font-semibold">Sign in (Cloud Engine)</button>
           )}
           <div className="flex justify-between">
              <span>Kernel v2.0</span>
              <span className={firebaseUser ? "text-green-600" : "text-gray-600"}>{firebaseUser ? "Cloud Ready" : "Sign in"}</span>
           </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 overflow-y-auto h-full relative scroll-smooth bg-[#FAFAFA]">
        
        {/* --- VIEW: PLAN DASHBOARD (When no active plan) --- */}
        {!activePlanId && (
           <div className="max-w-[1600px] mx-auto p-10 animate-fade-in">
              <div className="flex justify-between items-end mb-10 border-b border-gray-200 pb-6">
                 <div>
                    <h2 className="text-title font-bold text-black tracking-tight mb-2">Audit Dashboard</h2>
                    <p className="text-gray-500 text-body">Manage multiple concurrent audit sessions.</p>
                 </div>
                 <div className="text-right">
                    <span className="text-caption font-bold text-gray-400 uppercase tracking-widest">System Status</span>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                       <span className="text-body font-mono text-gray-700">KERNEL ONLINE</span>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {/* Create New Card */}
                 <button
                   onClick={() => {
                     setCreateDraft({ name: "", files: [] });
                     setIsCreateModalOpen(true);
                   }}
                   className="group min-h-[240px] border-2 border-dashed border-gray-300 hover:border-[#C5A059] rounded-lg flex flex-col items-center justify-center p-6 transition-all hover:bg-white hover:shadow-lg"
                 >
                    <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-[#C5A059] text-gray-400 group-hover:text-black flex items-center justify-center mb-4 transition-colors">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    </div>
                    <span className="font-bold text-gray-600 group-hover:text-black uppercase tracking-wider text-body">Create New Plan</span>
                 </button>

                 {/* Plan Cards */}
                 {plans.map(plan => (
                    <div 
                      key={plan.id}
                      onClick={() => setActivePlanId(plan.id)}
                      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between min-h-[240px] cursor-pointer relative group"
                    >
                       <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => deletePlan(plan.id, e)}
                            className="text-gray-300 hover:text-red-500 p-1"
                          >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                       </div>

                       <div>
                          <div className="flex items-center gap-2 mb-3">
                             <div className={`w-2 h-2 rounded-full ${
                                plan.status === 'completed' ? 'bg-green-500' :
                                plan.status === 'processing' ? 'bg-yellow-400 animate-pulse' :
                                plan.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
                             }`}></div>
                             <span className="text-micro font-bold uppercase tracking-widest text-gray-500">{plan.status}</span>
                          </div>
                          <h3 className="text-xl font-bold text-black leading-tight mb-2 line-clamp-2">{plan.name}</h3>
                          <p className="text-caption text-gray-500">{new Date(plan.createdAt).toLocaleDateString()} • {(plan.filePaths?.length ?? plan.files.length) || 0} Files</p>
                       </div>

                       <div className="mt-4 pt-4 border-t border-gray-100">
                          {plan.result ? (
                             <div className="flex justify-between items-center">
                                <span className="text-caption font-bold text-gray-600">Traceable Items</span>
                                <span className="text-section font-mono font-bold text-[#C5A059]">
                                   {(plan.result.expense_samples?.length || 0) + (Object.keys(plan.result.levy_reconciliation?.master_table || {}).length)}
                                </span>
                             </div>
                          ) : plan.status === 'failed' && plan.error ? (
                             <div className="text-caption text-red-600 line-clamp-2" title={plan.error}>{plan.error}</div>
                          ) : (
                             <div className="text-caption text-gray-400 italic">No verification data yet.</div>
                          )}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {/* --- VIEW: UNIFIED PLAN INTERFACE --- */}
        {activePlan && (
           <div className="max-w-[1600px] mx-auto p-10 animate-fade-in flex flex-col min-h-0">
              {/* Fixed Header: Plan name + Next Step button */}
              <div className="flex items-center justify-between gap-4 pb-6 border-b border-gray-200 shrink-0 flex-wrap">
                 <div className="flex items-center gap-4 min-w-0">
                    <input
                      value={activePlan.name}
                      onChange={(e) => updatePlan(activePlan.id, { name: e.target.value })}
                      className="text-title font-bold text-black tracking-tight bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-[#C5A059] focus:outline-none px-1 py-0.5 -ml-1"
                    />
                    {activePlan.result?.intake_summary?.status && (
                      <span className="text-caption font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded shrink-0">
                        {activePlan.result.intake_summary.status}
                      </span>
                    )}
                 </div>
                 <div className="shrink-0 flex items-center gap-3">
                   {/* Next Step: Step 0, Call 2, or Run AI Attempt (targeted re-verification) */}
                   <button
                     onClick={() => handleNextStep(activePlan.id)}
                     disabled={
                       !firebaseUser ||
                       activePlan.files.length === 0 ||
                       activePlan.status === "processing" ||
                       (getNextStep(activePlan) === "call2" && !activePlan.result?.document_register?.length) ||
                       getNextStep(activePlan) === "done" ||
                       (getNextStep(activePlan) === "aiAttempt" && buildAiAttemptTargets(activePlan.result ?? null, activePlan.triage).length === 0)
                     }
                     className={`px-6 py-3 font-bold text-caption uppercase tracking-widest rounded-sm border-2 transition-all focus:outline-none ${
                       !firebaseUser ||
                       activePlan.files.length === 0 ||
                       activePlan.status === "processing" ||
                       (getNextStep(activePlan) === "call2" && !activePlan.result?.document_register?.length) ||
                       getNextStep(activePlan) === "done" ||
                       (getNextStep(activePlan) === "aiAttempt" && buildAiAttemptTargets(activePlan.result ?? null, activePlan.triage).length === 0)
                         ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                         : "bg-[#C5A059] border-[#C5A059] text-black hover:bg-[#A08040] hover:border-[#A08040]"
                     }`}
                   >
                     {getNextStep(activePlan) === "aiAttempt" ? "Run AI Attempt" : "Next Step"}
                   </button>
                   {/* Proceed with Completion: Phase 6 (only when in AI Attempt state) */}
                   {getNextStep(activePlan) === "aiAttempt" && (
                     <button
                       onClick={() => handleRunPhase6(activePlan.id)}
                       disabled={
                         !firebaseUser ||
                         activePlan.files.length === 0 ||
                         activePlan.status === "processing"
                       }
                       className={`px-6 py-3 font-bold text-caption uppercase tracking-widest rounded-sm border-2 transition-all focus:outline-none ${
                         !firebaseUser || activePlan.files.length === 0 || activePlan.status === "processing"
                           ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                           : "bg-[#2d5a27] border-[#2d5a27] text-white hover:bg-[#234a20] hover:border-[#234a20]"
                       }`}
                     >
                       Proceed with Completion
                     </button>
                   )}
                 </div>
              </div>

              {/* Error banner */}
              {activePlan.status === "failed" && activePlan.error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-800 text-caption">
                  {activePlan.error}
                </div>
              )}

              {/* Processing banner – non-blocking; main UI (files, report) stays visible */}
              {activePlan.status === "processing" && (
                <div className="mt-4 p-4 bg-[#111] rounded border border-[#333] flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 shrink-0">
                      <div className="w-10 h-10 border-2 border-[#333] rounded-full" />
                      <div className="w-10 h-10 border-2 border-t-[#C5A059] border-r-transparent border-b-transparent border-l-transparent rounded-full absolute top-0 left-0 animate-spin" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-body uppercase tracking-wide">Processing Audit Logic</p>
                      <p className="text-gray-500 text-caption">{activePlan.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActivePlanId(null)}
                    className="shrink-0 bg-[#C5A059] hover:bg-[#A08040] text-black font-bold py-2 px-5 rounded text-caption uppercase tracking-wider transition-colors"
                  >
                    Run in Background
                  </button>
                </div>
              )}

              {/* Files section (collapsible with timeline) */}
              <details className="mt-6 shrink-0 group" open>
                <summary className="cursor-pointer text-caption font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2 hover:text-[#C5A059] transition-colors p-3 bg-white border border-gray-200 rounded">
                  <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                  <span>Evidence Files ({activePlan.files.length})</span>
                  <span className="text-micro text-gray-400 font-normal ml-2">Click to expand/collapse</span>
                </summary>
                <div className="mt-4 p-4 bg-white rounded border border-gray-200">
                  <FileUpload
                    onFilesSelected={(newFiles) => {
                      const newMeta = reconcileFileMeta(activePlan.files, newFiles, activePlan.fileMeta, "additional");
                      updatePlan(activePlan.id, { files: newFiles, fileMeta: newMeta });
                    }}
                    selectedFiles={activePlan.files}
                    fileMeta={activePlan.fileMeta}
                    planCreatedAt={activePlan.createdAt}
                  />
                </div>
              </details>

              {/* Report or empty state */}
              <div className="mt-8 flex-1 min-h-0">
                {activePlan.result ? (
                  <AuditReport
                    data={activePlan.result}
                    files={activePlan.files}
                    triageItems={activePlan.triage}
                    onTriage={handleTriage}
                    focusTab={focusTabAfterAction ?? undefined}
                    onFocusTabConsumed={() => setFocusTabAfterAction(null)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <svg className="w-16 h-16 mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-caption font-bold uppercase tracking-widest">No report yet</p>
                    <p className="text-caption mt-1 text-gray-500">Upload files above, then click Next Step to run.</p>
                  </div>
                )}
              </div>
           </div>
        )}
      </main>

      {/* --- CREATE NEW PLAN MODAL --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-black text-white px-8 py-6 flex justify-between items-center shrink-0 border-b border-gray-800">
              <h2 className="text-xl font-bold uppercase tracking-widest">Create New Plan</h2>
              <button onClick={() => { setIsCreateModalOpen(false); setCreateDraft({ name: "", files: [] }); }} className="text-gray-500 hover:text-white transition-colors p-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-8 overflow-y-auto bg-gray-50 space-y-6">
              <div>
                <label className="block text-caption font-bold text-gray-400 uppercase tracking-wide mb-2">Plan Name</label>
                <input
                  type="text"
                  value={createDraft.name}
                  onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder={createDraft.files[0]?.name.split('.')[0] || "e.g. SP 12345 Audit"}
                  className="w-full px-4 py-3 border border-gray-300 rounded text-body focus:border-[#C5A059] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-caption font-bold text-gray-400 uppercase tracking-wide mb-2">Evidence Files</label>
                <FileUpload
                  onFilesSelected={(files) => setCreateDraft((d) => ({ ...d, files }))}
                  selectedFiles={createDraft.files}
                />
              </div>
            </div>
            <div className="bg-white px-8 py-6 border-t border-gray-200 flex justify-end gap-4 shrink-0">
              <button
                onClick={() => { setIsCreateModalOpen(false); setCreateDraft({ name: "", files: [] }); }}
                className="px-6 py-3 font-bold text-gray-500 uppercase tracking-widest text-caption hover:text-black transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlanConfirm}
                disabled={!firebaseUser || createDraft.files.length === 0}
                className="px-8 py-3 font-bold text-caption uppercase tracking-widest rounded-sm bg-[#C5A059] text-black hover:bg-[#A08040] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create & Open
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
