'use client';

import { useState, useMemo } from 'react';
import { CobolFile } from '@/lib/cobolParser';

interface CodeViewerProps {
  file: CobolFile | null;
  onExplain: (code: string) => void;
  explanation: string | null;
  isExplaining: boolean;
}

// Use a placeholder system to avoid regex passes corrupting each other's HTML
const PLACEHOLDERS: Array<{ placeholder: string; html: string }> = [];
let placeholderIndex = 0;

function resetPlaceholders() {
  PLACEHOLDERS.length = 0;
  placeholderIndex = 0;
}

function addPlaceholder(html: string): string {
  const ph = `\x00PH${placeholderIndex++}\x00`;
  PLACEHOLDERS.push({ placeholder: ph, html });
  return ph;
}

function resolvePlaceholders(text: string): string {
  let result = text;
  for (const { placeholder, html } of PLACEHOLDERS) {
    result = result.replace(placeholder, html);
  }
  return result;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightLine(line: string): string {
  resetPlaceholders();

  // Comment lines (col 7 = *)
  if (line.length > 6 && line[6] === '*') {
    return `<span style="color:#546e7a;font-style:italic">${escHtml(line)}</span>`;
  }

  let result = escHtml(line);

  // 1. Divisions (most specific, replace first)
  result = result.replace(
    /\b(IDENTIFICATION\s+DIVISION|ENVIRONMENT\s+DIVISION|DATA\s+DIVISION|PROCEDURE\s+DIVISION)\b/gi,
    (_match, p1) => addPlaceholder(`<span style="color:#89ddff;font-weight:700">${p1}</span>`)
  );

  // 2. Strings (before keywords to protect string contents)
  result = result.replace(
    /'([^']*)'/g,
    (_match, p1) => addPlaceholder(`<span style="color:#c3e88d">'${p1}'</span>`)
  );

  // 3. Keywords
  const kw = [
    'PROGRAM-ID','AUTHOR','WORKING-STORAGE','SECTION','LINKAGE',
    'FILE','FD','COPY','REPLACE','PERFORM','CALL','USING',
    'MOVE','TO','ADD','SUBTRACT','MULTIPLY','DIVIDE','COMPUTE',
    'IF','ELSE','END-IF','EVALUATE','WHEN','END-EVALUATE',
    'DISPLAY','ACCEPT','STOP','RUN','GOBACK','EXIT',
    'OPEN','CLOSE','READ','WRITE','REWRITE','DELETE',
    'PIC','PICTURE','VALUE','OCCURS','TIMES','REDEFINES',
    'NOT','AND','OR','EQUAL','GREATER','LESS','THAN',
    'INITIALIZE','STRING','UNSTRING','INSPECT','TALLYING',
    'SET','GO','THRU','THROUGH','UNTIL','VARYING',
    'RETURNING','GIVING','INTO','FROM','BY','WITH',
    'INPUT','OUTPUT','I-O','EXTEND','DELIMITED','SIZE',
    'FUNCTION','CURRENT-DATE','ORGANIZATION','INDEXED',
    'ACCESS','MODE','DYNAMIC','RECORD','KEY','ASSIGN','SELECT',
  ];
  const kwPattern = new RegExp(`\\b(${kw.join('|')})\\b`, 'gi');
  result = result.replace(kwPattern, (_match, p1) =>
    addPlaceholder(`<span style="color:#c792ea;font-weight:600">${p1}</span>`)
  );

  // 4. Level numbers at start (01, 05, etc.)
  result = result.replace(
    /^(\s*)(01|05|10|15|20|25|49|66|77|88)\b/,
    (_match, spaces, num) => spaces + addPlaceholder(`<span style="color:#ffcb6b;font-weight:700">${num}</span>`)
  );

  // 5. Numbers (only remaining unprotected numbers)
  result = result.replace(
    /\b(\d+)\b/g,
    (_match, p1) => addPlaceholder(`<span style="color:#f78c6c">${p1}</span>`)
  );

  // Resolve all placeholders back to HTML
  return resolvePlaceholders(result);
}

export default function CodeViewer({ file, onExplain, explanation, isExplaining }: CodeViewerProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  const lines = useMemo(() => {
    if (!file) return [];
    return file.content.split('\n');
  }, [file]);

  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted gap-3 px-6">
        <svg className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium mb-1">No File Selected</p>
          <p className="text-xs">Click a node in the graph or select a file from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
          <span className="text-sm font-semibold text-foreground truncate">{file.name}</span>
          {file.programId && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium flex-shrink-0">
              {file.programId}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
              showExplanation
                ? 'bg-accent text-white'
                : 'bg-surface hover:bg-surface-hover text-text-secondary border border-border'
            }`}
          >
            {showExplanation ? '✕ Code' : '📖 View Explanation'}
          </button>
          <button
            onClick={() => {
              onExplain(file.content);
              setShowExplanation(true);
            }}
            disabled={isExplaining}
            className="px-3 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-accent/20"
          >
            {isExplaining ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Explaining…
              </>
            ) : (
              <>✨ Explain</>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {showExplanation && explanation ? (
          <div className="p-4 animate-fade-in">
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🧠</span>
                <h3 className="text-sm font-bold text-accent m-0">AI Explanation</h3>
              </div>
              <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {explanation}
              </div>
            </div>
          </div>
        ) : showExplanation && isExplaining ? (
          <div className="p-4 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-text-muted">Analyzing COBOL code…</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <pre className="p-0 m-0 text-xs leading-6 font-mono overflow-auto bg-code-bg">
              <code>
                {lines.map((line, i) => (
                  <div key={i} className="flex hover:bg-white/[0.03] group">
                    <span className="inline-block w-12 text-right pr-4 text-text-muted/40 select-none flex-shrink-0 text-[11px] border-r border-border/20 mr-4">
                      {i + 1}
                    </span>
                    <span
                      className="flex-1 whitespace-pre text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: highlightLine(line) }}
                    />
                  </div>
                ))}
              </code>
            </pre>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-muted flex-shrink-0">
        <span>{lines.length} lines</span>
        <span>{file.content.length.toLocaleString()} chars</span>
        <span>{file.calls.length} CALL{file.calls.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
