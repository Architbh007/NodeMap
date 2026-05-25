import { readFileSync } from 'fs';
import type { FunctionInfo, ClassInfo } from '@nodemap/types';

const PARSEABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro']);

function countBraces(line: string): number {
  let depth = 0;
  let inStr = false;
  let strCh = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === strCh) inStr = false;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true; strCh = ch;
    } else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '/' && line[i + 1] === '/') break;
  }
  return depth;
}

const FUNC_DECL_RE = /^(export\s+)?(default\s+)?(async\s+)?function\s+(\w+)/;
const CONST_FN_RE = /^(export\s+)?(const|let)\s+(\w+)/;
const CLASS_DECL_RE = /^(export\s+)?(abstract\s+)?(default\s+)?class\s+(\w+)/;
const METHOD_RE = /^\s{2,}(?:(?:public|private|protected|static|async|override|readonly)\s+)*(\w+)\s*[<(]/;

const SKIP_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'throw',
  'new', 'typeof', 'instanceof', 'delete', 'void', 'await',
  'import', 'export', 'const', 'let', 'var',
]);

export interface Symbols {
  functions: FunctionInfo[];
  classes: ClassInfo[];
}

export function extractSymbols(filePath: string, ext: string): Symbols {
  if (!PARSEABLE.has(ext)) return { functions: [], classes: [] };

  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return { functions: [], classes: [] };
  }

  const lines = content.split('\n');
  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];

  let depth = 0;
  let currentClass: {
    name: string; isExported: boolean; lineStart: number;
    methods: string[]; classDepth: number;
  } | null = null;

  const seenFuncs = new Set<string>();
  const seenClasses = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trimStart();

    if (depth === 0) {
      const funcMatch = FUNC_DECL_RE.exec(trimmed);
      if (funcMatch) {
        const name = funcMatch[4];
        if (!seenFuncs.has(name)) {
          seenFuncs.add(name);
          functions.push({
            name,
            isExported: !!funcMatch[1],
            isAsync: !!funcMatch[3],
            params: [],
            lineStart: lineNum,
            lineEnd: lineNum,
          });
        }
      } else {
        const constMatch = CONST_FN_RE.exec(trimmed);
        if (constMatch && (line.includes('=>') || /=\s*(async\s+)?function/.test(line))) {
          const name = constMatch[3];
          if (!seenFuncs.has(name)) {
            seenFuncs.add(name);
            functions.push({
              name,
              isExported: !!constMatch[1],
              isAsync: line.includes('async'),
              params: [],
              lineStart: lineNum,
              lineEnd: lineNum,
            });
          }
        }
      }

      const classMatch = CLASS_DECL_RE.exec(trimmed);
      if (classMatch) {
        const name = classMatch[4];
        if (!seenClasses.has(name)) {
          seenClasses.add(name);
          currentClass = {
            name,
            isExported: !!classMatch[1],
            lineStart: lineNum,
            methods: [],
            classDepth: depth + 1,
          };
        }
      }
    }

    if (currentClass && depth === currentClass.classDepth) {
      const methodMatch = METHOD_RE.exec(line);
      if (methodMatch) {
        const methodName = methodMatch[1];
        if (!SKIP_KEYWORDS.has(methodName) && !currentClass.methods.includes(methodName)) {
          currentClass.methods.push(methodName);
        }
      }
    }

    depth += countBraces(line);

    if (currentClass && depth < currentClass.classDepth) {
      classes.push({
        name: currentClass.name,
        isExported: currentClass.isExported,
        methods: currentClass.methods,
        properties: [],
        lineStart: currentClass.lineStart,
        lineEnd: lineNum,
      });
      currentClass = null;
    }
  }

  if (currentClass) {
    classes.push({
      name: currentClass.name,
      isExported: currentClass.isExported,
      methods: currentClass.methods,
      properties: [],
      lineStart: currentClass.lineStart,
      lineEnd: lines.length,
    });
  }

  return { functions, classes };
}
