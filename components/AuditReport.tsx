

import React, { useState, useRef, useEffect } from 'react';
import {
  AuditResponse,
  TraceableValue,
  DocumentEntry,
  VerificationStep,
  TriageItem,
  CoreDataPositions,
  BsColumnMapping,
  BsStructureItem,
  ExpenseSample,
} from '../types';

/** Extract 1-based page number from various ref formats: "Page 3", "p.3", "pg 3", "3" */
function extractPageNumber(s: string): string | null {
  if (!s || !s.trim()) return null;
  const m = s.match(/Page\s*(\d+)/i) || s.match(/p\.?\s*(\d+)/i) || s.match(/pg\.?\s*(\d+)/i)
    || s.match(/^(?:p\.?|pg\.?)?\s*(\d+)$/i) || s.match(/\b(\d+)\s*$/);
  return m ? m[1] : null;
}

interface AuditReportProps {
  data: AuditResponse;
  files: File[];
  triageItems: TriageItem[];
  onTriage: (item: TriageItem, action: 'add' | 'remove') => void;
}

// Forensic Cell Component - Upgraded for UI Spec + High Visibility
const ForensicCell: React.FC<{ 
  val: TraceableValue; 
  docs: DocumentEntry[];
  files: File[]; 
  isCurrency?: boolean;
  textColor?: string;
  isBold?: boolean;
}> = ({ val, docs, files, isCurrency = true, textColor, isBold = false }) => {
  const [showCard, setShowCard] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'top' });
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null); // Ref for the popup card

  // --- RESOLUTION LOGIC FOR SOURCE DOCUMENT ---
  // Ensure docs is an array before finding
  const safeDocs = docs || [];

  // 1. Try to find by strict Document_ID match in Register
  let doc = safeDocs.find(d => d.Document_ID === val?.source_doc_id);
  
  // 2. Fallback: Try to find by matching Origin Name or Name in Register
  if (!doc && val?.source_doc_id) {
    doc = safeDocs.find(d => d.Document_Origin_Name === val.source_doc_id || d.Document_Name === val.source_doc_id);
  }

  // 3. Find the actual physical File object
  const targetFile = doc 
    ? files.find(f => f.name === doc.Document_Origin_Name) 
    : files.find(f => f.name === val?.source_doc_id);

  // Safe val check
  if (!val) return <span className="text-gray-300">-</span>;

  // Format Value
  const displayVal = isCurrency ? (val.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : val.amount;

  // --- INTERACTION LOGIC: ESC & CLICK OUTSIDE ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showPdfModal) setShowPdfModal(false);
        if (showCard) setShowCard(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        showCard && 
        cardRef.current && 
        !cardRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowCard(false);
      }
    };

    if (showCard || showPdfModal) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCard, showPdfModal]);


  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!showCard && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const placement = spaceAbove < 280 ? 'bottom' : 'top';
      
      setCoords({
        top: placement === 'top' ? rect.top : rect.bottom,
        left: Math.min(rect.left, window.innerWidth - 340), 
        placement
      });
    }
    setShowCard(!showCard);
  };

  const handleOpenPdf = () => {
    if (!targetFile) {
        alert("Original source file not found in current session. Please re-upload evidence to view.");
        return;
    }
    
    const objectUrl = URL.createObjectURL(targetFile);
    // Extract page number from multiple formats: "Page 3", "p.3", "pg 3", "3", "p3"
    const pageNum = extractPageNumber(val.page_ref || val.note || "");
    const finalUrl = pageNum ? `${objectUrl}#page=${pageNum}` : objectUrl;
    
    setPdfUrl(finalUrl);
    setShowPdfModal(true);
    setShowCard(false);
  };

  useEffect(() => {
    return () => {
      if (pdfUrl) {
         URL.revokeObjectURL(pdfUrl.split('#')[0]);
      }
    };
  }, [pdfUrl]);

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={handleClick}
        className={`border-b border-dotted border-[#C5A059] hover:bg-[#C5A059]/10 cursor-pointer transition-colors px-1 rounded-sm relative hover:text-[#A08040] ${textColor || 'text-gray-800'} ${isBold ? 'font-bold' : ''}`}
        style={{ fontSize: 'inherit' }}
        title="Click for Forensic Trace"
      >
        {displayVal}
      </button>

      {/* Forensic Card Popup */}
      {showCard && (
        <div 
          ref={cardRef}
          className="fixed z-[9999] w-80 bg-white rounded shadow-2xl border-t-4 border-[#C5A059] text-left animate-fade-in font-sans"
          style={{ 
             top: coords.top, 
             left: coords.left,
             transform: coords.placement === 'top' ? 'translateY(-100%) translateY(-10px)' : 'translateY(10px)'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
           {/* Header */}
           <div className="flex justify-between items-center bg-[#F9F9F9] px-4 py-3 border-b border-gray-100">
              <span className="text-[13px] font-bold text-[#C5A059] uppercase tracking-widest flex items-center gap-2">
                <span className="bg-[#C5A059] text-white rounded-sm w-4 h-4 flex items-center justify-center text-[10px]">🔍</span>
                Forensic Trace
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowCard(false); }} 
                className="text-gray-400 hover:text-black transition-colors"
              >
                ✕
              </button>
           </div>
           
           {/* Body */}
           <div className="p-5 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              {/* Source Doc */}
              <div>
                <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest">Source Document</span>
                <div className="text-[14px] font-bold text-black bg-gray-50 border border-gray-200 p-3 break-words leading-snug">
                  {doc ? (
                    <span>
                      {[doc.Document_Origin_Name, ...(val.page_ref ? val.page_ref.split(/\s*[>›]\s*/).map(s => s.trim()).filter(Boolean) : [])].map((part, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-[#C5A059] font-bold mx-1">&gt;</span>}
                          {part}
                        </React.Fragment>
                      ))}
                    </span>
                  ) : (
                    val.source_doc_id === 'Calculated' ? 'System Calculation' : (val.source_doc_id || 'Unknown')
                  )}
                </div>
              </div>
              
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest">Doc ID</span>
                    <div className="text-[13px] text-gray-600 bg-gray-100 px-2 py-1.5 border border-gray-200">
                      {val.source_doc_id}
                    </div>
                 </div>
                 <div>
                    <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest">Extracted</span>
                    <div className="text-[13px] text-black bg-yellow-50 px-2 py-1.5 border border-yellow-100 font-bold">
                      {displayVal}
                    </div>
                 </div>
              </div>

              {/* A: Visual Anchor (New) */}
              {val.verbatim_quote && (
                <div>
                   <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      Visual Anchor
                   </span>
                   <div className="text-[12px] font-mono text-gray-600 bg-gray-100 p-2 border border-gray-200 border-l-4 border-l-[#C5A059]">
                      "{val.verbatim_quote}"
                   </div>
                </div>
              )}

              {/* B: Calculation Logic (New) */}
              {val.computation && (
                 <div>
                    <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest flex items-center gap-1">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                       Logic Trace
                    </span>
                    <div className="bg-blue-50 border border-blue-100 p-2 text-[12px] text-blue-900 font-mono">
                       <div className="font-bold border-b border-blue-200 pb-1 mb-1">{val.computation.method}</div>
                       <div>{val.computation.expression}</div>
                    </div>
                 </div>
              )}
              
              {/* Note / Context */}
              {val.note && (
                <div>
                   <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest">Context / Note</span>
                   <div className="text-[13px] text-gray-600 italic">
                      {val.note}
                   </div>
                </div>
              )}

              {/* ACTION: View PDF */}
              {targetFile && (
                <div className="pt-2">
                   <button 
                     onClick={handleOpenPdf}
                     className="w-full flex items-center justify-center gap-2 bg-black text-white hover:bg-[#C5A059] transition-colors py-2 text-[12px] font-bold uppercase tracking-wider rounded-sm"
                   >
                     View Source Document
                   </button>
                </div>
              )}
           </div>
        </div>
      )}

      {/* PDF Modal */}
      {showPdfModal && pdfUrl && (
        <div 
          onClick={() => setShowPdfModal(false)}
          className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-10 animate-fade-in"
        >
           <div 
             onClick={(e) => e.stopPropagation()}
             className="bg-white w-full h-full rounded shadow-2xl flex flex-col overflow-hidden"
           >
              <div className="flex justify-between items-center bg-[#111] text-white px-6 py-4 border-b border-gray-800 shrink-0">
                 <div className="flex items-center gap-3 overflow-hidden">
                    <span className="bg-[#C5A059] text-black text-xs font-bold px-2 py-1 rounded-sm uppercase tracking-wide">Evidence Preview</span>
                    <span className="font-bold truncate text-gray-300" title={targetFile?.name}>
                      {doc ? doc.Document_Origin_Name : targetFile?.name}
                    </span>
                    <span className="text-gray-500 text-sm">/</span>
                    <span className="text-[#C5A059] font-medium text-sm">{val.page_ref}</span>
                 </div>
                 <button 
                   onClick={() => setShowPdfModal(false)}
                   className="text-gray-400 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-2"
                 >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
              </div>
              <div className="flex-1 bg-gray-100 relative">
                 <iframe 
                   src={pdfUrl} 
                   className="w-full h-full absolute inset-0" 
                   title="Document Preview"
                 />
              </div>
           </div>
        </div>
      )}
    </>
  );
};

/** Payload for Expense Forensic popover: Source Doc, Doc ID, Extracted, Context/Note, View in PDF */
interface ExpenseForensicPayload {
  title: string;
  source_doc_id: string;
  page_ref: string;
  note: string;
  extracted_amount?: number;
}

/** Forensic popover for expense INV/PAY/AUTH/FUND – same layout as ForensicCell: Source Document, Doc ID, Extracted, Context/Note, View in PDF */
const ExpenseForensicPopover: React.FC<{
  payload: ExpenseForensicPayload;
  docs: DocumentEntry[];
  files: File[];
  onClose: () => void;
}> = ({ payload, docs, files, onClose }) => {
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const safeDocs = docs || [];
  let doc = safeDocs.find(d => d.Document_ID === payload.source_doc_id);
  if (!doc && payload.source_doc_id) {
    doc = safeDocs.find(d => d.Document_Origin_Name === payload.source_doc_id || d.Document_Name === payload.source_doc_id);
  }
  const targetFile = doc ? files.find(f => f.name === doc!.Document_Origin_Name) : files.find(f => f.name === payload.source_doc_id);

  const handleOpenPdf = () => {
    if (!targetFile) {
      alert("Original source file not found in current session. Please re-upload evidence to view.");
      return;
    }
    const objectUrl = URL.createObjectURL(targetFile);
    const pageNum = extractPageNumber(payload.page_ref || payload.note || "");
    const finalUrl = pageNum ? `${objectUrl}#page=${pageNum}` : objectUrl;
    setPdfUrl(finalUrl);
    setShowPdfModal(true);
  };

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl.split('#')[0]); };
  }, [pdfUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowPdfModal(false); onClose(); } };
    if (showPdfModal) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showPdfModal, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-white w-full max-w-md rounded shadow-2xl border-t-4 border-[#C5A059] overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center bg-[#F9F9F9] px-6 py-4 border-b border-gray-100">
            <span className="text-[13px] font-bold text-[#C5A059] uppercase tracking-widest flex items-center gap-2">
              <span className="bg-[#C5A059] text-white rounded-sm w-4 h-4 flex items-center justify-center text-[10px]">🔍</span>
              Forensic Trace – {payload.title}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-black">✕</button>
          </div>
          <div className="p-5 space-y-4 max-h-[400px] overflow-y-auto">
            <div>
              <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest">Source Document</span>
              <div className="text-[14px] font-bold text-black bg-gray-50 border border-gray-200 p-3 break-words">
                {doc ? (
                  <span>
                    {[doc.Document_Origin_Name, ...(payload.page_ref ? payload.page_ref.split(/\s*[>›]\s*/).map(s => s.trim()).filter(Boolean) : [])].map((part, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-[#C5A059] font-bold mx-1">&gt;</span>}
                        {part}
                      </React.Fragment>
                    ))}
                  </span>
                ) : (payload.source_doc_id || '–')}
              </div>
            </div>
            <div>
              <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest">Doc ID</span>
              <div className="text-[13px] text-gray-600 bg-gray-100 px-2 py-1.5 border border-gray-200">{payload.source_doc_id || '–'}</div>
            </div>
            {(payload.extracted_amount != null && payload.extracted_amount !== 0) && (
              <div>
                <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest">Extracted</span>
                <div className="text-[13px] text-black bg-yellow-50 px-2 py-1.5 border border-yellow-100 font-bold">
                  {payload.extracted_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
            <div>
              <span className="text-[12px] uppercase text-gray-400 font-bold block mb-1 tracking-widest">Context / Note</span>
              <div className="text-[13px] text-gray-600 italic">{payload.note || '–'}</div>
            </div>
            {targetFile && (
              <div className="pt-2">
                <button onClick={handleOpenPdf} className="w-full flex items-center justify-center gap-2 bg-black text-white hover:bg-[#C5A059] py-2 text-[12px] font-bold uppercase tracking-wider rounded-sm">
                  View source document in PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showPdfModal && pdfUrl && (
        <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPdfModal(false)}>
          <div className="bg-white w-full h-full rounded shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center bg-[#111] text-white px-6 py-4 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="bg-[#C5A059] text-black text-xs font-bold px-2 py-1 rounded-sm uppercase">Evidence Preview</span>
                <span className="font-bold truncate text-gray-300" title={targetFile?.name}>{doc ? doc.Document_Origin_Name : targetFile?.name}</span>
                {payload.page_ref && <span className="text-[#C5A059] text-sm">/ {payload.page_ref}</span>}
              </div>
              <button onClick={() => setShowPdfModal(false)} className="text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2">✕</button>
            </div>
            <div className="flex-1 bg-gray-100 relative">
              <iframe src={pdfUrl} className="w-full h-full absolute inset-0" title="Document Preview" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/** Build forensic payload from expense sample for a given pillar (INV/PAY/AUTH/FUND) */
function buildExpenseForensicPayload(
  item: ExpenseSample,
  pillar: 'INV' | 'PAY' | 'AUTH' | 'FUND',
  docs: DocumentEntry[]
): ExpenseForensicPayload {
  const inv = item.Three_Way_Match?.invoice;
  const pay = item.Three_Way_Match?.payment;
  const auth = item.Three_Way_Match?.authority;
  const fund = item.Fund_Integrity;
  const parseId = (id: string) => {
    const parts = (id || '').split(/[/,|]/).map(s => s.trim());
    return { docId: parts[0] || id, pageRef: parts[1] || '' };
  };
  switch (pillar) {
    case 'INV': {
      const ev = inv?.evidence;
      const { docId, pageRef } = ev?.source_doc_id ? { docId: ev.source_doc_id, pageRef: ev.page_ref || '' } : parseId(inv?.id || '');
      return {
        title: 'Invoice',
        source_doc_id: docId,
        page_ref: pageRef,
        note: ev?.note ?? (inv ? `Addressed to OC: ${inv.addressed_to_strata}; Payee match: ${inv.payee_match}; ABN valid: ${inv.abn_valid}. Ref: ${inv.id}` : '–'),
        extracted_amount: ev?.extracted_amount,
      };
    }
    case 'PAY': {
      const ev = pay?.evidence;
      const docId = ev?.source_doc_id ?? pay?.source_doc ?? pay?.creditors_ref ?? '–';
      return {
        title: 'Payment',
        source_doc_id: docId,
        page_ref: ev?.page_ref ?? '',
        note: ev?.note ?? (pay ? `Status: ${pay.status}. ${pay.source_doc ? pay.source_doc : ''} ${pay.creditors_ref ? pay.creditors_ref : ''} ${pay.bank_date ? pay.bank_date : ''}`.trim() || '–' : '–'),
        extracted_amount: ev?.extracted_amount ?? item.GL_Amount?.amount,
      };
    }
    case 'AUTH': {
      const ev = auth?.evidence;
      const docId = ev?.source_doc_id ?? (auth?.minute_ref ? auth.minute_ref.split(/[,\s]/)[0] : '') ?? '–';
      return {
        title: 'Authority',
        source_doc_id: docId,
        page_ref: ev?.page_ref ?? '',
        note: ev?.note ?? (auth ? `Required: ${auth.required_tier}; limit applied: $${auth.limit_applied}. ${auth.minute_ref ?? 'No minute ref.'}` : '–'),
        extracted_amount: ev?.extracted_amount ?? auth?.limit_applied,
      };
    }
    case 'FUND': {
      const ev = fund?.evidence;
      return {
        title: 'Fund',
        source_doc_id: ev?.source_doc_id ?? '–',
        page_ref: ev?.page_ref ?? '',
        note: fund?.note ?? ev?.note ?? (fund ? `GL: ${fund.gl_fund_code} | Inv: ${fund.invoice_nature}. Status: ${fund.classification_status}` : '–'),
        extracted_amount: ev?.extracted_amount,
      };
    }
  }
}

// New: Verification Matrix Modal (for Expenses)
const VerificationMatrixModal: React.FC<{ steps: VerificationStep[]; onClose: () => void }> = ({ steps, onClose }) => {
   return (
      <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
         <div className="bg-white w-full max-w-lg rounded shadow-2xl border-t-4 border-[#C5A059] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
               <h3 className="font-bold text-lg text-black uppercase tracking-wide flex items-center gap-2">
                  <span className="text-[#C5A059]">✓</span> Adjudication Matrix
               </h3>
               <button onClick={onClose} className="text-gray-400 hover:text-black">✕</button>
            </div>
            <div className="p-6 space-y-4">
               {steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                     <div className="mt-1">
                        {step.status === 'PASS' 
                           ? <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">✓</div>
                           : <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">✕</div>
                        }
                     </div>
                     <div className="flex-1">
                        <div className="text-sm font-bold text-gray-800">{step.rule}</div>
                        <div className="text-xs text-gray-500 italic mt-1">Ref: {step.evidence_ref}</div>
                     </div>
                  </div>
               ))}
            </div>
            <div className="bg-gray-50 px-6 py-4 text-center">
               <button onClick={onClose} className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-black">Close Verification</button>
            </div>
         </div>
      </div>
   );
};

// --- NEW: TRIAGE MODAL & ROW ACTION ---

const TriageModal: React.FC<{ 
   initialData?: TriageItem;
   rowId: string;
   tab: string;
   title: string;
   onClose: () => void;
   onSave: (item: TriageItem) => void;
}> = ({ initialData, rowId, tab, title, onClose, onSave }) => {
   const [comment, setComment] = useState(initialData?.comment || '');
   const [severity, setSeverity] = useState<'low' | 'medium' | 'critical'>(initialData?.severity || 'medium');

   return (
      <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
         <div className="bg-white w-full max-w-md rounded shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
               <h3 className="font-bold text-sm text-black uppercase tracking-wide">
                  {initialData ? 'Edit Flag' : 'Flag Issue'}
               </h3>
               <button onClick={onClose} className="text-gray-400 hover:text-black">✕</button>
            </div>
            <div className="p-6">
               <div className="mb-4">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Item</span>
                  <div className="font-bold text-gray-800 text-sm mt-1">{title}</div>
               </div>
               
               <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Severity</label>
                  <div className="flex gap-2">
                     {(['low', 'medium', 'critical'] as const).map(s => (
                        <button 
                           key={s}
                           onClick={() => setSeverity(s)}
                           className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded border ${
                              severity === s 
                                ? s === 'critical' ? 'bg-red-500 text-white border-red-500' 
                                  : s === 'medium' ? 'bg-yellow-500 text-white border-yellow-500'
                                  : 'bg-blue-500 text-white border-blue-500'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                           }`}
                        >
                           {s}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Review Note</label>
                  <textarea 
                     className="w-full border border-gray-300 rounded p-2 text-sm focus:border-[#C5A059] focus:outline-none"
                     rows={3}
                     value={comment}
                     onChange={(e) => setComment(e.target.value)}
                     placeholder="Describe the issue..."
                  />
               </div>
               
               <button 
                  onClick={() => onSave({
                     id: initialData?.id || crypto.randomUUID(),
                     rowId,
                     tab,
                     title,
                     comment,
                     severity,
                     timestamp: Date.now()
                  })}
                  className="w-full bg-black hover:bg-[#C5A059] text-white font-bold py-3 text-xs uppercase tracking-widest rounded transition-colors"
               >
                  Save Flag
               </button>
            </div>
         </div>
      </div>
   );
};

const RowAction: React.FC<{ 
   rowId: string;
   tab: string;
   title: string;
   triageItems: TriageItem[];
   onFlag: (item: TriageItem) => void;
}> = ({ rowId, tab, title, triageItems, onFlag }) => {
   const [isModalOpen, setIsModalOpen] = useState(false);
   const existingFlag = triageItems.find(t => t.rowId === rowId);

   return (
      <>
         <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2">
            {existingFlag ? (
               <button 
                  onClick={() => setIsModalOpen(true)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                  title="View Flag"
               >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
               </button>
            ) : (
               <button 
                  onClick={() => setIsModalOpen(true)}
                  className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Flag Issue"
               >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
               </button>
            )}
         </div>
         {isModalOpen && (
            <TriageModal 
               initialData={existingFlag}
               rowId={rowId}
               tab={tab}
               title={title}
               onClose={() => setIsModalOpen(false)}
               onSave={(item) => {
                  onFlag(item);
                  setIsModalOpen(false);
               }}
            />
         )}
      </>
   );
};

// --- END NEW ---

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 text-[15px] font-bold uppercase tracking-wider transition-all border-b-2 ${
      active
        ? 'border-[#C5A059] text-[#C5A059] bg-[#C5A059]/5'
        : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
    }`}
  >
    {children}
  </button>
);

const StatusBadge: React.FC<{ status: string; onClick?: () => void }> = ({ status, onClick }) => {
  const s = (status || '').toLowerCase();
  let colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
  if (s.includes('fail') || s.includes('risk') || s.includes('unauthorised') || s.includes('wrong') || s.includes('insolvent') || s.includes('deficit') || s.includes('variance')) {
    colorClass = 'bg-red-50 text-red-800 border-red-100';
  } else if (s.includes('pass') || s.includes('ok') || s.includes('resolved') || s.includes('solvent') || s.includes('verified')) {
    colorClass = 'bg-green-50 text-green-800 border-green-100';
  } else if (s.includes('missing') || s.includes('required') || s.includes('tier_3') || s.includes('no_support') || s.includes('breakdown')) {
    colorClass = 'bg-yellow-50 text-yellow-800 border-yellow-100';
  }

  return (
    <span 
      onClick={onClick}
      className={`inline-flex items-center px-2 py-1 border text-[13px] font-bold uppercase tracking-wider ${colorClass} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
    >
      {status || 'Unknown'}
      {onClick && <span className="ml-1 text-[10px] opacity-50">▼</span>}
    </span>
  );
};

export const AuditReport: React.FC<AuditReportProps> = ({ data, files, triageItems, onTriage }) => {
  const [activeTab, setActiveTab] = useState<'docs' | 'levy' | 'assets' | 'expense' | 'compliance' | 'completion'>('docs');
  const [activeVerificationSteps, setActiveVerificationSteps] = useState<VerificationStep[] | null>(null);
  const [expenseForensic, setExpenseForensic] = useState<{ pillar: 'INV' | 'PAY' | 'AUTH' | 'FUND'; rowIndex: number; item: ExpenseSample } | null>(null);
  
  // ROBUST DEFAULTING to prevent crashes if JSON is partial or undefined
  const safeData: Partial<AuditResponse> = data || {};
  const docs = safeData.document_register || [];
  
  const defaultSummary = { total_files: 0, missing_critical_types: [], status: 'N/A', strata_plan: undefined as string | undefined, financial_year: undefined as string | undefined };
  const summary = { ...defaultSummary, ...(safeData.intake_summary || {}) };

  // Helper to attach actions (native title tooltip when content is string, e.g. Note column)
  const withAction = (rowId: string, title: string, content: React.ReactNode) => (
     <div className="relative group pr-8 h-full flex items-center">
        <div className="flex-1" title={typeof content === 'string' ? content : undefined}>{content}</div>
        <RowAction 
           rowId={`${activeTab}-${rowId}`} 
           tab={activeTab} 
           title={title} 
           triageItems={triageItems} 
           onFlag={(item) => onTriage(item, 'add')} 
        />
     </div>
  );

  return (
    <div className="bg-white rounded shadow-sm border border-gray-200 mb-10">
      
      {activeVerificationSteps && (
         <VerificationMatrixModal 
            steps={activeVerificationSteps} 
            onClose={() => setActiveVerificationSteps(null)} 
         />
      )}
      {expenseForensic && (
         <ExpenseForensicPopover
            payload={buildExpenseForensicPayload(expenseForensic.item, expenseForensic.pillar, docs)}
            docs={docs}
            files={files}
            onClose={() => setExpenseForensic(null)}
         />
      )}

      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-8 pt-6 rounded-t">
        <h2 className="text-2xl font-bold text-black mb-4 tracking-tight">Audit Execution Report</h2>
        <div className="mb-4 py-3 px-4 rounded bg-[#C5A059]/10 border border-[#C5A059]/30 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#C5A059] uppercase tracking-widest">Strata Plan</span>
            <span className="text-[15px] font-bold text-black font-mono">{summary.strata_plan || '–'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#C5A059] uppercase tracking-widest">FY (Global)</span>
            <span className="text-[15px] font-bold text-black font-mono">{summary.financial_year || '–'}</span>
          </div>
        </div>
        <div className="flex space-x-1 overflow-x-auto">
          <TabButton active={activeTab === 'docs'} onClick={() => setActiveTab('docs')}>
            Register
          </TabButton>
          <TabButton active={activeTab === 'levy'} onClick={() => setActiveTab('levy')}>
            Revenue
          </TabButton>
          <TabButton active={activeTab === 'assets'} onClick={() => setActiveTab('assets')}>
            Assets
          </TabButton>
          <TabButton active={activeTab === 'expense'} onClick={() => setActiveTab('expense')}>
            Expense
          </TabButton>
          <TabButton active={activeTab === 'compliance'} onClick={() => setActiveTab('compliance')}>
            Compliance
          </TabButton>
          <TabButton active={activeTab === 'completion'} onClick={() => setActiveTab('completion')}>
            Completion
          </TabButton>
        </div>
      </div>

      <div className="p-10 bg-[#FAFAFA] min-h-[500px]">
        {/* DOCUMENT REGISTER */}
        {activeTab === 'docs' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
              <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                <h3 className="text-[16px] font-bold text-black uppercase tracking-wide">Step 0: Document Dictionary</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <div className="p-4 bg-gray-50 border border-gray-100">
                  <div className="text-[14px] text-[#C5A059] uppercase font-bold tracking-widest mb-2">Total Files</div>
                  <div className="text-[18px] font-bold text-black">{summary.total_files}</div>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-100">
                  <div className="text-[14px] text-gray-500 uppercase font-bold tracking-widest mb-2">Status</div>
                  <div className="text-[18px] font-bold text-black">{summary.status}</div>
                </div>
                <div className="p-4 bg-[#C5A059]/10 border border-[#C5A059]/30">
                  <div className="text-[14px] text-[#C5A059] uppercase font-bold tracking-widest mb-2">Strata Plan</div>
                  <div className="text-[18px] font-bold text-black font-mono">{summary.strata_plan || '–'}</div>
                </div>
                <div className="p-4 bg-[#C5A059]/10 border border-[#C5A059]/30">
                  <div className="text-[14px] text-[#C5A059] uppercase font-bold tracking-widest mb-2">FY (Global)</div>
                  <div className="text-[18px] font-bold text-black font-mono">{summary.financial_year || '–'}</div>
                </div>
                {summary.missing_critical_types && summary.missing_critical_types.length > 0 ? (
                   <div className="p-4 bg-red-50 border border-red-100 lg:col-span-1">
                   <div className="text-[14px] text-red-700 uppercase font-bold tracking-widest mb-2">Missing Records</div>
                   <div className="text-[15px] font-medium text-red-900">
                     {summary.missing_critical_types.join(', ')}
                   </div>
                 </div>
                ) : null}
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border border-gray-200">
                  <thead className="bg-gray-100 text-black uppercase font-bold text-[15px] tracking-wider">
                    <tr>
                      <th className="px-5 py-4 border-b border-gray-200">ID</th>
                      <th className="px-5 py-4 border-b border-gray-200">Origin Name</th>
                      <th className="px-5 py-4 border-b border-gray-200">Document Name</th>
                      <th className="px-5 py-4 border-b border-gray-200">Type</th>
                      <th className="px-5 py-4 border-b border-gray-200">Tier</th>
                      <th className="px-5 py-4 border-b border-gray-200">Page Range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[15px]">
                    {docs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-4 text-center text-gray-500 italic">No documents registered.</td>
                      </tr>
                    ) : (
                      docs.map((doc) => (
                        <tr key={doc.Document_ID} className="bg-white hover:bg-gray-50 transition-colors group">
                          <td className="px-5 py-4 text-gray-500 text-[14px] border-r border-gray-100">{doc.Document_ID}</td>
                          <td className="px-5 py-4 text-gray-500 italic border-r border-gray-100 break-words max-w-xs">{doc.Document_Origin_Name}</td>
                          <td className="px-5 py-4 font-bold text-gray-900 border-r border-gray-100">{doc.Document_Name}</td>
                          <td className="px-5 py-4 text-gray-700 border-r border-gray-100">{doc.Document_Type}</td>
                          <td className="px-5 py-4 border-r border-gray-100">
                            <span className={`px-2 py-1 text-[12px] font-bold uppercase tracking-wider ${
                              doc.Evidence_Tier === 'Tier 1' ? 'bg-green-50 text-green-800' :
                              doc.Evidence_Tier === 'Tier 2' ? 'bg-blue-50 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}>{doc.Evidence_Tier}</span>
                          </td>
                          <td className="px-5 py-4 text-gray-600">
                             {withAction(doc.Document_ID, doc.Document_Name, doc.Page_Range)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Core Data Positions */}
              <div className="mt-10 pt-8 border-t border-gray-200">
                <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                  <h4 className="text-[14px] font-bold text-black uppercase tracking-wide">
                    Core Data Positions
                  </h4>
                  <p className="text-[12px] text-gray-500 mt-1">
                    Document & page locations for Levy, BS Verification, Expenses
                  </p>
                </div>
                {safeData.core_data_positions ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { key: 'balance_sheet', label: 'Balance Sheet' },
                      { key: 'bank_statement', label: 'Bank Statement' },
                      { key: 'levy_report', label: 'Levy Report' },
                      { key: 'levy_receipts_admin', label: 'Levy Receipts (Admin)' },
                      { key: 'levy_receipts_capital', label: 'Levy Receipts (Capital)' },
                      { key: 'general_ledger', label: 'General Ledger' },
                      { key: 'minutes_levy', label: 'Minutes (Levy)' },
                      { key: 'minutes_auth', label: 'Minutes (Auth)' },
                    ].map(({ key, label }) => {
                      const loc = (safeData.core_data_positions as CoreDataPositions)[
                        key as keyof CoreDataPositions
                      ];
                      if (!loc || typeof loc !== 'object' || Array.isArray(loc)) {
                        return (
                          <div key={key} className="p-4 bg-gray-50 border border-gray-100 rounded">
                            <div className="text-[11px] text-gray-500 uppercase font-bold tracking-widest mb-1">{label}</div>
                            <div className="text-[13px] font-mono text-gray-800">–</div>
                          </div>
                        );
                      }
                      const originDoc = docs.find((d) => d.Document_ID === loc.doc_id);
                      const originName = originDoc?.Document_Origin_Name || loc.doc_id;
                      const pagePart = 'page_ref' in loc ? loc.page_ref : `${loc.page_range}${loc.as_at_date ? ` (${loc.as_at_date})` : ''}`;
                      return (
                        <div
                          key={key}
                          className="p-4 bg-gray-50 border border-gray-100 rounded"
                        >
                          <div className="text-[11px] text-gray-500 uppercase font-bold tracking-widest mb-1">
                            {label}
                          </div>
                          <div className="text-[13px] text-gray-800 break-words">
                            <span>{originName}</span>
                            {pagePart && (
                              <>
                                <span className="text-[#C5A059] font-bold mx-1">&gt;</span>
                                <span>{pagePart}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 border border-gray-100 rounded text-center text-gray-500 text-[13px] italic">
                    Run Step 0 only to extract core data positions.
                  </div>
                )}
              </div>

              {/* BS Column Mapping */}
              <div className="mt-10 pt-8 border-t border-gray-200">
                <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                  <h4 className="text-[14px] font-bold text-black uppercase tracking-wide">
                    BS Column Mapping
                  </h4>
                  <p className="text-[12px] text-gray-500 mt-1">
                    Prior Year / Current Year column labels for column anchoring
                  </p>
                </div>
                {safeData.bs_column_mapping ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-[#C5A059]/10 border border-[#C5A059]/30 rounded">
                      <div className="text-[11px] text-[#C5A059] uppercase font-bold tracking-widest mb-2">
                        Current Year
                      </div>
                      <div className="text-[15px] font-bold text-black font-mono">
                        {safeData.bs_column_mapping.current_year_label || '–'}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded">
                      <div className="text-[11px] text-gray-500 uppercase font-bold tracking-widest mb-2">
                        Prior Year
                      </div>
                      <div className="text-[15px] font-bold text-black font-mono">
                        {safeData.bs_column_mapping.prior_year_label || '–'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 border border-gray-100 rounded text-center text-gray-500 text-[13px] italic">
                    Run Step 0 only to extract BS column mapping.
                  </div>
                )}
              </div>

              {/* BS Structure */}
              <div className="mt-10 pt-8 border-t border-gray-200">
                <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                  <h4 className="text-[14px] font-bold text-black uppercase tracking-wide">
                    Balance Sheet Structure
                  </h4>
                  <p className="text-[12px] text-gray-500 mt-1">
                    Line items on the Balance Sheet (for Phase 4 completeness)
                  </p>
                </div>
                {safeData.bs_structure && Array.isArray(safeData.bs_structure) && safeData.bs_structure.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left border border-gray-200">
                      <thead className="bg-gray-100 text-black uppercase font-bold text-[12px] tracking-wider">
                        <tr>
                          <th className="px-4 py-3 border-b border-gray-200">#</th>
                          <th className="px-4 py-3 border-b border-gray-200">Line Item</th>
                          <th className="px-4 py-3 border-b border-gray-200">Section</th>
                          <th className="px-4 py-3 border-b border-gray-200">Fund</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-[14px]">
                        {(safeData.bs_structure as BsStructureItem[]).map((row, i) => (
                          <tr key={i} className="bg-white hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{row.line_item}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 text-[11px] font-bold uppercase ${
                                row.section === 'OWNERS_EQUITY' ? 'bg-amber-50 text-amber-800' :
                                row.section === 'ASSETS' ? 'bg-green-50 text-green-800' :
                                'bg-blue-50 text-blue-800'
                              }`}>
                                {row.section}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{row.fund || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 border border-gray-100 rounded text-center text-gray-500 text-[13px] italic">
                    Run Step 0 only to extract Balance Sheet structure.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* REVENUE (NEW TABLE E.MASTER) */}
        {activeTab === 'levy' && data.levy_reconciliation && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
              <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                <h3 className="text-[16px] font-bold text-black uppercase tracking-wide">Table E.Master: Detailed Levy Reconciliation</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 border border-gray-100">
                  <div className="text-[14px]">Source Doc: <span className="bg-white border border-gray-200 px-2 py-1 text-black font-bold text-[15px]">{data.levy_reconciliation.master_table.Source_Doc_ID}</span></div>
                  <div className="text-[14px]">AGM Date: <span className="font-bold text-[15px]">{data.levy_reconciliation.master_table.AGM_Date}</span></div>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full table-fixed text-right border-collapse border border-gray-200 [&_td:nth-child(5)]:truncate [&_td:nth-child(1)]:sticky [&_td:nth-child(1)]:left-0 [&_td:nth-child(1)]:z-10 [&_td:nth-child(1)]:bg-white [&_td:nth-child(5)]:sticky [&_td:nth-child(5)]:right-0 [&_td:nth-child(5)]:z-10 [&_td:nth-child(5)]:bg-white">
                  <colgroup>
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "16.67%" }} />
                    <col style={{ width: "16.67%" }} />
                    <col style={{ width: "16.67%" }} />
                    <col style={{ width: "25%", maxWidth: "25%" }} />
                  </colgroup>
                  <thead className="bg-gray-100 text-black uppercase font-bold text-[15px] tracking-wider">
                    <tr>
                      <th className="px-5 py-4 text-left border-b border-gray-200 sticky left-0 z-10 bg-gray-100">Item</th>
                      <th className="px-5 py-4 border-b border-gray-200">Admin Fund ($)</th>
                      <th className="px-5 py-4 border-b border-gray-200">Sinking Fund ($)</th>
                      <th className="px-5 py-4 border-b border-gray-200">Total ($)</th>
                      <th className="px-5 py-4 text-left border-b border-gray-200 pl-4 pr-3 sticky right-0 z-10 bg-gray-100">Note / Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[15px]">
                    {/* OPENING BALANCE */}
                    <tr className="bg-gray-50/50">
                        <td className="px-5 py-3 text-left font-bold text-gray-800 uppercase text-[14px] tracking-wide">Opening Balance</td>
                        <td colSpan={4}></td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">Levies in Arrears</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-3 font-medium"><ForensicCell val={data.levy_reconciliation.master_table.Op_Arrears} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('op_arr', 'Opening Arrears (Prior Year)', data.levy_reconciliation.master_table.Op_Arrears.note || '-')}
                        </td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">(Less) Levies in Advance</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-3 text-red-700">(<ForensicCell val={data.levy_reconciliation.master_table.Op_Advance} docs={docs} files={files} />)</td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('op_adv', 'Opening Advance (Prior Year)', data.levy_reconciliation.master_table.Op_Advance.note || '-')}
                        </td>
                    </tr>
                    <tr className="border-b border-gray-100 group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 font-bold text-black">(A) NET OPENING</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-3 font-bold text-black"><ForensicCell val={data.levy_reconciliation.master_table.Net_Opening_Bal} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('net_op', 'Net Opening', data.levy_reconciliation.master_table.Net_Opening_Bal.note || '-')}
                        </td>
                    </tr>

                     {/* LEVIES STRUCK */}
                    <tr className="bg-gray-50/50">
                        <td className="px-5 py-3 text-left font-bold text-gray-800 uppercase text-[14px] tracking-wide">Levies Struck (Net)</td>
                        <td colSpan={4}></td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">Old Rate Levies</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Old_Levy_Admin} docs={docs} files={files} /></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Old_Levy_Sink} docs={docs} files={files} /></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Old_Levy_Total} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('old_levy', 'Old Levies', data.levy_reconciliation.master_table.Old_Levy_Total.note || '-')}
                        </td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">New Rate Levies</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.New_Levy_Admin} docs={docs} files={files} /></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.New_Levy_Sink} docs={docs} files={files} /></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.New_Levy_Total} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('new_levy', 'New Levies', data.levy_reconciliation.master_table.New_Levy_Total.note || '-')}
                        </td>
                    </tr>
                    
                    {/* B1 Sub-Total: 全部由 AI 输出，无 UI 计算；缺省时仅展示占位 */}
                    {(() => {
                      const mt = data.levy_reconciliation.master_table;
                      const emptyCell = { amount: 0, source_doc_id: '-', page_ref: '-', note: '—' as string };
                      const b1Admin = mt.Sub_Levies_Standard_Admin ?? emptyCell;
                      const b1Sink = mt.Sub_Levies_Standard_Sink ?? emptyCell;
                      return (
                        <tr className="border-b border-gray-100 font-bold bg-gray-50/30 group hover:bg-gray-50/50">
                          <td className="px-5 py-3 text-left pl-8">(B1) STANDARD LEVIES</td>
                          <td className="px-5 py-3"><ForensicCell val={b1Admin} docs={docs} files={files} /></td>
                          <td className="px-5 py-3"><ForensicCell val={b1Sink} docs={docs} files={files} /></td>
                          <td className="px-5 py-3"><ForensicCell val={mt.Sub_Levies_Standard} docs={docs} files={files} /></td>
                          <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                            {withAction('sub_std', 'Standard Levies', mt.Sub_Levies_Standard.note || '—')}
                          </td>
                        </tr>
                      );
                    })()}

                    {/* NEW: Adjustments / Other Income */}
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">Special Levies (Net)</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Spec_Levy_Admin} docs={docs} files={files} /></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Spec_Levy_Sink} docs={docs} files={files} /></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Spec_Levy_Total} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('spec_levy', 'Special Levies', data.levy_reconciliation.master_table.Spec_Levy_Total.note || '-')}
                        </td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">Interest Charged</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Plus_Interest_Chgd} docs={docs} files={files} /></td>
                        <td></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Plus_Interest_Chgd} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('int_chgd', 'Interest', data.levy_reconciliation.master_table.Plus_Interest_Chgd.note || '-')}
                        </td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">Less: Discount Given</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Less_Discount_Given} docs={docs} files={files} /></td>
                        <td></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Less_Discount_Given} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('disc_given', 'Discount', data.levy_reconciliation.master_table.Less_Discount_Given.note || '-')}
                        </td>
                    </tr>
                     <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">Legal Costs Recovery</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Plus_Legal_Recovery} docs={docs} files={files} /></td>
                        <td></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Plus_Legal_Recovery} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('leg_rec', 'Legal Recovery', data.levy_reconciliation.master_table.Plus_Legal_Recovery.note || '-')}
                        </td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">Other Recovery</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Plus_Other_Recovery} docs={docs} files={files} /></td>
                        <td></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Plus_Other_Recovery} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('oth_rec', 'Other Recovery', data.levy_reconciliation.master_table.Plus_Other_Recovery.note || '-')}
                        </td>
                    </tr>

                    <tr className="border-b border-gray-100 font-bold bg-gray-50/30 group hover:bg-gray-50/50">
                        <td className="px-5 py-3 text-left pl-8">(B) SUB-TOTAL (NET)</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Sub_Admin_Net} docs={docs} files={files} /></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Sub_Sink_Net} docs={docs} files={files} /></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Total_Levies_Net} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('sub_net', 'Sub Total Net', data.levy_reconciliation.master_table.Total_Levies_Net.note || 'Sum of All Above')}
                        </td>
                    </tr>

                    {/* GST COMPONENT */}
                    <tr className="bg-gray-50/50">
                        <td className="px-5 py-3 text-left font-bold text-gray-800 uppercase text-[14px] tracking-wide">GST Component</td>
                        <td colSpan={4}></td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">GST on Levies (10%)</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.GST_Admin} docs={docs} files={files} /></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.GST_Sink} docs={docs} files={files} /></td>
                        <td></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('gst_std', 'GST Standard', data.levy_reconciliation.master_table.GST_Admin.note || 'Standard')}
                        </td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">GST on Special Levies</td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.GST_Special} docs={docs} files={files} /></td>
                        <td></td>
                        <td></td>
                         <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                            {withAction('gst_spec', 'GST Special', data.levy_reconciliation.master_table.GST_Special.note || 'Special')}
                         </td>
                    </tr>
                    <tr className="border-b border-gray-100 font-bold bg-gray-50/30 group hover:bg-gray-50/50">
                        <td className="px-5 py-3 text-left pl-8">(C) TOTAL GST</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-3"><ForensicCell val={data.levy_reconciliation.master_table.Total_GST_Raised} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('gst_tot', 'Total GST', data.levy_reconciliation.master_table.Total_GST_Raised.note || 'Sum of GST')}
                        </td>
                    </tr>

                     {/* TOTALS – (D) = period-only gross, not including (A); reconciliation adds A+D-E in closing row */}
                    <tr className="bg-yellow-50/50 border-y border-gray-200 group hover:bg-yellow-50">
                      <td className="px-5 py-4 text-left font-bold text-black">(D) TOTAL LEVIES & GST RAISED (PERIOD)</td>
                      <td></td>
                      <td></td>
                      <td className="px-5 py-4 font-bold text-black"><ForensicCell val={data.levy_reconciliation.master_table.Total_Gross_Inc} docs={docs} files={files} /></td>
                      <td className="px-5 py-4 text-left pl-8 text-gray-500 font-bold text-[13px]">
                         {withAction('tot_gross', 'Total Gross', '(B) + (C) only; (A) added in Calc Closing = A + D - E')}
                      </td>
                    </tr>

                    {/* RECONCILIATION - UPDATED LOGIC */}
                    <tr><td colSpan={5} className="py-2"></td></tr>
                    <tr className="bg-gray-50/50">
                        <td className="px-5 py-3 text-left font-bold text-gray-800 uppercase text-[14px] tracking-wide">Reconciliation</td>
                        <td colSpan={4}></td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">(A) Net Opening</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-3 font-medium"><ForensicCell val={data.levy_reconciliation.master_table.Net_Opening_Bal} docs={docs} files={files} /></td>
                        <td></td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-8 text-gray-600">(+) (D) Total Levies & GST Raised (Period)</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-3 font-medium"><ForensicCell val={data.levy_reconciliation.master_table.Total_Gross_Inc} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 text-[12px]">(B)+(C); A added below</td>
                    </tr>
                    
                    {/* Less: RECEIPTS – Admin receipts + Capital receipts; (E) = sum; no Non-Levy Income */}
                    <tr className="border-t border-gray-200">
                        <td className="px-5 py-3 text-left pl-8 font-bold text-gray-700">Less: RECEIPTS</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    {data.levy_reconciliation.master_table.Admin_Fund_Receipts && data.levy_reconciliation.master_table.Capital_Fund_Receipts ? (
                      <>
                        <tr className="group hover:bg-gray-50">
                            <td className="px-5 py-2 text-left pl-12 text-gray-600">Admin receipts</td>
                            <td></td>
                            <td></td>
                            <td className="px-5 py-2 text-right"><ForensicCell val={data.levy_reconciliation.master_table.Admin_Fund_Receipts} docs={docs} files={files} /></td>
                            <td className="px-5 py-2 text-left pl-8 text-gray-400 italic text-[13px]">
                               {withAction('admin_rec', 'Admin Receipts', data.levy_reconciliation.master_table.Admin_Fund_Receipts.note || 'Administrative Fund receipts')}
                            </td>
                        </tr>
                        <tr className="group hover:bg-gray-50">
                            <td className="px-5 py-2 text-left pl-12 text-gray-600">Capital receipts</td>
                            <td></td>
                            <td></td>
                            <td className="px-5 py-2 text-right"><ForensicCell val={data.levy_reconciliation.master_table.Capital_Fund_Receipts} docs={docs} files={files} /></td>
                            <td className="px-5 py-2 text-left pl-8 text-gray-400 italic text-[13px]">
                               {withAction('cap_rec', 'Capital Receipts', data.levy_reconciliation.master_table.Capital_Fund_Receipts.note || 'Capital / Sinking Fund receipts')}
                            </td>
                        </tr>
                      </>
                    ) : (
                      <tr className="group hover:bg-gray-50">
                          <td className="px-5 py-2 text-left pl-12 text-gray-600">Admin + Capital Receipts</td>
                          <td></td>
                          <td></td>
                          <td className="px-5 py-2 text-right"><ForensicCell val={data.levy_reconciliation.master_table.Total_Receipts_Global} docs={docs} files={files} /></td>
                          <td className="px-5 py-2 text-left pl-8 text-gray-400 italic text-[13px]">
                             {withAction('tot_rec', 'Admin + Capital Receipts', data.levy_reconciliation.master_table.Total_Receipts_Global?.note || 'Legacy: run fresh audit for Admin / Capital split')}
                          </td>
                      </tr>
                    )}
                     <tr className="border-b border-gray-100 group hover:bg-gray-50">
                        <td className="px-5 py-3 text-left pl-12 font-medium italic text-gray-800">(E) Effective Levy Receipts</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-3 font-medium border-t border-gray-300"><ForensicCell val={data.levy_reconciliation.master_table.Effective_Levy_Receipts} docs={docs} files={files} /></td>
                        <td className="px-5 py-3 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('eff_rec', 'Effective Receipts', data.levy_reconciliation.master_table.Effective_Levy_Receipts.note || 'Admin + Capital total')}
                        </td>
                    </tr>

                    <tr className="border-t border-gray-200 bg-gray-50 group hover:bg-gray-100">
                        <td className="px-5 py-4 text-left pl-8 font-bold text-black">(=) CALC CLOSING</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-4 font-bold text-black"><ForensicCell val={data.levy_reconciliation.master_table.Calc_Closing} docs={docs} files={files} /></td>
                        <td className="px-5 py-4 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('calc_close', 'Calc Closing', data.levy_reconciliation.master_table.Calc_Closing.note || 'A + D - E')}
                        </td>
                    </tr>
                    
                    {/* NEW: Granular Closing Balance Breakdown */}
                    <tr className="border-t border-gray-200">
                        <td className="px-5 py-2 text-left pl-8 text-gray-600">Closing Balance per Balance Sheet</td>
                        <td colSpan={4}></td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-2 text-left pl-8 text-gray-600">Levies in Arrears</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-2 font-medium"><ForensicCell val={data.levy_reconciliation.master_table.BS_Arrears} docs={docs} files={files} /></td>
                        <td className="px-5 py-2 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('bs_arr', 'Closing Arrears (Current Year)', data.levy_reconciliation.master_table.BS_Arrears.note || 'Asset')}
                        </td>
                    </tr>
                    <tr className="group hover:bg-gray-50">
                        <td className="px-5 py-2 text-left pl-8 text-gray-600">Levies in Advance</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-2 text-red-700">(<ForensicCell val={data.levy_reconciliation.master_table.BS_Advance} docs={docs} files={files} />)</td>
                        <td className="px-5 py-2 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('bs_adv', 'Closing Advance (Current Year)', data.levy_reconciliation.master_table.BS_Advance.note || 'Liability (Credit)')}
                        </td>
                    </tr>
                    <tr className="border-t border-gray-200 group hover:bg-gray-50">
                        <td className="px-5 py-4 text-left pl-8 font-bold text-gray-600">(G) BALANCE SHEET CLOSING</td>
                        <td></td>
                        <td></td>
                        <td className="px-5 py-4 font-bold text-gray-600"><ForensicCell val={data.levy_reconciliation.master_table.BS_Closing} docs={docs} files={files} /></td>
                        <td className="px-5 py-4 text-left pl-8 text-gray-400 italic text-[13px]">
                           {withAction('bs_close', 'BS Closing', data.levy_reconciliation.master_table.BS_Closing.note || 'Net')}
                        </td>
                    </tr>
                    
                    <tr className="border-t-4 border-double border-black group hover:bg-gray-50">
                      <td className="px-5 py-4 text-left font-bold text-black">VARIANCE</td>
                      <td></td>
                      <td></td>
                      <td className={`px-5 py-4 font-bold`}>
                        <ForensicCell val={data.levy_reconciliation.master_table.Levy_Variance} docs={docs} textColor={data.levy_reconciliation.master_table.Levy_Variance.amount !== 0 ? 'text-red-700' : 'text-green-700'} files={files} />
                      </td>
                      <td className="px-5 py-4 text-left pl-8 text-gray-400 italic text-[13px]">
                         {withAction('variance', 'Variance', 'Must be 0')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ASSETS – Full Balance Sheet Verification only (Table C.3) */}
        {activeTab === 'assets' && (
            <div className="space-y-8">
                {/* Table C.3: Full Balance Sheet Verification (Phase 4 GATE 2) – font/size/forensic aligned with Table E.Master */}
                <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
                    <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                        <h3 className="text-[16px] font-bold text-black uppercase tracking-wide">Table C.3: Full Balance Sheet Verification (Phase 4 GATE 2)</h3>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Owners Equity, Assets, Liabilities – line-by-line verification per ASSET_VERIFICATION_RULES. Current Year column only.</p>
                        <p className="text-[11px] text-gray-400 mt-2 italic">BS Amount ($) = from Financial Statement Balance Sheet only; Supporting ($) = from R2–R5 evidence only (Bank Stmt, Levy Report, breakdown, GL).</p>
                    </div>
                    {data?.assets_and_cash?.balance_sheet_verification && data.assets_and_cash.balance_sheet_verification.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full table-fixed border-collapse border border-gray-200 text-right [&_td:nth-child(6)]:truncate [&_td:nth-child(1)]:sticky [&_td:nth-child(1)]:left-0 [&_td:nth-child(1)]:z-10 [&_td:nth-child(1)]:bg-white [&_td:nth-child(6)]:sticky [&_td:nth-child(6)]:right-0 [&_td:nth-child(6)]:z-10 [&_td:nth-child(6)]:bg-white">
                                <colgroup>
                                    <col style={{ width: "28%" }} />
                                    <col style={{ width: "12%" }} />
                                    <col style={{ width: "16%" }} />
                                    <col style={{ width: "16%" }} />
                                    <col style={{ width: "12%" }} />
                                    <col style={{ width: "16%", maxWidth: "25%" }} />
                                </colgroup>
                                <thead className="bg-gray-100 text-black uppercase font-bold text-[15px] tracking-wider">
                                    <tr>
                                        <th className="px-5 py-4 text-left border-b border-gray-200 sticky left-0 z-10 bg-gray-100">Line Item</th>
                                        <th className="px-5 py-4 text-left border-b border-gray-200">Fund</th>
                                        <th className="px-5 py-4 text-right border-b border-gray-200">BS Amount ($)</th>
                                        <th className="px-5 py-4 text-right border-b border-gray-200">Supporting ($)</th>
                                        <th className="px-5 py-4 text-center border-b border-gray-200">Status</th>
                                        <th className="px-5 py-4 text-left border-b border-gray-200 pl-4 pr-3 sticky right-0 z-10 bg-gray-100">Note / Source</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-[15px]">
                                    {(() => {
                                        const items = data.assets_and_cash.balance_sheet_verification;
                                        const SECTION_ORDER: Array<'OWNERS_EQUITY' | 'ASSETS' | 'LIABILITIES'> = ['OWNERS_EQUITY', 'ASSETS', 'LIABILITIES'];
                                        const SECTION_LABELS: Record<string, string> = { OWNERS_EQUITY: 'Owners Equity', ASSETS: 'Assets', LIABILITIES: 'Liabilities', Other: 'Other' };
                                        const groups: Array<{ section: string; items: typeof items }> = [];
                                        SECTION_ORDER.forEach((s) => {
                                            const g = items.filter((i) => (i.section || 'ASSETS') === s);
                                            if (g.length > 0) groups.push({ section: s, items: g });
                                        });
                                        const uncategorized = items.filter((i) => !SECTION_ORDER.includes((i.section || 'ASSETS') as 'OWNERS_EQUITY' | 'ASSETS' | 'LIABILITIES'));
                                        if (uncategorized.length > 0) groups.push({ section: 'Other', items: uncategorized });
                                        const rows: React.ReactNode[] = [];
                                        let globalIdx = 0;
                                        groups.forEach(({ section, items: group }) => {
                                            const label = SECTION_LABELS[section] || section;
                                            rows.push(
                                                <tr key={`h-${section}`} className="bg-gray-50/50">
                                                    <td colSpan={6} className="px-5 py-3 text-left font-bold text-gray-800 uppercase text-[14px] tracking-wide">{label}</td>
                                                </tr>
                                            );
                                            group.forEach((item) => {
                                                const idx = globalIdx++;
                                                const evRef = item.evidence_ref || '';
                                                const evParts = evRef.split(/[/,]/);
                                                const srcId = evParts[0]?.trim() || '-';
                                                const pageRef = evParts[1]?.trim() || evRef;
                                                // BS Amount: source is Balance Sheet only – use Step 0 core_data_positions.balance_sheet + year_column when available
                                                const bsDoc = safeData.core_data_positions?.balance_sheet;
                                                const yearColumnLabel = item.year_column || safeData.bs_column_mapping?.current_year_label || 'Current Year column';
                                                const bsTrace: TraceableValue = bsDoc
                                                    ? { amount: item.bs_amount ?? 0, source_doc_id: bsDoc.doc_id, page_ref: `${bsDoc.page_range} › ${yearColumnLabel}`, note: item.note || `From BS column '${yearColumnLabel}'` }
                                                    : { amount: item.bs_amount ?? 0, source_doc_id: 'Balance Sheet (FS)', page_ref: yearColumnLabel, note: item.note || `From BS column '${yearColumnLabel}'` };
                                                const supTrace: TraceableValue = { amount: item.supporting_amount ?? 0, source_doc_id: srcId, page_ref: pageRef, note: item.note || '' };
                                                const noteContent = item.note || item.evidence_ref || '–';
                                                rows.push(
                                                    <tr key={idx} className="group hover:bg-gray-50">
                                                        <td className="px-5 py-3 text-left pl-8 text-gray-600 font-medium sticky left-0 z-10 bg-white group-hover:bg-gray-50">{item.line_item}</td>
                                                        <td className="px-5 py-3 text-left text-gray-600">{item.fund || '–'}</td>
                                                        <td className="px-5 py-3"><ForensicCell val={bsTrace} docs={docs} files={files} /></td>
                                                        <td className="px-5 py-3"><ForensicCell val={supTrace} docs={docs} files={files} /></td>
                                                        <td className="px-5 py-3 text-center"><StatusBadge status={item.status} /></td>
                                                        <td className="px-5 py-3 text-left pl-4 pr-3 text-gray-400 italic text-[13px] sticky right-0 z-10 bg-white group-hover:bg-gray-50">
                                                            {withAction(`bs_${idx}_${(item.line_item || '').replace(/\s+/g, '_')}`, item.line_item || 'Line', noteContent)}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        });
                                        return rows;
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                            <p className="text-gray-600 font-medium mb-2">No balance sheet verification data</p>
                            <p className="text-sm text-gray-500 max-w-md mx-auto">
                                Create a <strong>new plan</strong>, upload evidence (including Financial Statement), and run a <strong>fresh audit</strong> to populate full Balance Sheet verification (Owners Equity, Assets, Liabilities) with Current Year figures.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* EXPENSES – Phase 3 v2 (risk-based) or legacy */}
        {activeTab === 'expense' && data.expense_samples && (() => {
            const isV2 = data.expense_samples.some((s) => s.Risk_Profile && s.Three_Way_Match);
            return (
            <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
                 <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                    <h3 className="text-[16px] font-bold text-black uppercase tracking-wide">Table I.1: Expense Vouching Schedule</h3>
                    {isV2 && <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Risk-based sampling – Three-Way Match & Fund Integrity</p>}
                 </div>
                 <div className="overflow-x-auto">
                    <table className="min-w-full text-left border border-gray-200">
                        <thead className="bg-gray-100 text-black uppercase text-[15px] font-bold tracking-wider">
                            <tr>
                                {isV2 && <th className="px-5 py-4 border-b border-gray-200">Risk</th>}
                                <th className="px-5 py-4 border-b border-gray-200">GL Date / Payee</th>
                                <th className="px-5 py-4 border-b border-gray-200">Amount</th>
                                {isV2 ? (
                                    <>
                                        <th className="px-5 py-4 border-b border-gray-200 text-center" title="Invoice: payee, ABN, addressed to OC">📄 Inv</th>
                                        <th className="px-5 py-4 border-b border-gray-200 text-center" title="Payment: PAID/ACCRUED/MISSING">🏦 Pay</th>
                                        <th className="px-5 py-4 border-b border-gray-200 text-center" title="Authority: Manager/Committee/AGM">⚖️ Auth</th>
                                        <th className="px-5 py-4 border-b border-gray-200">Fund</th>
                                        <th className="px-5 py-4 border-b border-gray-200">Status</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-5 py-4 border-b border-gray-200">Invoice Validity</th>
                                        <th className="px-5 py-4 border-b border-gray-200">Classification Test</th>
                                        <th className="px-5 py-4 border-b border-gray-200">Authority Test</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-[15px]">
                            {data.expense_samples.map((item, idx) => {
                                if (isV2) {
                                    const inv = item.Three_Way_Match?.invoice;
                                    const pay = item.Three_Way_Match?.payment;
                                    const auth = item.Three_Way_Match?.authority;
                                    const fund = item.Fund_Integrity;
                                    const isMisclassified = fund?.classification_status === 'MISCLASSIFIED';
                                    return (
                                        <tr key={idx} className={`hover:bg-gray-50 align-top transition-colors group ${isMisclassified ? 'bg-yellow-50' : ''}`}>
                                            <td className="px-5 py-4 border-r border-gray-100">
                                                {item.Risk_Profile ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.Risk_Profile.is_material && <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-100 text-red-800 rounded">$5k+</span>}
                                                        {(item.Risk_Profile.risk_keywords || []).slice(0, 3).map((k, i) => (
                                                            <span key={i} className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-purple-100 text-purple-800 rounded">{k}</span>
                                                        ))}
                                                    </div>
                                                ) : '–'}
                                            </td>
                                            <td className="px-5 py-4 border-r border-gray-100">
                                                <div className="text-[14px] text-gray-500 mb-1">{item.GL_Date}</div>
                                                <div className="font-bold text-gray-900">{item.GL_Payee}</div>
                                            </td>
                                            <td className="px-5 py-4 font-bold border-r border-gray-100"><ForensicCell val={item.GL_Amount} docs={docs} files={files} /></td>
                                            <td className="px-5 py-4 border-r border-gray-100 text-center">
                                                <button type="button" onClick={() => setExpenseForensic({ pillar: 'INV', rowIndex: idx, item })} className="border-b border-dotted border-[#C5A059] hover:bg-[#C5A059]/10 cursor-pointer px-2 py-1 rounded-sm" title="Click for Forensic Trace">
                                                    {inv ? (inv.addressed_to_strata && inv.payee_match ? '✅' : '❌') : '–'}
                                                </button>
                                            </td>
                                            <td className="px-5 py-4 border-r border-gray-100 text-center">
                                                <button type="button" onClick={() => setExpenseForensic({ pillar: 'PAY', rowIndex: idx, item })} className="border-b border-dotted border-[#C5A059] hover:bg-[#C5A059]/10 cursor-pointer px-2 py-1 rounded-sm" title="Click for Forensic Trace">
                                                    {pay ? (pay.status === 'PAID' ? '✅' : pay.status === 'ACCRUED' ? '⏳' : '❌') : '–'}
                                                </button>
                                            </td>
                                            <td className="px-5 py-4 border-r border-gray-100 text-center">
                                                <button type="button" onClick={() => setExpenseForensic({ pillar: 'AUTH', rowIndex: idx, item })} className="border-b border-dotted border-[#C5A059] hover:bg-[#C5A059]/10 cursor-pointer px-2 py-1 rounded-sm" title="Click for Forensic Trace">
                                                    {auth ? (auth.status === 'AUTHORISED' ? '✅' : auth.status === 'MINUTES_NOT_AVAILABLE' || auth.status === 'NO_MINUTES_FOUND' ? '⚠️' : '❌') : '–'}
                                                </button>
                                            </td>
                                            <td className="px-5 py-4 border-r border-gray-100">
                                                <button type="button" onClick={() => setExpenseForensic({ pillar: 'FUND', rowIndex: idx, item })} className="text-left w-full border-b border-dotted border-[#C5A059] hover:bg-[#C5A059]/10 cursor-pointer px-2 py-1 rounded-sm" title="Click for Forensic Trace">
                                                    {fund ? (
                                                        <>
                                                            <span className={`px-2 py-0.5 text-[11px] font-bold uppercase ${fund.classification_status === 'MISCLASSIFIED' ? 'bg-yellow-200 text-yellow-900' : fund.classification_status === 'UNCERTAIN' ? 'bg-gray-200 text-gray-800' : 'bg-green-100 text-green-800'}`}>{fund.classification_status}</span>
                                                            {isMisclassified && <div className="text-[11px] text-gray-600 mt-1">GL: {fund.gl_fund_code} | Inv: {fund.invoice_nature}</div>}
                                                        </>
                                                    ) : '–'}
                                                </button>
                                            </td>
                                            <td className="px-5 py-4 relative">
                                                {withAction(`exp_${idx}`, `${item.GL_Payee} ($${item.GL_Amount?.amount})`, <StatusBadge status={item.Overall_Status || '–'} />)}
                                            </td>
                                        </tr>
                                    );
                                }
                                return (
                                <tr key={idx} className="hover:bg-gray-50 align-top transition-colors group">
                                    <td className="px-5 py-4 border-r border-gray-100">
                                        <div className="text-[14px] text-gray-500 mb-1">{item.GL_Date}</div>
                                        <div className="font-bold text-gray-900">{item.GL_Payee}</div>
                                    </td>
                                    <td className="px-5 py-4 font-bold border-r border-gray-100"><ForensicCell val={item.GL_Amount} docs={docs} files={files} /></td>
                                    <td className="px-5 py-4 border-r border-gray-100">
                                        <div className="flex flex-col gap-2">
                                            <StatusBadge status={item.Invoice_Status ?? '–'} />
                                            <div className="text-[12px] text-gray-400">{item.Source_Docs?.Invoice_ID ?? '–'}</div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 border-r border-gray-100">
                                         <div className="flex flex-col gap-1">
                                            <div className="text-[14px] text-gray-500">Code: <span className="text-black font-medium">{item.GL_Fund_Code ?? '–'}</span></div>
                                            <div className="text-[14px] italic text-gray-600 mb-1">"{item.Inv_Desc ?? ''}"</div>
                                            <StatusBadge status={item.Class_Result ?? '–'} />
                                         </div>
                                    </td>
                                    <td className="px-5 py-4 relative">
                                         {withAction(`exp_${idx}`, `${item.GL_Payee} ($${item.GL_Amount?.amount})`, (
                                             <div className="flex flex-col gap-1">
                                                <div className="text-[14px] text-gray-500">Limit: ${item.Manager_Limit ?? '–'}</div>
                                                <StatusBadge 
                                                  status={item.Auth_Result ?? '–'} 
                                                  onClick={() => item.verification_steps && setActiveVerificationSteps(item.verification_steps)}
                                                />
                                             </div>
                                         ))}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                 </div>
            </div>
            );
        })()}

        {/* COMPLIANCE (NEW TABLE F.MASTER) */}
        {activeTab === 'compliance' && data.statutory_compliance && (
            <div className="space-y-8">
                 {/* Insurance Table K.1 */}
                 <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
                    <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                        <h3 className="text-[16px] font-bold text-black uppercase tracking-wide">Table K.1: Insurance Adequacy Test</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                             <table className="w-full text-[15px]">
                                <tbody className="divide-y divide-gray-100">
                                    <tr className="group hover:bg-gray-50 relative">
                                        <td className="py-3 px-2 text-gray-600">Suggested Sum Insured</td>
                                        <td className="py-3 px-2 font-medium text-right relative">
                                            {withAction('ins_val', 'Valuation Amount', <ForensicCell val={data.statutory_compliance.insurance.Valuation_Amount} docs={docs} files={files} />)}
                                        </td>
                                    </tr>
                                    <tr className="group hover:bg-gray-50 relative">
                                        <td className="py-3 px-2 text-gray-600">Actual Policy Limit</td>
                                        <td className="py-3 px-2 font-medium text-right relative">
                                            {withAction('ins_pol', 'Policy Amount', <ForensicCell val={data.statutory_compliance.insurance.Policy_Amount} docs={docs} files={files} />)}
                                        </td>
                                    </tr>
                                    <tr className="border-t-2 border-black group hover:bg-gray-50 relative">
                                        <td className="py-3 px-2 font-bold text-black">Variance (Gap)</td>
                                        <td className={`py-3 px-2 font-bold text-right relative`}>
                                            {withAction('ins_gap', 'Insurance Gap', <ForensicCell val={data.statutory_compliance.insurance.Insurance_Gap} docs={docs} textColor={data.statutory_compliance.insurance.Insurance_Gap.amount < 0 ? 'text-red-700' : 'text-green-700'} files={files} />)}
                                        </td>
                                    </tr>
                                </tbody>
                             </table>
                        </div>
                        <div className="flex flex-col justify-center items-center p-6 bg-gray-50 border border-gray-200 relative group">
                             <span className="text-[14px] text-gray-500 uppercase font-bold mb-3 tracking-widest">Overall Status</span>
                             <div className="transform scale-125">
                                 <StatusBadge status={data.statutory_compliance.insurance.Insurance_Status} />
                             </div>
                             <span className="text-[13px] text-gray-500 mt-4 uppercase tracking-wider">Expires: <span className="text-black font-bold">{data.statutory_compliance.insurance.Policy_Expiry}</span></span>
                             <div className="absolute top-2 right-2">
                                <RowAction 
                                   rowId="ins_overall"
                                   tab="compliance" 
                                   title="Insurance Overall" 
                                   triageItems={triageItems} 
                                   onFlag={(item) => onTriage(item, 'add')} 
                                />
                             </div>
                        </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* GST Table F.Master (ROLL FORWARD) */}
                    <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
                        <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                            <h3 className="text-[16px] font-bold text-black uppercase tracking-wide">Table F.Master: GST Control Account Roll-Forward</h3>
                        </div>
                        <table className="w-full text-[15px]">
                            <thead className="bg-gray-100 text-black uppercase font-bold text-[14px] tracking-wider">
                                <tr>
                                    <th className="px-2 py-3 text-left">Movement Item</th>
                                    <th className="px-2 py-3 text-right">Amount ($)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                <tr className="group hover:bg-gray-50 relative">
                                    <td className="py-3 px-2 font-bold text-gray-800">1. Opening Balance</td>
                                    <td className="py-3 px-2 text-right relative">
                                        {withAction('gst_op', 'GST Opening', <ForensicCell val={data.statutory_compliance.gst_reconciliation.GST_Opening_Bal} docs={docs} files={files} />)}
                                    </td>
                                </tr>
                                <tr className="group hover:bg-gray-50 relative">
                                    <td className="py-3 px-2 text-gray-600">2. Add: GST on Levies</td>
                                    <td className="py-3 px-2 text-right relative">
                                        {withAction('gst_add', 'GST on Levies', <ForensicCell val={data.statutory_compliance.gst_reconciliation.Total_GST_Raised} docs={docs} files={files} />)}
                                    </td>
                                </tr>
                                <tr className="group hover:bg-gray-50 relative">
                                    <td className="py-3 px-2 text-gray-600">3. Less: GST on Payments</td>
                                    <td className="py-3 px-2 text-right text-red-700 relative">
                                        {withAction('gst_less', 'GST on Payments', <>(<ForensicCell val={data.statutory_compliance.gst_reconciliation.GST_On_Payments} docs={docs} files={files} />)</>)}
                                    </td>
                                </tr>
                                <tr className="bg-gray-50 border-y border-gray-200 group hover:bg-gray-100 relative">
                                    <td className="py-3 px-2 font-bold text-black">4. (=) Theor. Movement</td>
                                    <td className="py-3 px-2 text-right font-bold relative">
                                        {withAction('gst_mvmt', 'GST Movement', <ForensicCell val={data.statutory_compliance.gst_reconciliation.GST_Theor_Mvmt} docs={docs} files={files} />)}
                                    </td>
                                </tr>
                                
                                {/* BAS Activity */}
                                <tr><td colSpan={2} className="py-2 text-[12px] font-bold text-gray-400 uppercase tracking-widest pl-2">BAS Activity</td></tr>
                                {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => {
                                    // @ts-ignore
                                    const val = data.statutory_compliance.gst_reconciliation[`BAS_${q}`];
                                    return (
                                        <tr key={q} className="group hover:bg-gray-50 relative">
                                            <td className="py-2 px-2 text-gray-600 pl-4">{q} BAS Payment/(Refund)</td>
                                            <td className="py-2 px-2 text-right relative">
                                                {withAction(`bas_${q}`, `${q} BAS`, <ForensicCell val={val} docs={docs} files={files} />)}
                                            </td>
                                        </tr>
                                    );
                                })}

                                <tr className="border-t border-dashed border-gray-300 group hover:bg-gray-50 relative">
                                    <td className="py-2 px-2 font-bold text-gray-700">5. Total BAS Cash</td>
                                    <td className="py-2 px-2 text-right font-bold relative">
                                        {withAction('bas_tot', 'Total BAS', <ForensicCell val={data.statutory_compliance.gst_reconciliation.Total_BAS_Cash} docs={docs} files={files} />)}
                                    </td>
                                </tr>

                                {/* Final Rec */}
                                <tr><td colSpan={2} className="py-3"></td></tr>
                                <tr className="bg-gray-50 border-t border-gray-200 group hover:bg-gray-100 relative">
                                    <td className="py-3 px-2 font-bold text-black">6. Calc Closing Balance</td>
                                    <td className="py-3 px-2 text-right font-bold relative">
                                        {withAction('gst_calc_cl', 'Calc GST Closing', <ForensicCell val={data.statutory_compliance.gst_reconciliation.GST_Calc_Closing} docs={docs} files={files} />)}
                                    </td>
                                </tr>
                                <tr className="group hover:bg-gray-50 relative">
                                    <td className="py-3 px-2 text-gray-600">7. GL Closing Balance</td>
                                    <td className="py-3 px-2 text-right relative">
                                        {withAction('gst_gl_cl', 'GL GST Closing', <ForensicCell val={data.statutory_compliance.gst_reconciliation.GST_GL_Closing} docs={docs} files={files} />)}
                                    </td>
                                </tr>
                                <tr className="border-t-4 border-double border-black group hover:bg-gray-50 relative">
                                    <td className="py-3 px-2 font-bold text-black">8. VARIANCE</td>
                                    <td className="py-3 px-2 text-right font-bold relative">
                                        {withAction('gst_var', 'GST Variance', <ForensicCell val={data.statutory_compliance.gst_reconciliation.GST_Rec_Variance} docs={docs} textColor={data.statutory_compliance.gst_reconciliation.GST_Rec_Variance.amount !== 0 ? 'text-red-700' : 'text-green-700'} files={files} />)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Tax Table L.1 */}
                    <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
                        <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                            <h3 className="text-[16px] font-bold text-black uppercase tracking-wide">Table L.1: Income Tax</h3>
                        </div>
                        <table className="w-full text-[15px]">
                            <tbody className="divide-y divide-gray-100">
                                <tr className="group hover:bg-gray-50 relative">
                                    <td className="py-2 px-2 text-gray-600">Assessable Income</td>
                                    <td className="py-2 px-2 text-right text-gray-800 relative">
                                        {withAction('tax_inc', 'Assessable Income', <>$<ForensicCell val={{
                                            amount: data.statutory_compliance.income_tax.Interest_Income.amount + data.statutory_compliance.income_tax.Other_Taxable_Income.amount,
                                            source_doc_id: data.statutory_compliance.income_tax.Interest_Income.source_doc_id, 
                                            page_ref: "Combined Calc"
                                        }} docs={docs} files={files} /></>)}
                                    </td>
                                </tr>
                                <tr className="group hover:bg-gray-50 relative">
                                    <td className="py-2 px-2 text-gray-600">Less: Deductions</td>
                                    <td className="py-2 px-2 text-right text-gray-800 relative">
                                        {withAction('tax_ded', 'Tax Deductions', <>(<ForensicCell val={data.statutory_compliance.income_tax.Tax_Deductions} docs={docs} files={files} />)</>)}
                                    </td>
                                </tr>
                                <tr className="bg-gray-50 border-y border-gray-200 group hover:bg-gray-100 relative">
                                    <td className="py-3 px-2 font-bold text-black">Taxable Income</td>
                                    <td className="py-3 px-2 text-right font-bold relative">
                                        {withAction('tax_net', 'Taxable Income', <ForensicCell val={data.statutory_compliance.income_tax.Net_Taxable} docs={docs} files={files} />)}
                                    </td>
                                </tr>
                                <tr className="group hover:bg-gray-50 relative">
                                    <td className="py-3 px-2 font-bold text-gray-700">Tax Payable (@ 25%)</td>
                                    <td className="py-3 px-2 text-right font-bold relative">
                                        {withAction('tax_pay', 'Tax Payable', <ForensicCell val={data.statutory_compliance.income_tax.Calc_Tax} docs={docs} files={files} />)}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2} className="pt-4 text-center">
                                        <StatusBadge status={data.statutory_compliance.income_tax.Tax_Adj_Status} />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                 </div>
            </div>
        )}

        {/* COMPLETION */}
        {activeTab === 'completion' && data.completion_outputs && (
            <div className="space-y-8">
                <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
                    <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                        <h3 className="text-[16px] font-bold text-black uppercase tracking-wide">Output A: Issue Register</h3>
                    </div>
                    {data.completion_outputs.issue_register.length === 0 ? (
                        <p className="text-gray-500 italic">No issues identified.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left border border-gray-200">
                                <thead className="bg-red-50 text-red-900 uppercase text-[15px] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-4 border-b border-red-100">ID</th>
                                        <th className="px-5 py-4 border-b border-red-100">Phase</th>
                                        <th className="px-5 py-4 border-b border-red-100">Description</th>
                                        <th className="px-5 py-4 border-b border-red-100">Resolution Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-[15px]">
                                    {data.completion_outputs.issue_register.map((issue) => (
                                        <tr key={issue.Issue_ID} className="bg-white">
                                            <td className="px-5 py-4 text-[14px] text-gray-500">{issue.Issue_ID}</td>
                                            <td className="px-5 py-4 font-bold text-gray-800">{issue.Phase}</td>
                                            <td className="px-5 py-4 text-gray-700">{issue.Description}</td>
                                            <td className="px-5 py-4"><StatusBadge status={issue.Resolution_Status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="bg-white p-8 rounded border border-gray-200 shadow-sm">
                    <div className="border-b-2 border-[#C5A059] pb-3 mb-6">
                        <h3 className="text-[16px] font-bold text-black uppercase tracking-wide">Output B: Boundary Disclosure</h3>
                    </div>
                     {data.completion_outputs.boundary_disclosure.length === 0 ? (
                        <p className="text-gray-500 italic">No boundary limitations to disclose.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left border border-gray-200">
                                <thead className="bg-yellow-50 text-yellow-900 uppercase text-[15px] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-4 border-b border-yellow-100">Area</th>
                                        <th className="px-5 py-4 border-b border-yellow-100">Missing Evidence</th>
                                        <th className="px-5 py-4 border-b border-yellow-100">Why Unresolved</th>
                                        <th className="px-5 py-4 border-b border-yellow-100">Required to Resolve</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-[15px]">
                                    {data.completion_outputs.boundary_disclosure.map((item, idx) => (
                                        <tr key={idx} className="bg-white">
                                            <td className="px-5 py-4 font-bold text-gray-800">{item.Area}</td>
                                            <td className="px-5 py-4 text-red-600 font-medium">{item.What_Is_Missing}</td>
                                            <td className="px-5 py-4 text-gray-600 italic">{item.Why_Unresolved}</td>
                                            <td className="px-5 py-4 text-gray-700">{item.Required_To_Resolve}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
