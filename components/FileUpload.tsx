import React from 'react';

interface FileMetaEntry {
  uploadedAt: number;
  batch: "initial" | "additional";
}

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
  fileMeta?: FileMetaEntry[];
  planCreatedAt?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, selectedFiles, fileMeta, planCreatedAt }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      onFilesSelected([...selectedFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesSelected(newFiles);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="dropzone-file"
          className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300 border-dashed rounded cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-10 h-10 mb-4 text-gray-400 group-hover:text-[#004F9F] transition-colors"
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
            <p className="mb-2 text-caption text-gray-600 font-bold uppercase tracking-wider">
              <span className="text-[#004F9F]">CLICK TO UPLOAD</span> EVIDENCE
            </p>
            <p className="text-micro text-gray-400 uppercase tracking-widest">PDF, XLSX, CSV (Max 10MB)</p>
          </div>
          <input
            id="dropzone-file"
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.xlsx,.csv"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {selectedFiles.map((file, index) => {
            const meta = fileMeta?.[index] ?? { uploadedAt: planCreatedAt ?? Date.now(), batch: "initial" as const };
            const uploadTime = new Date(meta.uploadedAt).toLocaleString('en-AU', { 
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            });
            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded shadow-sm hover:border-[#004F9F] transition-colors group"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-micro bg-[#004F9F] text-white px-1.5 py-0.5 font-bold uppercase tracking-widest rounded-sm shrink-0">
                    {file.name.split('.').pop()?.toUpperCase()}
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-caption text-gray-800 font-medium truncate">{file.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-tiny px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        meta.batch === 'initial' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {meta.batch === 'initial' ? 'Initial' : 'Additional'}
                      </span>
                      <span className="text-micro text-gray-400 font-mono">{uploadTime}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-600 p-1 transition-colors shrink-0"
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};