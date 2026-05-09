import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('defaults HTTP host to 127.0.0.1', () => {
    const config = loadConfig({ WARPGATE_BASE_URL: 'https://warpgate.example.test', WARPGATE_ADMIN_TOKEN: 'token' });

    expect(config.httpHost).toBe('127.0.0.1');
  });

  it('loads HTTP auth and exposure settings', () => {
    const config = loadConfig({
      WARPGATE_BASE_URL: 'https://warpgate.example.test',
      WARPGATE_ADMIN_TOKEN: 'token',
      MCP_HTTP_HOST: '0.0.0.0',
      MCP_REQUIRE_AUTH: 'true',
      MCP_AUTH_TOKEN: 'mcp-token',
      MCP_ALLOWED_ORIGINS: 'https://client.example.test, https://agent.example.test',
      WARPGATE_EXPOSURE_LEVEL: 'minimal',
    });

    expect(config.httpHost).toBe('0.0.0.0');
    expect(config.requireAuth).toBe(true);
    expect(config.authToken).toBe('mcp-token');
    expect(config.allowedOrigins).toEqual(['https://client.example.test', 'https://agent.example.test']);
    expect(config.exposureLevel).toBe('minimal');
  });
});
