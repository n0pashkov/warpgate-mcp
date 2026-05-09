import type { RedactionMetadata, ToolEnvelope } from './types.js';

type EnvelopeInput<T> = {
  status: ToolEnvelope<T>['status'];
  data?: T;
  humanSummary: string;
  warnings?: string[];
  errors?: string[];
  redaction?: RedactionMetadata;
};

export const emptyRedaction: RedactionMetadata = {
  enabled: true,
  redactedFieldsCount: 0,
  redactedFieldPaths: [],
};

export function mergeRedactions(redactions: RedactionMetadata[]): RedactionMetadata {
  const paths = new Set<string>();
  for (const redaction of redactions) {
    for (const path of redaction.redactedFieldPaths) paths.add(path);
  }
  return {
    enabled: true,
    redactedFieldsCount: paths.size,
    redactedFieldPaths: [...paths].sort(),
  };
}

export function envelope<T>(input: EnvelopeInput<T>): ToolEnvelope<T> {
  return {
    status: input.status,
    data: input.data,
    humanSummary: input.humanSummary,
    warnings: input.warnings ?? [],
    errors: input.errors ?? [],
    redaction: input.redaction ?? emptyRedaction,
  };
}

export function toolText<T>(payload: ToolEnvelope<T>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: payload.status === 'error',
  };
}
