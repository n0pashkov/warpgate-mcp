import { describe, expect, it } from 'vitest';
import { normalizeTarget, exposeTarget } from './normalize.js';
import { resolveConnection, resolveTarget } from './resolver.js';
import type { GatewayEndpoints } from './types.js';

const gateway: GatewayEndpoints = {
  ssh: { host: 'gw.example.test', port: 2222 },
  http: { baseUrl: 'https://gw.example.test' },
  mysql: { host: 'gw.example.test', port: 3306 },
  postgres: { host: 'gw.example.test', port: 5432 },
  kubernetes: { baseUrl: 'https://gw.example.test:8443' },
};

const targets = [
  normalizeTarget({ name: 'node 1', protocol: 'ssh', description: 'Proxmox node 1', groups: ['proxmox', 'lab'] }, gateway),
  normalizeTarget({ name: 'node 2', protocol: 'ssh', description: 'Proxmox node 2', groups: ['proxmox', 'lab'] }, gateway),
  normalizeTarget({ name: 'main pg', protocol: 'postgres' }, gateway),
];

describe('resolver', () => {
  it('resolves exact normalized target names', () => {
    const result = resolveTarget(targets, { query: 'node 1', protocol: 'ssh' });

    expect(result.status).toBe('resolved');
    expect(result.data?.target).toMatchObject({ name: 'node 1', confidence: 1, matchReason: 'Exact normalized name match' });
  });

  it('returns ambiguous candidates when several targets are close', () => {
    const result = resolveTarget(targets, { query: 'node', protocol: 'ssh' });

    expect(result.status).toBe('ambiguous');
    expect(result.data?.candidates?.map((candidate) => candidate.name)).toEqual(['node 1', 'node 2']);
  });

  it('generates copy-paste-safe SSH commands for targets with spaces', () => {
    const result = resolveConnection(targets, {
      query: 'node 1',
      protocol: 'ssh',
      warpgateUser: 'admin',
      exposureLevel: 'normal',
      gateway,
    });

    expect(result.status).toBe('resolved');
    expect(result.data?.command).toBe("ssh 'admin:node 1@gw.example.test' -p 2222");
  });

  it('uses %23 in postgres URLs for the Warpgate user target separator', () => {
    const result = resolveConnection(targets, {
      query: 'main pg',
      protocol: 'postgres',
      warpgateUser: 'admin',
      exposureLevel: 'normal',
      gateway,
    });

    expect(result.data?.command).toBe("psql 'postgresql://admin%23main%20pg@gw.example.test:5432/postgres'");
  });

  it('minimal exposure hides raw, host hints, and labels', () => {
    const exposed = exposeTarget(normalizeTarget({ name: 'db', protocol: 'mysql', host: '10.0.0.3', labels: { env: 'lab' } }, gateway), 'minimal');

    expect(exposed).toEqual({ name: 'db', protocol: 'mysql', description: undefined, groups: [], connectionAvailable: true });
  });

  it('debug exposure returns only redacted raw data', () => {
    const exposed = exposeTarget(normalizeTarget({ name: 'db', protocol: 'mysql', password: 'secret' }, gateway), 'debug');

    expect(exposed.raw).toMatchObject({ password: '[REDACTED]' });
    expect(exposed.redaction).toMatchObject({ redactedFieldsCount: 1, redactedFieldPaths: ['password'] });
  });
});
