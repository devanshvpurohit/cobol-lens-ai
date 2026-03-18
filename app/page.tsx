'use client';

import { useState, useCallback, useMemo } from 'react';
import Upload from '@/components/Upload';
import CodeViewer from '@/components/CodeViewer';
import ChatPanel from '@/components/ChatPanel';
import Graph from '@/components/Graph';
import { CobolFile, buildGraphData, GraphData } from '@/lib/cobolParser';

export default function Home() {
  const [files, setFiles] = useState<CobolFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<CobolFile | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [rightPanel, setRightPanel] = useState<'code' | 'chat'>('code');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Build graph whenever files change
  const graphData: GraphData = useMemo(() => buildGraphData(files), [files]);

  const handleFilesUploaded = useCallback((newFiles: CobolFile[]) => {
    setFiles(newFiles);
    if (newFiles.length === 0) {
      setSelectedFile(null);
      setSelectedNodeId(null);
      setExplanation(null);
    }
  }, []);

  const handleFileSelect = useCallback(
    (file: CobolFile) => {
      setSelectedFile(file);
      setSelectedNodeId(
        file.programId || file.name.replace(/\.(cob|cbl|cpy)$/i, '').toUpperCase()
      );
      setExplanation(null);
      setRightPanel('code');
    },
    []
  );

  const handleNodeClick = useCallback(
    (nodeId: string, fileName: string) => {
      setSelectedNodeId(nodeId);
      if (fileName) {
        const file = files.find((f) => f.name === fileName);
        if (file) {
          setSelectedFile(file);
          setExplanation(null);
          setRightPanel('code');
        }
      }
    },
    [files]
  );

  const handleSaveApiKey = useCallback(() => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setApiKeySaved(true);
  }, [apiKeyInput]);

  const handleExplain = useCallback(async (code: string) => {
    if (!apiKey) {
      setExplanation('⚠️ Please enter and save your Gemini API Key in the top right corner.');
      return;
    }
    setIsExplaining(true);
    setExplanation(null);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExplanation(data.explanation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to explain code';
      setExplanation(`⚠️ Error: ${msg}`);
    } finally {
      setIsExplaining(false);
    }
  }, [apiKey]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface/50 backdrop-blur-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-accent/30">
              C
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border-2 border-surface" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight">
              CobolLens <span className="text-accent">AI</span>
            </h1>
            <p className="text-[10px] text-text-muted -mt-0.5">COBOL Code Intelligence Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* API Key input + save */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <input
                type="password"
                placeholder="Gemini API Key"
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setApiKeySaved(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                className={`w-48 px-3 py-1.5 text-xs bg-surface border rounded-lg text-foreground placeholder:text-text-muted focus:outline-none transition-all ${
                  apiKeySaved
                    ? 'border-success focus:border-success'
                    : 'border-border focus:border-accent'
                }`}
              />
            </div>
            {apiKeySaved ? (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success/15 border border-success/40 text-success text-xs font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Saved
              </div>
            ) : (
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className="px-3 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm shadow-accent/20"
              >
                Save Key
              </button>
            )}
          </div>
          {/* Stats Badges */}
          {files.length > 0 && (
            <div className="hidden md:flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-semibold border border-accent/20">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-success/10 text-success text-[10px] font-semibold border border-success/20">
                {graphData.nodes.length} node{graphData.nodes.length !== 1 ? 's' : ''}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-warning/10 text-warning text-[10px] font-semibold border border-warning/20">
                {graphData.edges.length} edge{graphData.edges.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {/* Demo button */}
          <button
            onClick={() => {
              const demoFiles: CobolFile[] = [
                {
                  name: 'MAIN-PROGRAM.cob',
                  programId: 'MAIN-PROGRAM',
                  content: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. MAIN-PROGRAM.\n       AUTHOR. DEMO.\n      *\n       ENVIRONMENT DIVISION.\n       DATA DIVISION.\n       WORKING-STORAGE SECTION.\n       01 WS-RESULT PIC 9(5).\n       01 WS-NAME PIC X(30) VALUE 'CUSTOMER'.\n      *\n       PROCEDURE DIVISION.\n           DISPLAY 'STARTING MAIN PROGRAM'\n           CALL 'CALC-MODULE'\n           CALL 'REPORT-GEN'\n           DISPLAY 'RESULT: ' WS-RESULT\n           STOP RUN.\n`,
                  calls: ['CALC-MODULE', 'REPORT-GEN'],
                },
                {
                  name: 'CALC-MODULE.cob',
                  programId: 'CALC-MODULE',
                  content: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. CALC-MODULE.\n      *\n       ENVIRONMENT DIVISION.\n       DATA DIVISION.\n       WORKING-STORAGE SECTION.\n       01 WS-NUM1 PIC 9(5) VALUE 100.\n       01 WS-NUM2 PIC 9(5) VALUE 200.\n       01 WS-TOTAL PIC 9(5).\n      *\n       PROCEDURE DIVISION.\n           ADD WS-NUM1 TO WS-NUM2 GIVING WS-TOTAL\n           CALL 'DATA-ACCESS'\n           DISPLAY 'TOTAL: ' WS-TOTAL\n           GOBACK.\n`,
                  calls: ['DATA-ACCESS'],
                },
                {
                  name: 'REPORT-GEN.cob',
                  programId: 'REPORT-GEN',
                  content: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. REPORT-GEN.\n      *\n       ENVIRONMENT DIVISION.\n       DATA DIVISION.\n       WORKING-STORAGE SECTION.\n       01 WS-DATE PIC X(10).\n       01 WS-REPORT-LINE PIC X(80).\n      *\n       PROCEDURE DIVISION.\n           MOVE FUNCTION CURRENT-DATE TO WS-DATE\n           STRING 'Report Generated: ' WS-DATE\n               DELIMITED BY SIZE\n               INTO WS-REPORT-LINE\n           CALL 'DATA-ACCESS'\n           DISPLAY WS-REPORT-LINE\n           GOBACK.\n`,
                  calls: ['DATA-ACCESS'],
                },
                {
                  name: 'DATA-ACCESS.cob',
                  programId: 'DATA-ACCESS',
                  content: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. DATA-ACCESS.\n      *\n       ENVIRONMENT DIVISION.\n       INPUT-OUTPUT SECTION.\n       FILE-CONTROL.\n           SELECT CUSTOMER-FILE ASSIGN TO 'CUSTFILE'\n               ORGANIZATION IS INDEXED\n               ACCESS MODE IS DYNAMIC\n               RECORD KEY IS CUST-ID.\n      *\n       DATA DIVISION.\n       FILE SECTION.\n       FD CUSTOMER-FILE.\n       01 CUSTOMER-RECORD.\n           05 CUST-ID PIC 9(5).\n           05 CUST-NAME PIC X(30).\n           05 CUST-BALANCE PIC 9(7)V99.\n      *\n       PROCEDURE DIVISION.\n           OPEN INPUT CUSTOMER-FILE\n           READ CUSTOMER-FILE\n           DISPLAY 'Customer: ' CUST-NAME\n           CLOSE CUSTOMER-FILE\n           GOBACK.\n`,
                  calls: [],
                },
              ];
              setFiles(demoFiles);
              setSelectedFile(demoFiles[0]);
              setSelectedNodeId('MAIN-PROGRAM');
              setExplanation(null);
            }}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface hover:bg-surface-hover text-text-secondary border border-border hover:border-accent/30 transition-all font-medium"
          >
            🎮 Load Demo
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR — File Upload & List */}
        <aside className="w-60 border-r border-border bg-surface/30 flex-shrink-0 flex flex-col overflow-hidden">
          <Upload
            files={files}
            selectedFile={selectedFile}
            onFilesUploaded={handleFilesUploaded}
            onFileSelect={handleFileSelect}
          />
        </aside>

        {/* CENTER — Graph */}
        <main className="flex-1 relative overflow-hidden">
          <Graph
            graphData={graphData}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
          />
          {/* Graph Legend */}
          {graphData.nodes.length > 0 && (
            <div className="absolute bottom-4 right-4 bg-surface/90 backdrop-blur-sm border border-border rounded-xl px-3 py-2 text-[10px] space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-text-muted">Local program</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-text-muted">External reference</span>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR — Code Viewer + Chat */}
        <aside className="w-[420px] border-l border-border bg-surface/30 flex-shrink-0 flex flex-col overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex border-b border-border flex-shrink-0">
            <button
              onClick={() => setRightPanel('code')}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-all ${
                rightPanel === 'code'
                  ? 'text-accent border-b-2 border-accent bg-accent/5'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              📄 Code Viewer
            </button>
            <button
              onClick={() => setRightPanel('chat')}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-all ${
                rightPanel === 'chat'
                  ? 'text-accent border-b-2 border-accent bg-accent/5'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              💬 AI Chat
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {rightPanel === 'code' ? (
              <CodeViewer
                file={selectedFile}
                onExplain={handleExplain}
                explanation={explanation}
                isExplaining={isExplaining}
              />
            ) : (
              <ChatPanel
                selectedCode={selectedFile?.content || null}
                selectedFileName={selectedFile?.name || null}
                apiKey={apiKey}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
