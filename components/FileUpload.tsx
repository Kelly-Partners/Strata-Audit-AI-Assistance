import React from 'react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, selectedFiles }) => {
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
              className="w-10 h-10 mb-4 text-gray-400 group-hover:text-[#C5A059] transition-colors"
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
            <p className="mb-2 text-sm text-gray-600 font-medium">
              <span className="font-bold text-[#C5A059]">CLICK TO UPLOAD</span> EVIDENCE
            </p>
            <p className="text-xs text-gray-400 uppercase tracking-wider">PDF, XLSX, CSV (Max 10MB)</p>
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
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded shadow-sm hover:border-[#C5A059] transition-colors"
            >
              <div className="flex items-center space-x-3 truncate">
                <span className="text-[10px] bg-[#C5A059] text-black px-1.5 py-0.5 font-bold uppercase tracking-widest rounded-sm">
                  {file.name.split('.').pop()?.toUpperCase()}
                </span>
                <span className="text-sm text-gray-800 font-medium truncate">{file.name}</span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-red-600 p-1 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};