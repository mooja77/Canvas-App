import { safeJsonParse } from './routeHelpers.js';

export type CloneIdMaps = {
  transcript: Map<string, string>;
  question: Map<string, string>;
  case: Map<string, string>;
};

/** Remap every entity-id shape currently accepted by computed nodes. */
export function remapComputedConfig(rawConfig: string, maps: CloneIdMaps): string {
  const parsed = safeJsonParse(rawConfig) as unknown;

  const visit = (value: unknown, parent?: Record<string, unknown>, key?: string): unknown => {
    if (Array.isArray(value)) {
      const map =
        key === 'transcriptIds'
          ? maps.transcript
          : key === 'questionIds'
            ? maps.question
            : key === 'caseIds'
              ? maps.case
              : null;
      return value.map((item) => (map && typeof item === 'string' ? (map.get(item) ?? item) : visit(item)));
    }
    if (!value || typeof value !== 'object') {
      if (typeof value !== 'string') return value;
      if (key === 'transcriptId') return maps.transcript.get(value) ?? value;
      if (key === 'questionId') return maps.question.get(value) ?? value;
      if (key === 'caseId') return maps.case.get(value) ?? value;
      if (key === 'scopeId') {
        const scope = parent?.scope;
        if (scope === 'transcript') return maps.transcript.get(value) ?? value;
        if (scope === 'question') return maps.question.get(value) ?? value;
        if (scope === 'case') return maps.case.get(value) ?? value;
      }
      return value;
    }

    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(source).map(([childKey, child]) => [childKey, visit(child, source, childKey)]),
    );
  };

  return JSON.stringify(visit(parsed));
}
