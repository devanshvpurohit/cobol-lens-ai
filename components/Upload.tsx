'use client';

import { useCallback, useRef } from 'react';
import { CobolFile, parseCobolFile } from '@/lib/cobolParser';

interface UploadProps {
  files: CobolFile[];
  selectedFile: CobolFile | null;
  onFilesUploaded: (files: CobolFile[]) => void;
  onFileSelect: (file: CobolFile) => void;
}

const ALLOWED_EXTENSIONS = ['.cob', '.cbl', '.cpy'];
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export default function Upload({ files, selectedFile, onFilesUploaded, onFileSelect }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const newFiles: CobolFile[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();

        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          alert(`File "${file.name}" exceeds 1MB limit.`);
          continue;
        }

        const content = await file.text();
        newFiles.push(parseCobolFile(file.name, content));
      }

      if (newFiles.length > 0) {
        onFilesUploaded([...files, ...newFiles]);
      }
    },
    [files, onFilesUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleClear = () => {
    onFilesUploaded([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <h2 className="text-sm font-semibold text-foreground tracking-wide uppercase">
            Files
          </h2>
        </div>
        <p className="text-xs text-text-muted">
          {files.length} file{files.length !== 1 ? 's' : ''} loaded
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className="mx-3 mt-3 mb-2 border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer transition-all hover:border-accent hover:bg-accent/5 group"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".cob,.cbl,.cpy"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          <svg
            className="w-8 h-8 text-text-muted group-hover:text-accent transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.832 3.376A3.75 3.75 0 0118 19.5H6.75z"
            />
          </svg>
          <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">
            Drop <strong>.cob / .cbl / .cpy</strong> files
            <br />or click to browse
          </span>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {files.map((file, idx) => {
          const isSelected = selectedFile?.name === file.name;
          return (
            <button
              key={`${file.name}-${idx}`}
              onClick={() => onFileSelect(file)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all text-sm group flex items-center gap-2 ${
                isSelected
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'hover:bg-surface-hover text-text-secondary border border-transparent'
              }`}
            >
              <svg
                className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-accent' : 'text-text-muted'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-xs">{file.name}</p>
                <p className={`text-[10px] ${isSelected ? 'text-accent/70' : 'text-text-muted'}`}>
                  {file.programId || 'No Program ID'} · {file.calls.length} call{file.calls.length !== 1 ? 's' : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Clear Button */}
      {files.length > 0 && (
        <div className="px-3 pb-3">
          <button
            onClick={handleClear}
            className="w-full py-2 text-xs font-medium text-danger/80 hover:text-danger hover:bg-danger/10 rounded-lg transition-all border border-transparent hover:border-danger/20"
          >
            Clear All Files
          </button>
        </div>
      )}
    </div>
  );
}
