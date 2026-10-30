// apps/api/src/index/embed.ts - Batched vector embeddings calculation
import type { Chunk } from '../types.js';
import { getProvider } from '../llm/index.js';

const BATCH_SIZE = 16;

export interface EmbedResult {
  vectors: Float32Array;
  dims: number;
}

export async function embedChunks(
  chunks: Chunk[],
  onProgress?: (processed: number, total: number) => void
): Promise<EmbedResult> {
  if (chunks.length === 0) {
    return { vectors: new Float32Array(0), dims: 256 };
  }

  const provider = getProvider();
  const allVectors: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => `${c.title}\n${c.text}`);

    const batchEmbeddings = await provider.embed(texts);
    for (const vec of batchEmbeddings) {
      allVectors.push(vec);
    }

    if (onProgress) {
      onProgress(Math.min(i + batch.length, chunks.length), chunks.length);
    }
  }

  const dims = allVectors[0]?.length || 256;
  const flat = new Float32Array(chunks.length * dims);

  for (let i = 0; i < allVectors.length; i++) {
    const vec = allVectors[i];
    for (let d = 0; d < dims; d++) {
      flat[i * dims + d] = vec[d] || 0;
    }
  }

  return { vectors: flat, dims };
}
