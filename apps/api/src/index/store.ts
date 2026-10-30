// apps/api/src/index/store.ts - On-disk vector and chunk index persistence
import path from 'node:path';
import fs from 'node:fs';
import type { Chunk, Repo } from '../types.js';

export interface LoadedIndex {
  chunks: Chunk[];
  vectors: Float32Array;
  dims: number;
}

export function saveIndex(
  repoManagedDir: string,
  chunks: Chunk[],
  vectors: Float32Array,
  dims: number,
  headSha?: string
) {
  // 1. chunks.json
  const chunksPath = path.join(repoManagedDir, 'chunks.json');
  fs.writeFileSync(chunksPath, JSON.stringify(chunks, null, 2), 'utf8');

  // 2. vectors.f32
  const vectorsPath = path.join(repoManagedDir, 'vectors.f32');
  const buffer = Buffer.from(vectors.buffer, vectors.byteOffset, vectors.byteLength);
  fs.writeFileSync(vectorsPath, buffer);

  // 3. Update meta.json with chunksIndexed, dims, headSha
  const metaPath = path.join(repoManagedDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Repo & { headSha?: string; dims?: number };
      meta.chunksIndexed = chunks.length;
      meta.dims = dims;
      if (headSha) {
        meta.headSha = headSha;
      }
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    } catch {
      // Ignore meta update failure
    }
  }
}

export function loadIndex(repoManagedDir: string): LoadedIndex | null {
  const chunksPath = path.join(repoManagedDir, 'chunks.json');
  const vectorsPath = path.join(repoManagedDir, 'vectors.f32');
  const metaPath = path.join(repoManagedDir, 'meta.json');

  if (!fs.existsSync(chunksPath) || !fs.existsSync(vectorsPath) || !fs.existsSync(metaPath)) {
    return null;
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { dims?: number };
    const dims = meta.dims || 256;

    const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf8')) as Chunk[];
    const buf = fs.readFileSync(vectorsPath);
    const vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

    return { chunks, vectors, dims };
  } catch {
    return null;
  }
}

export function isIndexUpToDate(repoManagedDir: string, currentHeadSha?: string): boolean {
  const chunksPath = path.join(repoManagedDir, 'chunks.json');
  const vectorsPath = path.join(repoManagedDir, 'vectors.f32');
  const metaPath = path.join(repoManagedDir, 'meta.json');

  if (!fs.existsSync(chunksPath) || !fs.existsSync(vectorsPath) || !fs.existsSync(metaPath)) {
    return false;
  }

  if (!currentHeadSha) {
    return true;
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { headSha?: string };
    return meta.headSha === currentHeadSha;
  } catch {
    return false;
  }
}
