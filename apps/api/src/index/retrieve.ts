// apps/api/src/index/retrieve.ts - Hybrid vector + keyword retrieval engine with evidence id assignment
import path from 'node:path';
import type { Evidence, Chunk } from '../types.js';
import { getProvider } from '../llm/index.js';
import { loadIndex } from './store.js';
import { STOPWORDS } from '../llm/mock.js';
import { config } from '../config.js';
import { getWorkspaceRoot } from '../ingest/sourceValidator.js';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function computeKeywordScore(query: string, chunk: Chunk, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const targetText = `${chunk.title} ${chunk.text} ${chunk.path || ''}`.toLowerCase();
  let matches = 0;

  for (const token of queryTokens) {
    if (targetText.includes(token)) {
      matches++;
    }
  }

  const tokenOverlap = matches / queryTokens.length;
  let score = 0.5 * tokenOverlap;

  // Boost if query explicitly mentions the file path, file basename, or title
  if (chunk.path) {
    const baseName = path.basename(chunk.path).toLowerCase();
    if (query.toLowerCase().includes(baseName) || query.toLowerCase().includes(chunk.path.toLowerCase())) {
      score += 0.3;
    }
  }

  // Boost if title matches query
  if (queryTokens.some((t) => chunk.title.toLowerCase().includes(t))) {
    score += 0.1;
  }

  // Boost when the query names an identifier found in chunk text
  const cleanQuery = query.trim();
  const isIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(cleanQuery);
  if (isIdentifier) {
    const idRegex = new RegExp(`\\b${cleanQuery}\\b`, 'i');
    if (idRegex.test(chunk.text)) {
      // If it's a file defining/implementing the function/symbol, give higher boost
      const defRegex = new RegExp(`(function|class|const|let|var|def|func)\\s+${cleanQuery}\\b`, 'i');
      if (defRegex.test(chunk.text)) {
        score += 0.45;
      } else if (chunk.kind === 'file') {
        score += 0.25;
      } else {
        score += 0.1;
      }
    }
  } else {
    for (const token of queryTokens) {
      if (token.length >= 3 && /^[a-z0-9_$]+$/.test(token)) {
        const defRegex = new RegExp(`(function|class|const|let|var|def|func)\\s+${token}\\b`, 'i');
        if (defRegex.test(chunk.text)) {
          score += 0.3;
          break;
        }
      }
    }
  }

  return Math.min(1.0, score);
}

export async function retrieve(
  repoId: string,
  query: string,
  k = 8,
  workspaceRoot = getWorkspaceRoot()
): Promise<Evidence[]> {
  const repoManagedDir = path.resolve(workspaceRoot, config.DATA_DIR, 'repos', repoId);
  const index = loadIndex(repoManagedDir);

  if (!index || index.chunks.length === 0) {
    return [];
  }

  const { chunks, vectors, dims } = index;
  const provider = getProvider();

  // Embed query
  const [queryVec] = await provider.embed([query]);

  // Compute scores for each chunk
  const queryTokens = tokenize(query);
  const scoredChunks: Array<{ chunk: Chunk; score: number }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // 1. Cosine similarity
    let dot = 0;
    const offset = i * dims;
    for (let d = 0; d < dims; d++) {
      dot += queryVec[d] * vectors[offset + d];
    }
    const cosine = Math.max(0, dot);

    // 2. Keyword score
    const kwScore = computeKeywordScore(query, chunk, queryTokens);

    // 3. Hybrid score: 0.7 * cosine + 0.3 * keyword score
    const finalScore = 0.7 * cosine + 0.3 * kwScore;

    scoredChunks.push({ chunk, score: finalScore });
  }

  // Sort descending by score
  scoredChunks.sort((a, b) => b.score - a.score);

  // Deduplication: Always keep at most 2 chunks per file to avoid crowding results
  const fileCounts = new Map<string, number>();
  const filtered: Array<{ chunk: Chunk; score: number }> = [];

  for (const item of scoredChunks) {
    if (item.chunk.kind === 'file' && item.chunk.path) {
      const count = fileCounts.get(item.chunk.path) || 0;
      if (count >= 2) {
        continue; // Skip excess chunks from the same file
      }
      fileCounts.set(item.chunk.path, count + 1);
    }

    filtered.push(item);
    if (filtered.length >= k) {
      break;
    }
  }

  // Assign sequential ids E1..Ek by descending score
  return filtered.map((item, idx) => ({
    ...item.chunk,
    eid: `E${idx + 1}`,
    score: item.score,
  }));
}
