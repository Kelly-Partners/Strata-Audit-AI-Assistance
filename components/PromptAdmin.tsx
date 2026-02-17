import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { callExecuteFullReview } from '../services/auditApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptAdminProps {
  onSave?: (phase: string, content: string, thresholds: Record<string, number>) => void;
}

interface PhaseOption {
  key: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHASES: PhaseOption[] = [
  { key: 'kernel_constitution', label: 'Constitution & Hierarchy' },
  { key: 'kernel_evidence_rules', label: 'Evidence Rules' },
  { key: 'step_0_intake', label: 'Step 0 Document Intake' },
  { key: 'phase_1_verify', label: 'Phase 1 Verification' },
  { key: 'phase_2_revenue', label: 'Phase 2 Revenue/Levy' },
  { key: 'phase_3_expenses', label: 'Phase 3 Expenses' },
  { key: 'phase_4_assets', label: 'Phase 4 Assets' },
  { key: 'phase_5_compliance', label: 'Phase 5 Compliance' },
  { key: 'phase_6_completion', label: 'Phase 6 Completion' },
  { key: 'phase_ai_attempt', label: 'AI Attempt' },
  { key: 'module_50_outputs', label: 'Output Schema' },
];

const DEFAULT_THRESHOLDS: Record<string, { label: string; value: number; suffix: string }> = {
  expense_materiality: { label: 'Expense Materiality', value: 5000, suffix: '$' },
  anomaly_flag: { label: 'Anomaly Flag', value: 1000, suffix: '$' },
  variance_tolerance: { label: 'Variance Tolerance', value: 1.0, suffix: '$' },
  rounding_threshold: { label: 'Rounding Threshold', value: 1.0, suffix: '$' },
  gst_rate: { label: 'GST Rate', value: 10, suffix: '%' },
  payment_date_tolerance: { label: 'Payment Date Tolerance', value: 14, suffix: 'days' },
  payment_amount_match: { label: 'Payment Amount Match', value: 10, suffix: '$' },
};

// Default placeholder prompt content for each phase
const DEFAULT_PROMPT_CONTENT: Record<string, string> = PHASES.reduce(
  (acc, phase) => {
    acc[phase.key] = `# ${phase.label}\n# Phase: ${phase.key}\n#\n# Edit this prompt to customise the audit behaviour for this phase.\n# The content here will be sent as the system prompt when this phase executes.\n\n`;
    return acc;
  },
  {} as Record<string, string>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PromptAdmin: React.FC<PromptAdminProps> = ({ onSave }) => {
  // --- Phase selector state ---
  const [selectedPhase, setSelectedPhase] = useState<string>(PHASES[0].key);

  // --- Prompt content per phase (lazy-populated from defaults) ---
  const [promptContents, setPromptContents] = useState<Record<string, string>>(
    () => ({ ...DEFAULT_PROMPT_CONTENT })
  );

  // --- Threshold values ---
  const [thresholds, setThresholds] = useState<Record<string, number>>(() =>
    Object.entries(DEFAULT_THRESHOLDS).reduce(
      (acc, [key, def]) => {
        acc[key] = def.value;
        return acc;
      },
      {} as Record<string, number>
    )
  );

  // --- Test runner state ---
  const [testFiles, setTestFiles] = useState<File[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Save confirmation flash ---
  const [saveFlash, setSaveFlash] = useState(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const currentContent = promptContents[selectedPhase] ?? '';

  const handleEditorChange = (value: string | undefined) => {
    setPromptContents((prev) => ({
      ...prev,
      [selectedPhase]: value ?? '',
    }));
  };

  const handleThresholdChange = (key: string, raw: string) => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      setThresholds((prev) => ({ ...prev, [key]: parsed }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setTestFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeTestFile = (index: number) => {
    setTestFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRunTest = async () => {
    if (testFiles.length === 0) {
      setTestError('Upload at least one test file before running.');
      return;
    }
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    try {
      const result = await callExecuteFullReview({
        files: testFiles,
        mode: 'full',
      });
      setTestResult(JSON.stringify(result, null, 2));
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Test execution failed.';
      setTestError(message);
    } finally {
      setTestLoading(false);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(selectedPhase, currentContent, thresholds);
    }
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  const selectedPhaseLabel =
    PHASES.find((p) => p.key === selectedPhase)?.label ?? selectedPhase;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#111] text-white font-sans">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-gray-800 px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 bg-[#C5A059] flex items-center justify-center font-bold text-black rounded-sm shrink-0 text-base">
            S
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-widest uppercase text-gray-400">
              Strata Audit Engine
            </h1>
            <h2 className="text-sm font-bold tracking-widest uppercase text-[#C5A059]">
              Prompt Admin &amp; Playground
            </h2>
          </div>
        </div>
        <button
          onClick={handleSave}
          className={`px-8 py-3 font-bold text-xs uppercase tracking-widest rounded-sm transition-all focus:outline-none ${
            saveFlash
              ? 'bg-green-600 border-2 border-green-500 text-white'
              : 'bg-[#C5A059] border-2 border-[#C5A059] text-black hover:bg-[#A08040] hover:border-[#A08040]'
          }`}
        >
          {saveFlash ? 'Saved' : 'Save & Activate'}
        </button>
      </header>

      <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-8">
        {/* ---------------------------------------------------------------- */}
        {/* Phase Selector                                                    */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-6">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
            Audit Phase
          </label>
          <select
            value={selectedPhase}
            onChange={(e) => setSelectedPhase(e.target.value)}
            className="w-full max-w-md px-4 py-3 bg-[#0d0d0d] border border-gray-700 rounded-sm text-sm text-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] focus:outline-none transition-colors appearance-none cursor-pointer"
          >
            {PHASES.map((phase) => (
              <option key={phase.key} value={phase.key}>
                {phase.key} &mdash; {phase.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-600">
            Editing prompt for:{' '}
            <span className="text-[#C5A059] font-semibold">{selectedPhaseLabel}</span>
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Monaco Editor                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-[#1a1a1a] border border-gray-800 rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Prompt Editor
            </h3>
            <span className="text-[10px] font-mono text-gray-600">
              {selectedPhase}
            </span>
          </div>
          <Editor
            height="500px"
            defaultLanguage="markdown"
            theme="vs-dark"
            value={currentContent}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
            }}
          />
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Threshold Controls                                                */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-6">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">
            Threshold Controls
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Object.entries(DEFAULT_THRESHOLDS).map(([key, def]) => (
              <div key={key} className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {def.label}
                </label>
                <div className="flex items-center gap-2">
                  {def.suffix === '$' && (
                    <span className="text-xs text-[#C5A059] font-bold">$</span>
                  )}
                  <input
                    type="number"
                    step={def.suffix === '%' || def.suffix === 'days' ? 1 : 0.01}
                    value={thresholds[key]}
                    onChange={(e) => handleThresholdChange(key, e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded-sm text-sm text-white font-mono focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] focus:outline-none transition-colors"
                  />
                  {def.suffix !== '$' && (
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                      {def.suffix}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Test Runner                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-[#1a1a1a] border border-gray-800 rounded-sm p-6">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">
            Test Runner
          </h3>

          {/* File upload area */}
          <div className="mb-6">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 block">
              Test Files
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-sm cursor-pointer bg-[#0d0d0d] hover:border-[#C5A059] hover:bg-[#0d0d0d]/80 transition-colors group"
            >
              <svg
                className="w-8 h-8 mb-2 text-gray-600 group-hover:text-[#C5A059] transition-colors"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 16"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                />
              </svg>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <span className="text-[#C5A059]">Click to upload</span> test PDFs
              </p>
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mt-1">
                PDF, XLSX, CSV
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* File list */}
            {testFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {testFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-[#0d0d0d] border border-gray-800 rounded-sm hover:border-[#C5A059] transition-colors group"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-[10px] bg-[#C5A059] text-black px-1.5 py-0.5 font-bold uppercase tracking-widest rounded-sm shrink-0">
                        {file.name.split('.').pop()?.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-300 font-medium truncate">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-gray-600 font-mono shrink-0">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      onClick={() => removeTestFile(index)}
                      className="text-gray-600 hover:text-red-500 p-1 transition-colors shrink-0 ml-2"
                      title="Remove file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Run Test button */}
          <button
            onClick={handleRunTest}
            disabled={testLoading || testFiles.length === 0}
            className={`px-8 py-3 font-bold text-xs uppercase tracking-widest rounded-sm border-2 transition-all focus:outline-none ${
              testLoading || testFiles.length === 0
                ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-[#C5A059] border-[#C5A059] text-black hover:bg-[#A08040] hover:border-[#A08040]'
            }`}
          >
            {testLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Running...
              </span>
            ) : (
              'Run Test'
            )}
          </button>

          {/* Error display */}
          {testError && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-sm">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                  Test Failed
                </span>
              </div>
              <p className="text-xs text-red-300 font-mono break-all">{testError}</p>
            </div>
          )}

          {/* Loading indicator (inline spinner for long-running tests) */}
          {testLoading && (
            <div className="mt-4 p-4 bg-[#0d0d0d] border border-gray-800 rounded-sm flex items-center gap-4">
              <div className="relative w-8 h-8 shrink-0">
                <div className="w-8 h-8 border-2 border-gray-800 rounded-full" />
                <div className="w-8 h-8 border-2 border-t-[#C5A059] border-r-transparent border-b-transparent border-l-transparent rounded-full absolute top-0 left-0 animate-spin" />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider">
                  Processing Audit Logic
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Executing with edited prompt against {testFiles.length} test file
                  {testFiles.length !== 1 ? 's' : ''}...
                </p>
              </div>
            </div>
          )}

          {/* Result output */}
          {testResult && !testLoading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Response JSON
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(testResult);
                  }}
                  className="text-[10px] font-bold text-gray-600 hover:text-[#C5A059] uppercase tracking-widest transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="max-h-[500px] overflow-auto bg-[#0d0d0d] border border-gray-800 rounded-sm">
                <pre className="p-4 text-xs text-gray-300 font-mono whitespace-pre-wrap break-words">
                  <code>{testResult}</code>
                </pre>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PromptAdmin;
