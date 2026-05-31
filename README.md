# Warpgate MCP

[![npm version](https://img.shields.io/npm/v/warpgate-mcp.svg)](https://www.npmjs.com/package/warpgate-mcp)
[![npm downloads](https://img.shields.io/npm/dm/warpgate-mcp.svg)](https://www.npmjs.com/package/warpgate-mcp)
[![license](https://img.shields.io/npm/l/warpgate-mcp.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.11-339933?logo=node.js&logoColor=white)](package.json)
[![Model Context Protocol](https://img.shields.io/badge/MCP-compatible-6f42c1)](https://modelcontextprotocol.io/)
[![Warpgate](https://img.shields.io/badge/Warpgate-bastion-0f766e)](https://github.com/warp-tech/warpgate)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white)](tsconfig.json)

AI-friendly, read-only MCP server for discovering [Warpgate](https://github.com/warp-tech/warpgate) targets and producing safe connection commands through the bastion.

Ask your agent to “connect to work”, “find the prod database”, or “show SSH targets”, and let Warpgate MCP resolve the right bastion route without exposing upstream credentials.

## Why Warpgate MCP

AI coding agents are good at operating terminals, but they should not guess SSH hosts, database listeners, or private infrastructure routes. Warpgate MCP turns your Warpgate target inventory into a read-only toolset for agents.

- Agents discover target names, protocols, groups, labels, and safe connection hints.
- Humans still authenticate through Warpgate; upstream credentials stay inside Warpgate.
- Generated commands use Warpgate syntax such as `admin:target@gateway` and `admin#database-target`.
- Works with local-first agents and MCP clients over `stdio`; HTTP mode is available for controlled deployments.

## Demo

```text
User: connect to work

Agent calls: resolve_connection({ "query": "work", "protocol": "ssh" })

Warpgate MCP returns:
  ssh 'admin:work@10.0.0.5' -p 2222

No upstream private key, password, or internal host credential is exposed.
```

## Supported Clients

| Client | Install path |
| --- | --- |
| Codex | Interactive installer writes `~/.codex/config.toml` |
| Hermes Agent | Interactive installer writes a local wrapper and runs `hermes mcp add` |
| Claude Desktop | JSON MCP config snippet |
| Cursor | JSON MCP config snippet |
| VS Code | JSON MCP config snippet |

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/n0pashkov/warpgate-mcp/master/scripts/install.sh | sh
```

Or run directly from npm:

```sh
npx -y warpgate-mcp init
npx -y warpgate-mcp doctor
npx -y warpgate-mcp install codex
```

## What It Does

- Reads targets from Warpgate Admin API: `GET /@warpgate/admin/api/targets`.
- Helps AI agents resolve requests like "connect to node1" into a concrete Warpgate target.
- Returns copy-paste-safe commands for SSH, HTTP, MySQL, PostgreSQL, and Kubernetes.
- Supports MCP over `stdio` and Streamable HTTP at `/mcp`.
- Redacts upstream secrets and reports redaction metadata.

## What It Never Does

- It does not create, edit, or delete Warpgate targets.
- It does not return upstream passwords, private keys, database passwords, Kubernetes tokens, or credential-bearing URLs.
- It does not require users to know upstream credentials. Users authenticate to Warpgate.

## Quick Start

Use the published npm package:

```sh
npx -y warpgate-mcp init
npx -y warpgate-mcp doctor
npx -y warpgate-mcp install codex
```

Run the MCP server over stdio after configuration:

```sh
npx -y warpgate-mcp
```

Short aliases are available:

```sh
warpgate-mcp setup   # same as init
warpgate-mcp check   # same as doctor
warpgate-mcp install codex
```

Local checkout:

```sh
cd /home/justnik/warpgate-mcp
npm install
npm run build
npm link
```

## Install With One Command

Interactive installer:

```sh
curl -fsSL https://raw.githubusercontent.com/n0pashkov/warpgate-mcp/master/scripts/install.sh | sh
```

The installer checks Node.js `>=20.11`, checks `npx`, asks for your MCP client (`codex`, `claude`, `cursor`, `vscode`, or `hermes`), prompts for Warpgate settings, and creates a backup before writing a client config. It does not print the admin token after input.

For Hermes, the installer writes `~/.config/warpgate-mcp/config.json` with mode `600`, writes an executable wrapper at `~/.local/bin/warpgate-mcp-hermes`, then runs:

```sh
hermes mcp add warpgate --command "$HOME/.local/bin/warpgate-mcp-hermes"
```

Supported non-interactive variables:

```sh
export WARPGATE_BASE_URL="https://warpgate.example.com"
export WARPGATE_ADMIN_TOKEN="..."
export WARPGATE_USER="admin"
export WARPGATE_TLS_VERIFY="false"
export WARPGATE_MCP_CLIENT="hermes"
export WARPGATE_MCP_ASSUME_YES="1"
curl -fsSL https://raw.githubusercontent.com/n0pashkov/warpgate-mcp/master/scripts/install.sh | sh
```

For local Warpgate deployments, the installer defaults to SSH port `2222`, HTTP/API from `WARPGATE_BASE_URL`, and MySQL port `33306`.

## Prompt For Local Agents

Paste this prompt into a local coding agent that can edit your config files:

```text
Install Warpgate MCP for my local agent setup.

Use the npm package `warpgate-mcp`. Configure it as an MCP server named `warpgate`.

Use stdio transport with:
command: npx
args: ["-y", "warpgate-mcp"]

Ask me for these values if they are not already available locally:
- WARPGATE_BASE_URL, for example https://10.0.0.5:8888
- WARPGATE_ADMIN_TOKEN
- WARPGATE_USER, your Warpgate login used in generated commands, for example admin
- WARPGATE_TLS_VERIFY, usually false for a self-signed local Warpgate
- WARPGATE_SSH_HOST and WARPGATE_SSH_PORT, if different from the base host and 2222
- WARPGATE_MYSQL_HOST and WARPGATE_MYSQL_PORT, if MySQL targets are used

Do not print or log the admin token. Back up any MCP client config before writing.

After configuration, run `npx -y warpgate-mcp doctor` with the same environment and verify that targets load. Then test the MCP tool `resolve_connection` for one target without connecting directly to the upstream host.
```

## MCP Tools

- `resolve_connection`: best first tool when a user wants to connect to something. Returns `resolved`, `ambiguous`, or `not_found` plus command variants.
- `resolve_target`: resolves a human query to a target without generating a command.
- `list_targets`: lists visible targets using the configured exposure level.
- `search_targets`: searches by name, description, protocol, group, host hint, and labels.
- `get_target`: gets one target.
- `connection_guide`: generates commands for a known target name.

Tool responses are structured JSON:

```json
{
  "status": "resolved",
  "data": {},
  "warnings": [],
  "errors": [],
  "redaction": {
    "enabled": true,
    "redactedFieldsCount": 0,
    "redactedFieldPaths": []
  },
  "humanSummary": "Resolved target."
}
```

## Configuration

Required:

```sh
export WARPGATE_BASE_URL="https://warpgate.example.com"
export WARPGATE_ADMIN_TOKEN="..."
export WARPGATE_USER="admin"
```

Optional:

```sh
export WARPGATE_TLS_VERIFY="true"
export WARPGATE_CONFIG_FILE="$HOME/.config/warpgate-mcp/config.json"
export WARPGATE_EXPOSURE_LEVEL="normal"

export WARPGATE_SSH_HOST="gateway.example.com"
export WARPGATE_SSH_PORT="2222"
export WARPGATE_HTTP_BASE_URL="https://gateway.example.com"
export WARPGATE_MYSQL_HOST="gateway.example.com"
export WARPGATE_MYSQL_PORT="3306"
export WARPGATE_POSTGRES_HOST="gateway.example.com"
export WARPGATE_POSTGRES_PORT="5432"
export WARPGATE_KUBERNETES_BASE_URL="https://gateway.example.com:8443"
```

## Add To Clients

Print ready config snippets:

```sh
npx -y warpgate-mcp install claude
npx -y warpgate-mcp install cursor
npx -y warpgate-mcp install codex
npx -y warpgate-mcp install vscode
```

Codex example:

```toml
[mcp_servers.warpgate]
command = "npx"
args = ["-y", "warpgate-mcp"]
env = { WARPGATE_BASE_URL = "https://warpgate.example.com", WARPGATE_ADMIN_TOKEN = "put-token-here", WARPGATE_USER = "admin" }
```

Claude Desktop / Cursor / VS Code style:

```json
{
  "mcpServers": {
    "warpgate": {
      "command": "npx",
      "args": ["-y", "warpgate-mcp"],
      "env": {
        "WARPGATE_BASE_URL": "https://warpgate.example.com",
        "WARPGATE_ADMIN_TOKEN": "put-token-here",
        "WARPGATE_USER": "admin"
      }
    }
  }
}
```

## Connection Examples

Set `WARPGATE_USER` to make generated commands include the Warpgate login explicitly. For SSH, Warpgate expects `user:target@gateway`, for example `admin:node1@gateway.example.com`; database listeners use `user#target`.

The SSH colon is not a username/password separator. In `admin:truenas@10.0.0.5`, the SSH username is the entire `admin:truenas` value, the gateway host is `10.0.0.5`, and no password is embedded in the command. Agents should use the returned command exactly instead of rewriting it into a direct SSH login.

SSH target with a space in the name:

```sh
ssh 'admin:node 1@gateway.example.com' -p 2222
```

MySQL:

```sh
mysql -h gateway.example.com -P 3306 -u 'admin#mysql-target' -p
```

PostgreSQL uses `%23` for the Warpgate `user#target` separator:

```sh
psql 'postgresql://admin%23postgres-target@gateway.example.com:5432/postgres'
```

Kubernetes:

```sh
kubectl --server='https://gateway.example.com:8443/cluster-target' get namespaces
```

## Exposure Levels

```sh
export WARPGATE_EXPOSURE_LEVEL=minimal
```

- `minimal`: name, protocol, description, groups, and whether connection guidance is available.
- `normal`: minimal plus labels, host hint, and connection guidance.
- `debug`: normal plus redacted raw target data and redaction metadata.

## HTTP Mode Security

Default HTTP bind address is `127.0.0.1`.

```sh
MCP_TRANSPORT=http MCP_HTTP_PORT=3000 npx warpgate-mcp
```

If you bind to `0.0.0.0`, the server prints a warning because target names, groups, labels, and host hints can reveal infrastructure metadata.

Recommended shared setup:

```sh
export MCP_TRANSPORT=http
export MCP_HTTP_HOST=0.0.0.0
export MCP_REQUIRE_AUTH=true
export MCP_AUTH_TOKEN="long-random-token"
export MCP_ALLOWED_ORIGINS="https://trusted-client.example.com"
npx warpgate-mcp
```

## Deploy Site On Vercel

The landing page lives in `site/` as a standalone Next.js app. In Vercel, set:

- Framework Preset: `Next.js`
- Root Directory: `site`
- Build Command: `npm run build`
- Output Directory: `.next`

Local site development:

```sh
cd site
npm install
npm run dev
```

## Troubleshooting

Run:

```sh
npx -y warpgate-mcp doctor
```

It checks Node.js version, config loading, Warpgate API reachability, token validity, target loading, redaction, and listener configuration.

For MCP Inspector, run the server over stdio with the required environment variables, or use HTTP mode and point the inspector to `http://127.0.0.1:3000/mcp`.

After adding or changing the MCP client config, restart or reload the client so the current agent session discovers the server. Before asking an agent to connect, verify that the `warpgate` MCP server and its `resolve_connection` tool are available. If the tool is missing, restore the MCP integration instead of bypassing Warpgate or guessing direct target credentials.

Recommended agent policy:

```text
Use the Warpgate MCP resolve_connection tool before connecting to infrastructure.
Use returned commands exactly. For SSH, user:target@gateway is one Warpgate route:
the colon separates the Warpgate username from the target name, never a username
from a password. If Warpgate MCP tools are unavailable in the current session,
report that the MCP integration is not loaded and restore it before connecting.
Do not bypass Warpgate or guess direct target credentials.
```

## Security Model

The server assumes Warpgate remains the authority for credentials and access control. This MCP server only exposes target discovery and connection guidance. Use `minimal` exposure and local-only HTTP binding when sharing with less trusted MCP clients.

## Development

```sh
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Site checks:

```sh
cd site
npm run build
```
