#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { defaultConfigPath, loadConfig } from './config.js';
import { createWarpgateMcpServer } from './server.js';
import { WarpgateClient } from './warpgateClient.js';

async function runStdio(): Promise<void> {
  const config = loadConfig();
  const server = createWarpgateMcpServer(config);
  await server.connect(new StdioServerTransport());
}

async function runHttp(): Promise<void> {
  const config = loadConfig();
  if (config.httpHost === '0.0.0.0') {
    console.error('Warning: MCP HTTP server is bound to 0.0.0.0. This can expose infrastructure metadata; prefer 127.0.0.1 or set MCP_REQUIRE_AUTH=true.');
  }
  if (config.requireAuth && !config.authToken) {
    throw new Error('MCP_REQUIRE_AUTH=true requires MCP_AUTH_TOKEN');
  }
  const httpServer = createServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) {
      res.writeHead(404).end('Not found');
      return;
    }

    if (config.allowedOrigins.length > 0) {
      const origin = req.headers.origin;
      if (origin && !config.allowedOrigins.includes(origin)) {
        res.writeHead(403).end('Origin not allowed');
        return;
      }
      if (origin) res.setHeader('access-control-allow-origin', origin);
    }

    if (config.requireAuth) {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? req.headers['x-mcp-auth-token'];
      if (token !== config.authToken) {
        res.writeHead(401).end('Unauthorized');
        return;
      }
    }

    try {
      const mcpServer = createWarpgateMcpServer(config);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: message }));
    }
  });

  httpServer.listen(config.httpPort, config.httpHost, () => {
    console.error(`Warpgate Targets MCP listening at http://${config.httpHost}:${config.httpPort}/mcp`);
  });
}

async function runDoctor(): Promise<void> {
  const checks: string[] = [];
  checks.push(Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10) >= 20 ? '✓ Node.js version OK' : '✗ Node.js >= 20.11 is required');
  let config;
  try {
    config = loadConfig();
    checks.push('✓ Config loaded');
  } catch (error) {
    checks.push(`✗ Config error: ${error instanceof Error ? error.message : String(error)}`);
    console.log(checks.join('\n'));
    process.exitCode = 1;
    return;
  }

  if (!config.tlsVerify) checks.push('⚠ TLS verification disabled');
  checks.push(`✓ SSH listener configured: ${config.gateway.ssh.host}:${config.gateway.ssh.port ?? 22}`);
  checks.push(`✓ HTTP listener configured: ${config.gateway.http.baseUrl}`);

  try {
    const targets = await new WarpgateClient(config).listTargets();
    checks.push('✓ WARPGATE_BASE_URL reachable');
    checks.push('✓ Token accepted');
    checks.push(`✓ ${targets.length} targets loaded`);
    checks.push('✓ Redaction enabled');
  } catch (error) {
    checks.push(`✗ Warpgate API check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }

  console.log(checks.join('\n'));
}

function configure(client: string): void {
  const env = {
    WARPGATE_BASE_URL: process.env.WARPGATE_BASE_URL ?? 'https://warpgate.example.com',
    WARPGATE_ADMIN_TOKEN: process.env.WARPGATE_ADMIN_TOKEN ?? 'put-token-here',
    WARPGATE_USER: process.env.WARPGATE_USER ?? 'admin',
  };
  const command = 'warpgate-mcp';
  const args: string[] = [];

  if (client === 'codex') {
    console.log(`[mcp_servers.warpgate]\ncommand = "${command}"\nargs = []\nenv = { WARPGATE_BASE_URL = "${env.WARPGATE_BASE_URL}", WARPGATE_ADMIN_TOKEN = "${env.WARPGATE_ADMIN_TOKEN}", WARPGATE_USER = "${env.WARPGATE_USER}" }`);
    return;
  }

  console.log(
    JSON.stringify(
      {
        mcpServers: {
          warpgate: { command, args, env },
        },
      },
      null,
      2,
    ),
  );
}

async function initConfig(): Promise<void> {
  const rl = createInterface({ input, output });
  const path = process.env.WARPGATE_CONFIG_FILE ?? defaultConfigPath();
  const baseUrl = await rl.question('Warpgate URL: ');
  const adminToken = await rl.question('Admin token: ');
  const warpgateUser = await rl.question('Warpgate username for connection examples [admin]: ');
  const tlsVerify = (await rl.question('TLS verify? yes/no [yes]: ')).trim().toLowerCase() !== 'no';
  const sshHost = await rl.question('Default SSH listener host: ');
  const sshPort = await rl.question('Default SSH listener port [2222]: ');
  const httpBaseUrl = await rl.question('Default HTTP listener: ');
  const mysqlHost = await rl.question('Default MySQL listener host: ');
  const mysqlPort = await rl.question('Default MySQL listener port [3306]: ');
  const postgresHost = await rl.question('Default PostgreSQL listener host: ');
  const postgresPort = await rl.question('Default PostgreSQL listener port [5432]: ');
  const kubernetesBaseUrl = await rl.question('Default Kubernetes listener: ');
  rl.close();

  const config = {
    baseUrl,
    adminToken,
    warpgateUser: warpgateUser || 'admin',
    tlsVerify,
    gateway: {
      ssh: { host: sshHost, port: Number.parseInt(sshPort || '2222', 10) },
      http: { baseUrl: httpBaseUrl || baseUrl },
      mysql: { host: mysqlHost || sshHost, port: Number.parseInt(mysqlPort || '3306', 10) },
      postgres: { host: postgresHost || sshHost, port: Number.parseInt(postgresPort || '5432', 10) },
      kubernetes: { baseUrl: kubernetesBaseUrl || baseUrl },
    },
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  console.log(`Config written to ${path}`);
}

const [command, subcommand] = process.argv.slice(2);
const mode = process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';

const action = command === 'doctor' || command === 'check'
  ? runDoctor
  : command === 'init' || command === 'setup'
    ? initConfig
    : command === 'install' || command === 'configure'
      ? () => Promise.resolve(configure(subcommand ?? 'codex'))
      : mode === 'http'
        ? runHttp
        : runStdio;

action().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
