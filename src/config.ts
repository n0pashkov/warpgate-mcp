import { existsSync, readFileSync } from 'node:fs';
import { URL } from 'node:url';
import type { ExposureLevel, GatewayEndpoints, ServerConfig } from './types.js';

interface FileConfig {
  baseUrl?: string;
  adminToken?: string;
  warpgateUser?: string;
  tlsVerify?: boolean;
  exposureLevel?: ExposureLevel;
  httpPort?: number;
  httpHost?: string;
  requireAuth?: boolean;
  authToken?: string;
  allowedOrigins?: string[];
  gateway?: Partial<GatewayEndpoints>;
}

function readConfigFile(path?: string): FileConfig {
  if (!path || !existsSync(path)) return {};
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as FileConfig;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function intFromEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function baseHost(baseUrl: string): string {
  return new URL(baseUrl).hostname;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function exposureFromEnv(value: string | undefined, fallback: ExposureLevel): ExposureLevel {
  if (value === 'minimal' || value === 'normal' || value === 'debug') return value;
  return fallback;
}

function listFromEnv(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const file = readConfigFile(env.WARPGATE_CONFIG_FILE);
  const baseUrl = normalizeBaseUrl(env.WARPGATE_BASE_URL ?? file.baseUrl ?? 'https://localhost');
  const host = baseHost(baseUrl);
  const gatewayFromFile = file.gateway ?? {};

  const adminToken = env.WARPGATE_ADMIN_TOKEN ?? file.adminToken;
  if (!adminToken) {
    throw new Error('WARPGATE_ADMIN_TOKEN is required');
  }

  const gateway: GatewayEndpoints = {
    ssh: {
      host: env.WARPGATE_SSH_HOST ?? gatewayFromFile.ssh?.host ?? host,
      port: intFromEnv(env.WARPGATE_SSH_PORT, gatewayFromFile.ssh?.port ?? 2222),
    },
    http: {
      baseUrl: normalizeBaseUrl(env.WARPGATE_HTTP_BASE_URL ?? gatewayFromFile.http?.baseUrl ?? baseUrl),
    },
    mysql: {
      host: env.WARPGATE_MYSQL_HOST ?? gatewayFromFile.mysql?.host ?? host,
      port: intFromEnv(env.WARPGATE_MYSQL_PORT, gatewayFromFile.mysql?.port ?? 3306),
    },
    postgres: {
      host: env.WARPGATE_POSTGRES_HOST ?? gatewayFromFile.postgres?.host ?? host,
      port: intFromEnv(env.WARPGATE_POSTGRES_PORT, gatewayFromFile.postgres?.port ?? 5432),
    },
    kubernetes: {
      baseUrl: normalizeBaseUrl(
        env.WARPGATE_KUBERNETES_BASE_URL ?? gatewayFromFile.kubernetes?.baseUrl ?? `https://${host}:8443`,
      ),
    },
  };

  return {
    baseUrl,
    adminToken,
    warpgateUser: optionalString(env.WARPGATE_USER ?? file.warpgateUser),
    tlsVerify: boolFromEnv(env.WARPGATE_TLS_VERIFY, file.tlsVerify ?? true),
    exposureLevel: exposureFromEnv(env.WARPGATE_EXPOSURE_LEVEL, file.exposureLevel ?? 'normal'),
    gateway,
    httpPort: intFromEnv(env.PORT ?? env.MCP_HTTP_PORT, file.httpPort ?? 3000),
    httpHost: env.HOST ?? env.MCP_HTTP_HOST ?? file.httpHost ?? '127.0.0.1',
    requireAuth: boolFromEnv(env.MCP_REQUIRE_AUTH, file.requireAuth ?? false),
    authToken: env.MCP_AUTH_TOKEN ?? file.authToken,
    allowedOrigins: listFromEnv(env.MCP_ALLOWED_ORIGINS, file.allowedOrigins ?? []),
  };
}

export function defaultConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.HOME ?? process.cwd();
  return `${home}/.config/warpgate-mcp/config.json`;
}
