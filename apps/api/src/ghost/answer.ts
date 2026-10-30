// apps/api/src/ghost/answer.ts - Ghost Chat orchestration and grounded response generation
import path from 'node:path';
import fs from 'node:fs';
import type { ChatResponse, Repo } from '../types.js';
import { retrieve } from '../index/retrieve.js';
import { getProvider } from '../llm/index.js';
import { config } from '../config.js';
import { getWorkspaceRoot } from '../ingest/sourceValidator.js';
import { buildSystemPrompt, buildUserMessage } from './prompt.js';
import { parseCitations, REFUSAL_PHRASE, DISCLAIMER_TEXT } from './citations.js';

export interface ChatRequestParams {
  repoId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  seance?: boolean;
  workspaceRoot?: string;
}

export async function answerQuestion(params: ChatRequestParams): Promise<ChatResponse> {
  const startTs = Date.now();
  const {
    repoId,
    message,
    history = [],
    seance = false,
    workspaceRoot = getWorkspaceRoot(),
  } = params;

  // 1. Build retrieval query using current message plus the previous user message if present
  let retrievalQuery = message.trim();
  const previousUserTurns = history.filter((h) => h.role === 'user');
  if (previousUserTurns.length > 0) {
    const lastUserTurn = previousUserTurns[previousUserTurns.length - 1];
    retrievalQuery = `${lastUserTurn.content.trim()} ${retrievalQuery}`;
  }

  // 2. Retrieve top evidence (k=8)
  const evidence = await retrieve(repoId, retrievalQuery, 8, workspaceRoot);
  const topScore = evidence[0]?.score || 0;

  // 3. Refusal check: if top score is below MIN_EVIDENCE_SCORE, refuse and DO NOT call model
  if (topScore < config.MIN_EVIDENCE_SCORE) {
    return {
      answer: REFUSAL_PHRASE,
      citations: [],
      grounded: false,
      mode: seance ? 'seance' : 'plain',
      model: config.CHAT_MODEL,
      latencyMs: Date.now() - startTs,
      refusal: REFUSAL_PHRASE,
      flaggedSentences: [],
      disclaimer: DISCLAIMER_TEXT,
    };
  }

  // 4. Resolve repo overview to find repoName
  const metaPath = path.resolve(workspaceRoot, config.DATA_DIR, 'repos', repoId, 'meta.json');
  let repoName = repoId;
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Repo;
      if (meta.name) repoName = meta.name;
    } catch {
      // Fallback to repoId
    }
  }

  // 5. Build system prompt and user message with evidence blocks
  const systemPrompt = buildSystemPrompt({ repoName, seance });
  const userMessageContent = buildUserMessage(evidence, message.trim(), 12000);

  // 6. Include last 4 history turns
  const historySlice = history.slice(-4).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  const messages = [...historySlice, { role: 'user' as const, content: userMessageContent }];

  // 7. Call LLM provider at temperature 0.2
  const provider = getProvider();
  const chatResult = await provider.chat({
    system: systemPrompt,
    messages,
    temperature: 0.2,
  });

  // 8. Parse citations, strip invalid markers, and verify groundedness
  const parsed = parseCitations(chatResult.text, evidence);

  return {
    answer: parsed.cleanAnswer,
    citations: parsed.citations,
    grounded: parsed.grounded,
    mode: seance ? 'seance' : 'plain',
    model: chatResult.model,
    latencyMs: Date.now() - startTs,
    refusal: parsed.cleanAnswer.includes(REFUSAL_PHRASE) ? REFUSAL_PHRASE : undefined,
    flaggedSentences: parsed.flaggedSentences,
    disclaimer: DISCLAIMER_TEXT,
  };
}
