// apps/api/src/ghost/citations.ts - Citation parsing, evidence resolving, and sentence verification
import type { Citation, Evidence } from '../types.js';

export const REFUSAL_PHRASE = 'The ghost finds no record of that in this repository.';

export const DISCLAIMER_TEXT =
  'The ghost is a fictional AI persona. Quotes are shown only when taken verbatim from repository records.';

export interface ParsedCitationsResult {
  cleanAnswer: string;
  citations: Citation[];
  invalidMarkers: string[];
  flaggedSentences: number[];
  grounded: boolean;
}

export function formatCitationLabel(e: Evidence): string {
  if (e.kind === 'file' && e.path) {
    if (e.startLine && e.endLine) {
      return `${e.path}:${e.startLine}-${e.endLine}`;
    }
    return e.path;
  }
  if (e.kind === 'commit') {
    const shortSha = e.sha ? e.sha.slice(0, 7) : '';
    return shortSha ? `commit ${shortSha}` : e.title;
  }
  if (e.kind === 'issue') {
    return e.number ? `issue #${e.number}` : e.title;
  }
  return e.title;
}

export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  // Split on sentence terminators (.!?) followed by whitespace or end of string
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseCitations(rawAnswer: string, evidence: Evidence[]): ParsedCitationsResult {
  // If model's answer equals or contains the refusal phrase
  if (rawAnswer.includes(REFUSAL_PHRASE)) {
    return {
      cleanAnswer: rawAnswer,
      citations: [],
      invalidMarkers: [],
      flaggedSentences: [],
      grounded: false,
    };
  }

  const evidenceMap = new Map<string, Evidence>();
  for (const e of evidence) {
    evidenceMap.set(e.eid, e);
  }

  // Find all markers like [E1], [E2], [E99]
  const markerRegex = /\[E(\d+)\]/g;
  const validEidSet = new Set<string>();
  const invalidMarkers: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = markerRegex.exec(rawAnswer)) !== null) {
    const fullMarker = match[0];
    const eid = `E${match[1]}`;
    if (evidenceMap.has(eid)) {
      validEidSet.add(eid);
    } else {
      invalidMarkers.push(fullMarker);
    }
  }

  // Strip invalid markers from clean answer
  let cleanAnswer = rawAnswer;
  for (const invalid of invalidMarkers) {
    // Replace all occurrences of this invalid marker
    cleanAnswer = cleanAnswer.split(invalid).join('');
  }

  // Build ordered citation list matching the order of appearance in rawAnswer or numeric EID
  const citations: Citation[] = [];
  const seenCitations = new Set<string>();

  // Find occurrences of valid markers in order
  const validRegex = /\[E(\d+)\]/g;
  while ((match = validRegex.exec(rawAnswer)) !== null) {
    const eid = `E${match[1]}`;
    if (evidenceMap.has(eid) && !seenCitations.has(eid)) {
      seenCitations.add(eid);
      const ev = evidenceMap.get(eid)!;
      citations.push({
        eid,
        kind: ev.kind,
        label: formatCitationLabel(ev),
        ref: ev.id,
        snippet: ev.text.slice(0, 300),
      });
    }
  }

  // Split into sentences and find sentences with NO valid marker
  const sentences = splitIntoSentences(cleanAnswer);
  const flaggedSentences: number[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const hasValidMarker = Array.from(validEidSet).some((eid) => sentence.includes(`[${eid}]`));
    if (!hasValidMarker) {
      flaggedSentences.push(i);
    }
  }

  // grounded = at least one valid citation and no invalid markers were present
  const grounded = citations.length > 0 && invalidMarkers.length === 0;

  return {
    cleanAnswer,
    citations,
    invalidMarkers,
    flaggedSentences,
    grounded,
  };
}
