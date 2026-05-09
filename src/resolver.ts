import { connectionGuide } from './guidance.js';
import { exposeTarget, searchTargets, summarizeTarget } from './normalize.js';
import { envelope, mergeRedactions } from './response.js';
import type { ExposureLevel, GatewayEndpoints, Protocol, ToolEnvelope, WarpgateTarget } from './types.js';

export interface ResolveTargetInput {
  query: string;
  protocol?: Protocol;
}

export interface ResolveConnectionInput extends ResolveTargetInput {
  warpgateUser?: string;
  client?: string;
  exposureLevel: ExposureLevel;
  gateway: GatewayEndpoints;
}

export interface Candidate {
  name: string;
  protocol: Protocol;
  description?: string;
  groups: string[];
  confidence: number;
  matchReason: string;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9а-яё]+/giu, ' ').trim();
}

function compact(value: string): string {
  return normalizeText(value).replace(/\s+/g, '');
}

function candidateFor(target: WarpgateTarget, query: string): Candidate {
  const q = normalizeText(query);
  const qCompact = compact(query);
  const name = normalizeText(target.name);
  const nameCompact = compact(target.name);
  const fields = [
    target.name,
    target.description ?? '',
    target.hostHint ?? '',
    ...target.groups,
    ...Object.keys(target.labels),
    ...Object.values(target.labels),
  ].map(normalizeText);

  if (name === q) return { ...summarizeTarget(target), confidence: 1, matchReason: 'Exact normalized name match' };
  if (nameCompact === qCompact) return { ...summarizeTarget(target), confidence: 0.94, matchReason: 'Exact compact name match' };
  if (name.includes(q) || q.includes(name)) return { ...summarizeTarget(target), confidence: 0.82, matchReason: 'Name contains query' };
  if (fields.some((field) => field === q)) return { ...summarizeTarget(target), confidence: 0.75, matchReason: 'Exact metadata match' };
  if (fields.some((field) => field.includes(q))) return { ...summarizeTarget(target), confidence: 0.6, matchReason: 'Metadata contains query' };
  return { ...summarizeTarget(target), confidence: 0, matchReason: 'No match' };
}

export function resolveTarget(targets: WarpgateTarget[], input: ResolveTargetInput): ToolEnvelope<{ target?: Candidate; candidates?: Candidate[] }> {
  const filtered = input.protocol ? targets.filter((target) => target.protocol === input.protocol) : targets;
  const candidates = filtered
    .map((target) => candidateFor(target, input.query))
    .filter((candidate) => candidate.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));

  const fallback = candidates.length ? candidates : searchTargets(filtered, { query: input.query }).map((target) => candidateFor(target, input.query));
  const redaction = mergeRedactions(filtered.map((target) => target.redaction));

  if (fallback.length === 0) {
    return envelope({
      status: 'not_found',
      data: { candidates: [] },
      redaction,
      humanSummary: `Target matching "${input.query}" was not found.`,
    });
  }

  const [best, second] = fallback;
  if (second && best.confidence - second.confidence < 0.15) {
    return envelope({
      status: 'ambiguous',
      data: { candidates: fallback.slice(0, 10) },
      redaction,
      humanSummary: `Several Warpgate targets match "${input.query}". Ask the user to choose one.`,
    });
  }

  return envelope({
    status: 'resolved',
    data: { target: best },
    redaction,
    humanSummary: `Resolved "${input.query}" to ${best.name} (${best.protocol}).`,
  });
}

export function resolveConnection(targets: WarpgateTarget[], input: ResolveConnectionInput): ToolEnvelope<Record<string, unknown>> {
  const resolved = resolveTarget(targets, input);
  if (resolved.status !== 'resolved' || !resolved.data?.target) {
    return envelope({
      status: resolved.status,
      data: resolved.data,
      warnings: resolved.warnings,
      errors: resolved.errors,
      redaction: resolved.redaction,
      humanSummary: resolved.humanSummary,
    });
  }

  const target = targets.find((item) => item.name === resolved.data?.target?.name);
  if (!target) {
    return envelope({
      status: 'not_found',
      data: { candidates: [] },
      redaction: resolved.redaction,
      humanSummary: `Target ${resolved.data.target.name} disappeared while resolving the connection.`,
    });
  }

  const protocol = input.protocol && input.protocol !== 'unknown' ? input.protocol : target.protocol;
  const guide = connectionGuide(protocol, target.name, input.gateway, input.warpgateUser);
  const command = guide.commands.find((item) => item.shell === 'bash/zsh')?.command ?? guide.examples[0];

  return envelope({
    status: 'resolved',
    data: {
      target: {
        ...exposeTarget(target, input.exposureLevel),
        matchReason: resolved.data.target.matchReason,
        confidence: resolved.data.target.confidence,
      },
      command,
      commands: guide.commands,
      notes: guide.notes,
      client: input.client,
    },
    redaction: target.redaction,
    humanSummary: `Use the returned ${protocol} command to connect to ${target.name} through Warpgate.`,
  });
}
