import { afterEach, describe, expect, it, vi } from 'vitest';
import { WarpgateClient } from './warpgateClient.js';
import type { ServerConfig } from './types.js';

const config: ServerConfig = {
  baseUrl: 'https://warpgate.example.test',
  adminToken: 'admin-token',
  tlsVerify: true,
  httpHost: '127.0.0.1',
  httpPort: 3000,
  gateway: {
    ssh: { host: 'warpgate.example.test', port: 2222 },
    http: { baseUrl: 'https://warpgate.example.test' },
    mysql: { host: 'warpgate.example.test', port: 3306 },
    postgres: { host: 'warpgate.example.test', port: 5432 },
    kubernetes: { baseUrl: 'https://warpgate.example.test:8443' },
  },
};

describe('WarpgateClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads targets from the Admin API and sends the token header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ name: 'shell', protocol: 'ssh', password: 'hidden' }]), { status: 200 }),
    );

    const targets = await new WarpgateClient(config).listTargets();

    expect(fetchMock).toHaveBeenCalledWith('https://warpgate.example.test/@warpgate/admin/api/targets', {
      headers: { Accept: 'application/json', 'X-Warpgate-Token': 'admin-token' },
    });
    expect(targets[0]).toMatchObject({ name: 'shell', protocol: 'ssh', raw: { password: '[REDACTED]' } });
  });

  it('includes fetch cause details when the Admin API cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED', syscall: 'connect', address: '10.0.0.5', port: 443 } }),
    );

    await expect(new WarpgateClient(config).listTargets()).rejects.toThrow(
      'Failed to reach Warpgate Admin API at https://warpgate.example.test/@warpgate/admin/api/targets: fetch failed (ECONNREFUSED connect 10.0.0.5 443)',
    );
  });

  it('supports payloads wrapped in a targets property', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ targets: [{ name: 'db', protocol: 'mysql' }] }), { status: 200 }),
    );

    await expect(new WarpgateClient(config).listTargets()).resolves.toHaveLength(1);
  });
});
