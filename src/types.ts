export type Protocol = 'ssh' | 'http' | 'mysql' | 'postgres' | 'kubernetes' | 'unknown';
export type ExposureLevel = 'minimal' | 'normal' | 'debug';

export interface GatewayHostPort {
  host: string;
  port?: number;
}

export interface GatewayEndpoints {
  ssh: GatewayHostPort;
  http: { baseUrl: string };
  mysql: GatewayHostPort;
  postgres: GatewayHostPort;
  kubernetes: { baseUrl: string };
}

export interface ServerConfig {
  baseUrl: string;
  adminToken: string;
  tlsVerify: boolean;
  exposureLevel: ExposureLevel;
  gateway: GatewayEndpoints;
  httpPort: number;
  httpHost: string;
  requireAuth: boolean;
  authToken?: string;
  allowedOrigins: string[];
}

export interface WarpgateTargetSummary {
  name: string;
  protocol: Protocol;
  description?: string;
  groups: string[];
  hostHint?: string;
  labels: Record<string, string>;
}

export interface WarpgateTarget extends WarpgateTargetSummary {
  raw: unknown;
  redaction: RedactionMetadata;
  connection: ConnectionGuidance;
}

export interface ConnectionGuidance {
  protocol: Protocol;
  target: string;
  summary: string;
  examples: string[];
  commands: ConnectionCommand[];
  notes: string[];
}

export interface ConnectionCommand {
  shell: 'bash/zsh' | 'powershell' | 'plain';
  command: string;
  copyPasteSafe: boolean;
}

export interface RedactionMetadata {
  enabled: true;
  redactedFieldsCount: number;
  redactedFieldPaths: string[];
}

export interface TargetSearchFilters {
  query?: string;
  name?: string;
  description?: string;
  protocol?: Protocol;
  group?: string;
  hostHint?: string;
}

export interface ToolEnvelope<T> {
  [key: string]: unknown;
  status: 'ok' | 'resolved' | 'ambiguous' | 'not_found' | 'error';
  data?: T;
  warnings: string[];
  errors: string[];
  redaction: RedactionMetadata;
  humanSummary: string;
}
