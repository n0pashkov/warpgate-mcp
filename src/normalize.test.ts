import { describe, expect, it } from 'vitest';
import { normalizeTarget, searchTargets } from './normalize.js';
import type { GatewayEndpoints } from './types.js';

const gateway: GatewayEndpoints = {
  ssh: { host: 'gw.example.test', port: 2222 },
  http: { baseUrl: 'https://gw.example.test' },
  mysql: { host: 'gw.example.test', port: 3306 },
  postgres: { host: 'gw.example.test', port: 5432 },
  kubernetes: { baseUrl: 'https://gw.example.test:8443' },
};

describe('normalizeTarget', () => {
  it.each([
    ['ssh', { name: 'shell', protocol: 'ssh', options: { host: '10.0.0.10' } }, "ssh '<warpgate-user>:shell@gw.example.test' -p 2222"],
    ['warpgate options.kind ssh', { name: 'node1', options: { kind: 'Ssh', host: '10.0.0.10' } }, "ssh '<warpgate-user>:node1@gw.example.test' -p 2222"],
    ['http', { name: 'panel', protocol: 'https', url: 'https://admin.local' }, 'https://gw.example.test/?warpgate-target=panel'],
    ['mysql', { name: 'db', kind: 'mysql', host: 'mysql.local' }, "mysql -h gw.example.test -P 3306 -u '<warpgate-user>#db' -p"],
    ['postgres', { name: 'pg', type: 'postgresql', hostname: 'pg.local' }, "psql 'postgresql://%3Cwarpgate-user%3E%23pg@gw.example.test:5432/postgres'"],
    ['kubernetes', { name: 'cluster', target_type: 'k8s' }, 'kubectl --server=https://gw.example.test:8443/cluster get namespaces'],
  ])('normalizes %s targets', (_label, raw, example) => {
    const target = normalizeTarget(raw, gateway);
    expect(target.connection.examples).toContain(example);
  });

  it('keeps only redacted raw target data', () => {
    const target = normalizeTarget(
      {
        name: 'secretful',
        protocol: 'http',
        url: 'https://user:pass@example.test/path',
        nested: { password: 'pw', private_key: 'key', token: 'tok' },
      },
      gateway,
    );

    expect(target.raw).toMatchObject({
      url: 'https://REDACTED:REDACTED@example.test/path',
      nested: { password: '[REDACTED]', private_key: '[REDACTED]', token: '[REDACTED]' },
    });
  });

  it('uses the configured Warpgate user in default connection guidance', () => {
    const target = normalizeTarget({ name: 'shell', protocol: 'ssh' }, gateway, 'admin');

    expect(target.connection.examples).toContain("ssh 'admin:shell@gw.example.test' -p 2222");
    expect(target.connection.notes).toContain('Use your Warpgate username before the colon. Target upstream credentials remain managed by Warpgate.');
  });

  it('searches across protocol, groups, host hints, names, and labels', () => {
    const targets = [
      normalizeTarget({ name: 'prod-shell', protocol: 'ssh', groups: ['prod'], host: '10.0.0.5', labels: { owner: 'ops' } }, gateway),
      normalizeTarget({ name: 'stage-db', protocol: 'mysql', groups: ['stage'], host: '10.0.1.5' }, gateway),
    ];

    expect(searchTargets(targets, { protocol: 'ssh', group: 'prod' }).map((target) => target.name)).toEqual(['prod-shell']);
    expect(searchTargets(targets, { query: 'ops' }).map((target) => target.name)).toEqual(['prod-shell']);
    expect(searchTargets(targets, { hostHint: '10.0.1' }).map((target) => target.name)).toEqual(['stage-db']);
  });
});
