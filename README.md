# Warpgate MCP

AI-friendly, read-only MCP server for discovering Warpgate targets and producing safe connection commands through the Warpgate bastion.

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

Before the package is published to npm, use the local checkout:

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

The installer checks Node.js `>=20.11`, checks `npx`, asks for your MCP client, prompts for Warpgate settings, and creates a backup before writing a client config. It does not print the admin token after input.

Supported non-interactive variables:

```sh
export WARPGATE_BASE_URL="https://warpgate.example.com"
export WARPGATE_ADMIN_TOKEN="..."
export WARPGATE_TLS_VERIFY="false"
export WARPGATE_MCP_CLIENT="codex"
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
env = { WARPGATE_BASE_URL = "https://warpgate.example.com", WARPGATE_ADMIN_TOKEN = "put-token-here" }
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
        "WARPGATE_ADMIN_TOKEN": "put-token-here"
      }
    }
  }
}
```

## Connection Examples

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
