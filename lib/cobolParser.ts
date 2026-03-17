export interface CobolFile {
  name: string;
  content: string;
  programId: string | null;
  calls: string[];
}

export interface GraphData {
  nodes: { id: string; data: { label: string; fileName: string }; position: { x: number; y: number } }[];
  edges: { id: string; source: string; target: string; animated: boolean }[];
}

/**
 * Extract the PROGRAM-ID from COBOL source code.
 * Handles variations like:
 *   PROGRAM-ID. MY-PROGRAM.
 *   PROGRAM-ID. MY-PROGRAM
 *   PROGRAM-ID  MY-PROGRAM.
 */
function extractProgramId(content: string): string | null {
  const regex = /PROGRAM-ID[\.\s]+([A-Za-z0-9_-]+)/i;
  const match = content.match(regex);
  return match ? match[1].replace(/\.$/, '').toUpperCase() : null;
}

/**
 * Extract CALL statements from COBOL source code.
 * Handles:
 *   CALL 'PROGRAM-A'
 *   CALL "PROGRAM-A"
 *   CALL PROGRAM-A
 */
function extractCalls(content: string): string[] {
  const calls: string[] = [];
  const regex = /CALL\s+['"]?([A-Za-z0-9_-]+)['"]?/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const target = match[1].toUpperCase();
    if (!calls.includes(target)) {
      calls.push(target);
    }
  }
  return calls;
}

/**
 * Parse a single COBOL file and return structured data.
 */
export function parseCobolFile(name: string, content: string): CobolFile {
  return {
    name,
    content,
    programId: extractProgramId(content),
    calls: extractCalls(content),
  };
}

/**
 * Parse multiple COBOL files and build graph data for React Flow.
 */
export function buildGraphData(files: CobolFile[]): GraphData {
  const nodeSet = new Set<string>();
  const nodeFileMap = new Map<string, string>();

  // Collect all known program IDs
  for (const file of files) {
    const id = file.programId || file.name.replace(/\.(cob|cbl|cpy)$/i, '').toUpperCase();
    nodeSet.add(id);
    nodeFileMap.set(id, file.name);
  }

  // Also add any called programs that aren't in our file set
  for (const file of files) {
    for (const call of file.calls) {
      if (!nodeSet.has(call)) {
        nodeSet.add(call);
        nodeFileMap.set(call, ''); // external — no file
      }
    }
  }

  // Position nodes in a grid layout
  const nodeArray = Array.from(nodeSet);
  const cols = Math.max(3, Math.ceil(Math.sqrt(nodeArray.length)));
  const spacingX = 280;
  const spacingY = 120;

  const nodes = nodeArray.map((id, index) => ({
    id,
    data: {
      label: id,
      fileName: nodeFileMap.get(id) || '',
    },
    position: {
      x: (index % cols) * spacingX + 50,
      y: Math.floor(index / cols) * spacingY + 50,
    },
  }));

  // Build edges
  const edges: GraphData['edges'] = [];
  for (const file of files) {
    const sourceId = file.programId || file.name.replace(/\.(cob|cbl|cpy)$/i, '').toUpperCase();
    for (const target of file.calls) {
      edges.push({
        id: `${sourceId}->${target}`,
        source: sourceId,
        target,
        animated: true,
      });
    }
  }

  return { nodes, edges };
}

/**
 * Highlight COBOL code by wrapping keywords/strings/comments in spans.
 * Returns HTML string.
 */
export function highlightCobol(code: string): string {
  const lines = code.split('\n');
  return lines
    .map((line) => {
      // Comment lines (col 7 = *)
      if (line.length > 6 && line[6] === '*') {
        return `<span class="cobol-comment">${escapeHtml(line)}</span>`;
      }

      let result = escapeHtml(line);

      // Divisions
      result = result.replace(
        /\b(IDENTIFICATION\s+DIVISION|ENVIRONMENT\s+DIVISION|DATA\s+DIVISION|PROCEDURE\s+DIVISION)\b/gi,
        '<span class="cobol-division">$1</span>'
      );

      // Keywords
      const keywords = [
        'PROGRAM-ID', 'AUTHOR', 'WORKING-STORAGE', 'SECTION', 'LINKAGE',
        'FILE', 'FD', 'COPY', 'REPLACE', 'PERFORM', 'CALL', 'USING',
        'MOVE', 'TO', 'ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'COMPUTE',
        'IF', 'ELSE', 'END-IF', 'EVALUATE', 'WHEN', 'END-EVALUATE',
        'DISPLAY', 'ACCEPT', 'STOP', 'RUN', 'GOBACK', 'EXIT',
        'OPEN', 'CLOSE', 'READ', 'WRITE', 'REWRITE', 'DELETE',
        'PIC', 'PICTURE', 'VALUE', 'OCCURS', 'TIMES', 'REDEFINES',
        'NOT', 'AND', 'OR', 'EQUAL', 'GREATER', 'LESS', 'THAN',
        'INITIALIZE', 'STRING', 'UNSTRING', 'INSPECT', 'TALLYING',
        'SET', 'GO', 'THRU', 'THROUGH', 'UNTIL', 'VARYING',
        'RETURNING', 'GIVING', 'INTO', 'FROM', 'BY', 'WITH',
        'INPUT', 'OUTPUT', 'I-O', 'EXTEND',
      ];
      const kwPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
      result = result.replace(kwPattern, '<span class="cobol-keyword">$1</span>');

      // Strings
      result = result.replace(
        /(['"])(.*?)\1/g,
        '<span class="cobol-string">$1$2$1</span>'
      );

      // Numbers
      result = result.replace(
        /\b(\d+)\b/g,
        '<span class="cobol-number">$1</span>'
      );

      return result;
    })
    .join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
