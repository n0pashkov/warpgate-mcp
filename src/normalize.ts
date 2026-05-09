import { connectionGuide } from './guidance.js';
import { redactSecretsWithMetadata } from './redact.js';
import type { ExposureLevel, GatewayEndpoints, Protocol, TargetSearchFilters, WarpgateTarget, WarpgateTargetSummary } from './types.js';

const PROTOCOL_ALIASES: Record<string, Protocol> = {
  ssh: 'ssh',
  http: 'http',
  https: 'http',
  mysql: 'mysql',
  postgresql: 'postgres',
  postgres: 'postgres',
  k8s: 'kubernetes',
  kube: 'kubernetes',
  kubernetes: 'kubernetes',
};

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function nested(input: Record<string, unknown>, keys: string[]): unknown {
  let current: unknown = input;
  for (const key of keys) current = obj(current)[key];
  return current;
}

function detectProtocol(raw: Record<string, unknown>): Protocol {
  const options = obj(raw.options);
  const candidates = [
    raw.protocol,
    raw.kind,
    raw.type,
    raw.target_type,
    raw.targetType,
    raw.variant,
    raw.mode,
    options.protocol,
    options.kind,
    options.type,
  ]
    .map((value) => readString(value)?.toLowerCase())
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    const stripped = candidate.replace(/^warpgate[_-]?/i, '');
    const normalized = PROTOCOL_ALIASES[candidate] ?? PROTOCOL_ALIASES[stripped] ?? PROTOCOL_ALIASES[stripped.replace(/target$/i, '')];
    if (normalized) return normalized;
  }

  if (options.ssh || raw.ssh) return 'ssh';
  if (options.mysql || raw.mysql) return 'mysql';
  if (options.postgres || options.postgresql || raw.postgres || raw.postgresql) return 'postgres';
  if (options.kubernetes || options.k8s || raw.kubernetes || raw.k8s) return 'kubernetes';
  if (options.http || raw.http || readString(raw.url)) return 'http';
  return 'unknown';
}

function hostHint(raw: Record<string, unknown>): string | undefined {
  const candidates = [
    raw.host,
    raw.hostname,
    raw.address,
    raw.url,
    nested(raw, ['options', 'host']),
    nested(raw, ['options', 'hostname']),
    nested(raw, ['options', 'url']),
    nested(raw, ['options', 'endpoint']),
  ];
  return candidates.map(readString).find(Boolean);
}

function labels(raw: Record<string, unknown>): Record<string, string> {
  const source = obj(raw.labels ?? raw.tags ?? raw.metadata);
  return Object.fromEntries(
    Object.entries(source)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key, String(value)]),
  );
}

export function normalizeTarget(input: unknown, gateway: GatewayEndpoints, warpgateUser?: string): WarpgateTarget {
  const raw = obj(input);
  const redacted = redactSecretsWithMetadata(raw);
  const name = readString(raw.name ?? raw.id ?? raw.username ?? raw.slug) ?? 'unnamed-target';
  const protocol = detectProtocol(raw);
  const groups = readStringArray(raw.groups ?? raw.group_names ?? raw.groupNames);
  const summary: WarpgateTargetSummary = {
    name,
    protocol,
    description: readString(raw.description ?? raw.comment ?? raw.notes),
    groups,
    hostHint: hostHint(raw),
    labels: labels(raw),
  };

  return {
    ...summary,
    raw: redacted.value,
    redaction: redacted.metadata,
    connection: connectionGuide(protocol, name, gateway, warpgateUser),
  };
}

export function summarizeTarget(target: WarpgateTarget): WarpgateTargetSummary {
  return {
    name: target.name,
    protocol: target.protocol,
    description: target.description,
    groups: target.groups,
    hostHint: target.hostHint,
    labels: target.labels,
  };
}

export function exposeTarget(target: WarpgateTarget, level: ExposureLevel): Record<string, unknown> {
  const base = {
    name: target.name,
    protocol: target.protocol,
    description: target.description,
    groups: target.groups,
    connectionAvailable: target.connection.commands.length > 0,
  };

  if (level === 'minimal') return base;

  const normal = {
    ...base,
    labels: target.labels,
    hostHint: target.hostHint,
    connection: target.connection,
  };

  if (level === 'normal') return normal;

  return {
    ...normal,
    raw: target.raw,
    redaction: target.redaction,
  };
}

export function searchTargets(targets: WarpgateTarget[], filters: TargetSearchFilters): WarpgateTarget[] {
  const terms = [filters.query, filters.name, filters.description, filters.group, filters.hostHint]
    .filter((term): term is string => Boolean(term?.trim()))
    .map((term) => term.toLowerCase());

  return targets.filter((target) => {
    if (filters.protocol && target.protocol !== filters.protocol) return false;
    const haystack = [
      target.name,
      target.description ?? '',
      target.protocol,
      target.hostHint ?? '',
      ...target.groups,
      ...Object.keys(target.labels),
      ...Object.values(target.labels),
    ]
      .join('\n')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
