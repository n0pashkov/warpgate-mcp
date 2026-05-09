import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { connectionGuide } from './guidance.js';
import { exposeTarget, searchTargets, summarizeTarget } from './normalize.js';
import { mergeRedactions, toolText } from './response.js';
import { resolveConnection, resolveTarget } from './resolver.js';
import type { ServerConfig, WarpgateTarget } from './types.js';
import { WarpgateClient } from './warpgateClient.js';

const protocolSchema = z.enum(['ssh', 'http', 'mysql', 'postgres', 'kubernetes', 'unknown']);

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function createWarpgateMcpServer(config: ServerConfig): McpServer {
  const client = new WarpgateClient(config);
  const server = new McpServer(
    { name: 'warpgate', version: '0.1.0' },
    {
      instructions:
        'Use this read-only server to discover Warpgate targets and generate bastion-safe connection guidance. Never expect target secrets in results.',
    },
  );

  server.registerResource(
    'warpgate-targets',
    'warpgate://targets',
    {
      title: 'Warpgate Targets',
      description: 'Redacted summaries of Warpgate targets from the Admin API.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const targets = await client.listTargets();
      return { contents: [{ uri: uri.href, text: jsonText(targets.map((target) => exposeTarget(target, config.exposureLevel))) }] };
    },
  );

  server.registerResource(
    'warpgate-target',
    new ResourceTemplate('warpgate://targets/{name}', {
      list: async () => {
        const targets = await client.listTargets();
        return { resources: targets.map((target) => ({ uri: `warpgate://targets/${encodeURIComponent(target.name)}`, name: target.name })) };
      },
    }),
    {
      title: 'Warpgate Target',
      description: 'One redacted Warpgate target with connection guidance.',
      mimeType: 'application/json',
    },
    async (uri, { name }) => {
      const targetName = Array.isArray(name) ? name[0] : name;
      const target = await client.getTarget(decodeURIComponent(targetName));
      return { contents: [{ uri: uri.href, text: jsonText(target ? exposeTarget(target, config.exposureLevel) : { error: `Target not found: ${targetName}` }) }] };
    },
  );

  server.registerResource(
    'warpgate-target-connection-guide',
    new ResourceTemplate('warpgate://targets/{name}/connection-guide', { list: undefined }),
    {
      title: 'Warpgate Target Connection Guide',
      description: 'Connection guidance for one target.',
      mimeType: 'application/json',
    },
    async (uri, { name }) => {
      const targetName = Array.isArray(name) ? name[0] : name;
      const target = await client.getTarget(decodeURIComponent(targetName));
      return { contents: [{ uri: uri.href, text: jsonText(target?.connection ?? { error: `Target not found: ${targetName}` }) }] };
    },
  );

  server.registerResource(
    'warpgate-help-usage',
    'warpgate://help/usage',
    { title: 'Warpgate MCP Usage', mimeType: 'text/plain' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: 'Use resolve_connection when the user wants to connect to a host, database, HTTP service, or Kubernetes cluster through Warpgate. Use search_targets for discovery-only questions.',
        },
      ],
    }),
  );

  server.registerResource(
    'warpgate-help-security',
    'warpgate://help/security',
    { title: 'Warpgate MCP Security', mimeType: 'text/plain' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: 'This server is read-only and redacts upstream secrets. HTTP mode can expose infrastructure names and labels, so bind to 127.0.0.1 or enable MCP_REQUIRE_AUTH for shared deployments.',
        },
      ],
    }),
  );

  server.registerResource(
    'warpgate-help-agent-policy',
    'warpgate://help/agent-policy',
    { title: 'Warpgate Agent Policy', mimeType: 'text/plain' },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: [
            'Rules for AI agents using Warpgate Targets MCP:',
            '1. Do not connect directly to upstream hosts when a Warpgate route exists.',
            '2. Do not ask for upstream passwords, private keys, database passwords, or Kubernetes tokens.',
            '3. Use resolve_connection before list_targets when the user wants to connect to something.',
            '4. If the result is ambiguous, show the candidate list to the user.',
            '5. Use returned commands exactly; do not invent target names.',
          ].join('\n'),
        },
      ],
    }),
  );

  server.registerTool(
    'list_targets',
    {
      title: 'List Warpgate Targets',
      description: 'List redacted Warpgate target summaries. Use this for inventory questions, not as the first choice for a user asking to connect.',
      inputSchema: {},
    },
    async () => {
      const targets = await client.listTargets();
      return toolText({
        status: 'ok',
        data: { targets: targets.map((target) => exposeTarget(target, config.exposureLevel)) },
        warnings: [],
        errors: [],
        redaction: mergeRedactions(targets.map((target) => target.redaction)),
        humanSummary: `${targets.length} Warpgate targets loaded.`,
      });
    },
  );

  server.registerTool(
    'search_targets',
    {
      title: 'Search Warpgate Targets',
      description:
        'Search Warpgate targets by human query. Use this when the user mentions a hostname, server name, database, service, group, label, or asks where to connect. This tool is read-only and never returns upstream credentials.',
      inputSchema: {
        query: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        protocol: protocolSchema.optional(),
        group: z.string().optional(),
        hostHint: z.string().optional(),
      },
    },
    async (filters) => {
      const targets = await client.listTargets();
      const matches = searchTargets(targets, filters);
      return toolText({
        status: 'ok',
        data: { targets: matches.map((target) => exposeTarget(target, config.exposureLevel)) },
        warnings: [],
        errors: [],
        redaction: mergeRedactions(matches.map((target) => target.redaction)),
        humanSummary: `${matches.length} Warpgate targets matched the search filters.`,
      });
    },
  );

  server.registerTool(
    'get_target',
    {
      title: 'Get Warpgate Target',
      description: 'Get one redacted target with connection guidance.',
      inputSchema: { name: z.string().min(1) },
    },
    async ({ name }) => {
      const targets = await client.listTargets();
      const target = targets.find((item) => item.name === name);
      if (!target) {
        return toolText({
          status: 'not_found',
          data: { availableTargets: targets.map(summarizeTarget) },
          warnings: [],
          errors: [`Target not found: ${name}`],
          redaction: mergeRedactions(targets.map((item) => item.redaction)),
          humanSummary: `Target ${name} was not found.`,
        });
      }
      return toolText({
        status: 'ok',
        data: { target: exposeTarget(target, config.exposureLevel) },
        warnings: [],
        errors: [],
        redaction: target.redaction,
        humanSummary: `Loaded Warpgate target ${target.name}.`,
      });
    },
  );

  server.registerTool(
    'connection_guide',
    {
      title: 'Warpgate Connection Guide',
      description: 'Return ready-to-use examples for connecting to a target through Warpgate.',
      inputSchema: {
        name: z.string().min(1),
        protocol: protocolSchema.optional().describe('Optional override when the target protocol is unknown or ambiguous.'),
        warpgateUser: z.string().optional().describe('Optional Warpgate username for copy-paste command examples.'),
      },
    },
    async ({ name, protocol, warpgateUser }) => {
      const targets = await client.listTargets();
      const target = targets.find((item) => item.name === name);
      if (!target) {
        return toolText({
          status: 'not_found',
          data: { availableTargets: targets.map(summarizeTarget) },
          warnings: [],
          errors: [`Target not found: ${name}`],
          redaction: mergeRedactions(targets.map((item) => item.redaction)),
          humanSummary: `Target ${name} was not found.`,
        });
      }
      const guide = protocol && protocol !== target.protocol ? connectionGuide(protocol, name, config.gateway, warpgateUser) : connectionGuide(target.protocol, name, config.gateway, warpgateUser);
      return toolText({
        status: 'ok',
        data: { guide },
        warnings: [],
        errors: [],
        redaction: target.redaction,
        humanSummary: guide.summary,
      });
    },
  );

  server.registerTool(
    'resolve_target',
    {
      title: 'Resolve Warpgate Target',
      description:
        'Resolve a human request into the most likely Warpgate target without generating a connection command. Returns resolved, ambiguous, or not_found with confidence and match reason.',
      inputSchema: {
        query: z.string().min(1),
        protocol: protocolSchema.optional(),
      },
    },
    async (input) => toolText(resolveTarget(await client.listTargets(), input)),
  );

  server.registerTool(
    'resolve_connection',
    {
      title: 'Resolve Warpgate Connection',
      description:
        'Resolve a user request like "connect to node1" into a safe Warpgate connection command. Prefer this tool before list_targets when the user wants to connect to something. Returns either one resolved command or an ambiguous candidate list.',
      inputSchema: {
        query: z.string().min(1),
        protocol: protocolSchema.optional(),
        warpgateUser: z.string().optional(),
        client: z.string().optional(),
      },
    },
    async (input) =>
      toolText(
        resolveConnection(await client.listTargets(), {
          ...input,
          exposureLevel: config.exposureLevel,
          gateway: config.gateway,
        }),
      ),
  );

  server.registerPrompt(
    'connect-via-warpgate',
    {
      title: 'Connect via Warpgate',
      description: 'Find a target through Warpgate MCP, get a safe connection command, and explain the next step without asking for upstream secrets.',
      argsSchema: { query: z.string().optional() },
    },
    ({ query }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Find the Warpgate target${query ? ` for "${query}"` : ''} with resolve_connection. If ambiguous, show candidates. Never ask for upstream credentials.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'list-my-hosts',
    {
      title: 'List My Hosts',
      description: 'List available Warpgate targets safely.',
    },
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text: 'List available Warpgate targets using list_targets and summarize them by protocol and group.' } }],
    }),
  );

  server.registerPrompt(
    'troubleshoot-warpgate-connection',
    {
      title: 'Troubleshoot Warpgate Connection',
      description: 'Help troubleshoot a Warpgate connection command.',
      argsSchema: { command: z.string().optional() },
    },
    ({ command }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Help troubleshoot this Warpgate connection${command ? `: ${command}` : ''}. Check target, protocol, listener, port, username format, URL encoding, and shell quoting.`,
          },
        },
      ],
    }),
  );

  return server;
}
