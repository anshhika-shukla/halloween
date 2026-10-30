// apps/api/src/llm/mock.ts - Deterministic Mock LLM Provider for offline test verification
import type { ChatParams, ChatResult, LLMProvider } from './provider.js';

export const CANNED_FIX_DIFF = `diff --git a/src/todo.js b/src/todo.js
index e73d403..f0edb8b 100644
--- a/src/todo.js
+++ b/src/todo.js
@@ -11,6 +11,6 @@ function listTodos(list) {
 }
 // Count todos that are not finished yet.
 function pendingCount(list) {
-  return list.filter((t) => (t.done = false)).length;
+  return list.filter((t) => (t.done === false)).length;
 }
 module.exports = { addTodo, completeTodo, listTodos, pendingCount };
`;

export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
  'aren', 'arent', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between',
  'both', 'but', 'by', 'can', 'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt', 'do',
  'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes',
  'her', 'here', 'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i',
  'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt', 'it', 'its', 'itself',
  'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off',
  'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so',
  'some', 'such', 'than', 'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves',
  'then', 'there', 'theres', 'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasnt',
  'we', 'wed', 'well', 'were', 'werent', 'what', 'whats', 'when', 'whens', 'where',
  'wheres', 'which', 'while', 'who', 'whos', 'whom', 'why', 'whys', 'with', 'wont',
  'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve', 'your', 'yours', 'yourself',
  'yourselves'
]);

function hashToken(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 256;
}

export class MockProvider implements LLMProvider {
  public calls = {
    chat: 0,
    embed: 0,
    listModels: 0,
    reset() {
      this.chat = 0;
      this.embed = 0;
      this.listModels = 0;
    },
  };

  private patchAttempts = 0;

  public resetPatchAttempts() {
    this.patchAttempts = 0;
  }

  async embed(texts: string[]): Promise<number[][]> {
    this.calls.embed++;
    return texts.map((text) => {
      const vec = new Array(256).fill(0);
      const tokens = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0 && !STOPWORDS.has(t));

      if (tokens.length === 0) {
        // Return deterministic unit vector along dimension 0 if empty
        const fallback = new Array(256).fill(0);
        fallback[0] = 1.0;
        return fallback;
      }

      for (const token of tokens) {
        const idx = hashToken(token);
        vec[idx] += 1;
      }

      // L2 Normalize
      let sumSq = 0;
      for (let i = 0; i < 256; i++) {
        sumSq += vec[i] * vec[i];
      }
      const norm = Math.sqrt(sumSq) || 1.0;
      return vec.map((v) => v / norm);
    });
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    this.calls.chat++;
    const fullPrompt = `${params.system}\n${params.messages.map((m) => m.content).join('\n')}`;

    if (fullPrompt.includes('UNIFIED DIFF')) {
      const patchMode = process.env.MOCK_PATCH_MODE;
      if (patchMode === 'garbage') {
        return { text: 'junk diff that is completely invalid\n', model: 'mock-model' };
      }
      if (patchMode === 'garbage-then-valid') {
        this.patchAttempts++;
        if (this.patchAttempts === 1) {
          return { text: 'garbage first attempt\n', model: 'mock-model' };
        }
        return { text: CANNED_FIX_DIFF, model: 'mock-model' };
      }
      return { text: CANNED_FIX_DIFF, model: 'mock-model' };
    }

    if (process.env.MOCK_CHAT_MODE === 'invent') {
      return { text: 'This statement cites an invented reference [E99].', model: 'mock-model' };
    }

    // Extract title of E1 from prompt
    // e.g. "[E1] file src/todo.js lines 10-14" or "[E1] commit 123... (date, author): title"
    const match = fullPrompt.match(/\[E1\]\s*(?:file|commit|issue)?\s*([^\r\n]+)/i);
    let title = 'E1';
    if (match && match[1]) {
      title = match[1].trim();
      // If title contains colon or extra metadata like "sha (date, author): actual title"
      if (title.includes(':')) {
        const parts = title.split(':');
        title = parts[parts.length - 1].trim();
      }
    }

    return {
      text: `The most relevant record is ${title}. [E1]`,
      model: 'mock-model',
    };
  }

  async listModels(): Promise<string[]> {
    this.calls.listModels++;
    return ['mock-model', 'qwen2.5-coder:7b', 'nomic-embed-text'];
  }
}

export const mockProvider = new MockProvider();
