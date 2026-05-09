#!/bin/sh
set -eu

SERVER_NAME="warpgate"
PACKAGE="warpgate-mcp"

say() { printf '%s\n' "$*"; }
die() { say "Error: $*" >&2; exit 1; }

need_tty() {
  ( : < /dev/tty ) 2>/dev/null || die "Interactive install requires a terminal. Set WARPGATE_MCP_ASSUME_YES=1 and environment variables for non-interactive use."
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

version_ge() {
  current=$1
  required=$2
  awk -v current="$current" -v required="$required" '
    BEGIN {
      split(current, c, "."); split(required, r, ".");
      for (i = 1; i <= 3; i++) {
        if ((c[i] + 0) > (r[i] + 0)) exit 0;
        if ((c[i] + 0) < (r[i] + 0)) exit 1;
      }
      exit 0;
    }'
}

prompt() {
  name=$1
  label=$2
  default_value=${3:-}
  secret=${4:-0}
  current_value=$(eval "printf '%s' \"\${$name:-}\"")
  if [ -n "$current_value" ]; then
    return 0
  fi
  if [ "${WARPGATE_MCP_ASSUME_YES:-0}" = "1" ]; then
    [ -n "$default_value" ] || die "$name is required in non-interactive mode"
    eval "$name=\$default_value"
    export "$name"
    return 0
  fi
  if [ "$secret" = "1" ]; then
    need_tty
    printf '%s: ' "$label" >&2
    stty_orig=$(stty -g < /dev/tty 2>/dev/null || true)
    stty -echo < /dev/tty 2>/dev/null || true
    IFS= read -r answer < /dev/tty
    [ -n "$stty_orig" ] && stty "$stty_orig" < /dev/tty 2>/dev/null || true
    printf '\n' >&2
  elif [ -n "$default_value" ]; then
    need_tty
    printf '%s [%s]: ' "$label" "$default_value" >&2
    IFS= read -r answer < /dev/tty
    [ -n "$answer" ] || answer=$default_value
  else
    need_tty
    printf '%s: ' "$label" >&2
    IFS= read -r answer < /dev/tty
  fi
  [ -n "$answer" ] || die "$name is required"
  eval "$name=\$answer"
  export "$name"
}

confirm() {
  question=$1
  if [ "${WARPGATE_MCP_ASSUME_YES:-0}" = "1" ]; then
    return 0
  fi
  need_tty
  printf '%s [y/N]: ' "$question" >&2
  IFS= read -r answer < /dev/tty
  case $answer in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

host_from_url() {
  printf '%s' "$1" | sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##; s#/.*$##; s#^\[[^]]+\](:[0-9]+)?$#localhost#; s#:([0-9]+)$##'
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

print_json_block() {
  base_url=$(json_escape "$WARPGATE_BASE_URL")
  warpgate_user=$(json_escape "$WARPGATE_USER")
  tls_verify=$(json_escape "$WARPGATE_TLS_VERIFY")
  ssh_host=$(json_escape "$WARPGATE_SSH_HOST")
  ssh_port=$(json_escape "$WARPGATE_SSH_PORT")
  http_base_url=$(json_escape "$WARPGATE_HTTP_BASE_URL")
  mysql_host=$(json_escape "$WARPGATE_MYSQL_HOST")
  mysql_port=$(json_escape "$WARPGATE_MYSQL_PORT")
  cat <<EOF
{
  "mcpServers": {
    "$SERVER_NAME": {
      "command": "npx",
      "args": ["-y", "$PACKAGE"],
      "env": {
        "WARPGATE_BASE_URL": "$base_url",
        "WARPGATE_ADMIN_TOKEN": "<redacted>",
        "WARPGATE_USER": "$warpgate_user",
        "WARPGATE_TLS_VERIFY": "$tls_verify",
        "WARPGATE_SSH_HOST": "$ssh_host",
        "WARPGATE_SSH_PORT": "$ssh_port",
        "WARPGATE_HTTP_BASE_URL": "$http_base_url",
        "WARPGATE_MYSQL_HOST": "$mysql_host",
        "WARPGATE_MYSQL_PORT": "$mysql_port"
      }
    }
  }
}
EOF
}

toml_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

shell_escape() {
  printf "'"
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
  printf "'"
}

print_codex_block() {
  token_value=${1:-"<redacted>"}
  base_url=$(toml_escape "$WARPGATE_BASE_URL")
  token_value=$(toml_escape "$token_value")
  warpgate_user=$(toml_escape "$WARPGATE_USER")
  tls_verify=$(toml_escape "$WARPGATE_TLS_VERIFY")
  ssh_host=$(toml_escape "$WARPGATE_SSH_HOST")
  ssh_port=$(toml_escape "$WARPGATE_SSH_PORT")
  http_base_url=$(toml_escape "$WARPGATE_HTTP_BASE_URL")
  mysql_host=$(toml_escape "$WARPGATE_MYSQL_HOST")
  mysql_port=$(toml_escape "$WARPGATE_MYSQL_PORT")
  cat <<EOF
[mcp_servers.$SERVER_NAME]
command = "npx"
args = ["-y", "$PACKAGE"]
env = { WARPGATE_BASE_URL = "$base_url", WARPGATE_ADMIN_TOKEN = "$token_value", WARPGATE_USER = "$warpgate_user", WARPGATE_TLS_VERIFY = "$tls_verify", WARPGATE_SSH_HOST = "$ssh_host", WARPGATE_SSH_PORT = "$ssh_port", WARPGATE_HTTP_BASE_URL = "$http_base_url", WARPGATE_MYSQL_HOST = "$mysql_host", WARPGATE_MYSQL_PORT = "$mysql_port" }
EOF
}

write_file_config() {
  config_path=${WARPGATE_CONFIG_FILE:-"${HOME:-.}/.config/warpgate-mcp/config.json"}
  config_dir=$(dirname "$config_path")
  mkdir -p "$config_dir"

  if [ -f "$config_path" ]; then
    backup_path="$config_path.backup.$(date +%Y%m%d%H%M%S)"
    cp "$config_path" "$backup_path"
    say "Backup written: $backup_path"
  fi

  base_url=$(json_escape "$WARPGATE_BASE_URL")
  token_value=$(json_escape "$WARPGATE_ADMIN_TOKEN")
  warpgate_user=$(json_escape "$WARPGATE_USER")
  tls_verify=$(printf '%s' "$WARPGATE_TLS_VERIFY" | tr '[:upper:]' '[:lower:]')
  ssh_host=$(json_escape "$WARPGATE_SSH_HOST")
  ssh_port=$(json_escape "$WARPGATE_SSH_PORT")
  http_base_url=$(json_escape "$WARPGATE_HTTP_BASE_URL")
  mysql_host=$(json_escape "$WARPGATE_MYSQL_HOST")
  mysql_port=$(json_escape "$WARPGATE_MYSQL_PORT")

  case $tls_verify in
    1|true|yes|on) tls_verify_json=true ;;
    *) tls_verify_json=false ;;
  esac

  cat > "$config_path" <<EOF
{
  "baseUrl": "$base_url",
  "adminToken": "$token_value",
  "warpgateUser": "$warpgate_user",
  "tlsVerify": $tls_verify_json,
  "gateway": {
    "ssh": { "host": "$ssh_host", "port": $ssh_port },
    "http": { "baseUrl": "$http_base_url" },
    "mysql": { "host": "$mysql_host", "port": $mysql_port }
  }
}
EOF
  chmod 600 "$config_path" 2>/dev/null || true
  say "Warpgate MCP config written: $config_path"
}

write_hermes_config() {
  write_file_config
  wrapper_path=${WARPGATE_HERMES_COMMAND:-"${HOME:-.}/.local/bin/warpgate-mcp-hermes"}
  wrapper_dir=$(dirname "$wrapper_path")
  mkdir -p "$wrapper_dir"

  base_url=$(shell_escape "$WARPGATE_BASE_URL")
  token_value=$(shell_escape "$WARPGATE_ADMIN_TOKEN")
  warpgate_user=$(shell_escape "$WARPGATE_USER")
  tls_verify=$(shell_escape "$WARPGATE_TLS_VERIFY")
  ssh_host=$(shell_escape "$WARPGATE_SSH_HOST")
  ssh_port=$(shell_escape "$WARPGATE_SSH_PORT")
  http_base_url=$(shell_escape "$WARPGATE_HTTP_BASE_URL")
  mysql_host=$(shell_escape "$WARPGATE_MYSQL_HOST")
  mysql_port=$(shell_escape "$WARPGATE_MYSQL_PORT")
  config_path=$(shell_escape "${WARPGATE_CONFIG_FILE:-"${HOME:-.}/.config/warpgate-mcp/config.json"}")

  if [ -f "$wrapper_path" ]; then
    backup_path="$wrapper_path.backup.$(date +%Y%m%d%H%M%S)"
    cp "$wrapper_path" "$backup_path"
    say "Backup written: $backup_path"
  fi

  cat > "$wrapper_path" <<EOF
#!/bin/sh
export WARPGATE_CONFIG_FILE=$config_path
export WARPGATE_BASE_URL=$base_url
export WARPGATE_ADMIN_TOKEN=$token_value
export WARPGATE_USER=$warpgate_user
export WARPGATE_TLS_VERIFY=$tls_verify
export WARPGATE_SSH_HOST=$ssh_host
export WARPGATE_SSH_PORT=$ssh_port
export WARPGATE_HTTP_BASE_URL=$http_base_url
export WARPGATE_MYSQL_HOST=$mysql_host
export WARPGATE_MYSQL_PORT=$mysql_port
exec npx -y $PACKAGE "\$@"
EOF
  chmod 700 "$wrapper_path" 2>/dev/null || true
  say "Hermes MCP command written: $wrapper_path"

  need_cmd hermes
  if hermes mcp add "$SERVER_NAME" --command "$wrapper_path"; then
    say "Hermes MCP server added: $SERVER_NAME"
  else
    say "Hermes MCP add failed. If '$SERVER_NAME' already exists, run: hermes mcp remove $SERVER_NAME"
    return 1
  fi
}

write_codex_config() {
  config_path=${CODEX_CONFIG_FILE:-"${HOME:-.}/.codex/config.toml"}
  config_dir=$(dirname "$config_path")
  mkdir -p "$config_dir"

  block=$(mktemp)
  print_codex_block "$WARPGATE_ADMIN_TOKEN" > "$block"

  if [ -f "$config_path" ]; then
    backup_path="$config_path.backup.$(date +%Y%m%d%H%M%S)"
    cp "$config_path" "$backup_path"
    say "Backup written: $backup_path"
    awk '
      /^\[mcp_servers\.warpgate\]$/ { skip = 1; next }
      /^\[/ { skip = 0 }
      skip != 1 { print }
    ' "$config_path" > "$config_path.tmp"
    [ ! -s "$config_path.tmp" ] || printf '\n' >> "$config_path.tmp"
    cat "$block" >> "$config_path.tmp"
    mv "$config_path.tmp" "$config_path"
  else
    if ! confirm "Codex config was not found at $config_path. Create it?"; then
      say "No config written. Add this block manually:"
      print_codex_block
      rm -f "$block"
      return 0
    fi
    cp "$block" "$config_path"
    chmod 600 "$config_path" 2>/dev/null || true
  fi
  rm -f "$block"
  say "Codex MCP config updated: $config_path"
}

need_cmd node
need_cmd npx

node_version=$(node -p "process.versions.node")
version_ge "$node_version" "20.11.0" || die "Node.js >=20.11 is required. Found $node_version"

if [ -z "${WARPGATE_MCP_CLIENT:-}" ]; then
  if [ "${WARPGATE_MCP_ASSUME_YES:-0}" = "1" ]; then
    WARPGATE_MCP_CLIENT=codex
  else
    need_tty
    printf 'MCP client (codex, claude, cursor, vscode, hermes) [codex]: ' >&2
    IFS= read -r WARPGATE_MCP_CLIENT < /dev/tty
    WARPGATE_MCP_CLIENT=${WARPGATE_MCP_CLIENT:-codex}
  fi
fi

case $WARPGATE_MCP_CLIENT in
  codex|claude|cursor|vscode|hermes) ;;
  *) die "Unsupported MCP client: $WARPGATE_MCP_CLIENT" ;;
esac

prompt WARPGATE_BASE_URL "Warpgate HTTP/API base URL" "${WARPGATE_BASE_URL:-https://localhost:8888}" 0
prompt WARPGATE_ADMIN_TOKEN "Warpgate admin token" "" 1
prompt WARPGATE_USER "Warpgate username for connection examples" "${WARPGATE_USER:-admin}" 0
prompt WARPGATE_TLS_VERIFY "Verify TLS certificates" "${WARPGATE_TLS_VERIFY:-false}" 0

default_host=$(host_from_url "$WARPGATE_BASE_URL")
prompt WARPGATE_SSH_HOST "Warpgate SSH listener host" "${WARPGATE_SSH_HOST:-$default_host}" 0
prompt WARPGATE_SSH_PORT "Warpgate SSH listener port" "${WARPGATE_SSH_PORT:-2222}" 0
prompt WARPGATE_HTTP_BASE_URL "Warpgate HTTP listener base URL" "${WARPGATE_HTTP_BASE_URL:-$WARPGATE_BASE_URL}" 0
prompt WARPGATE_MYSQL_HOST "Warpgate MySQL listener host" "${WARPGATE_MYSQL_HOST:-$default_host}" 0
prompt WARPGATE_MYSQL_PORT "Warpgate MySQL listener port" "${WARPGATE_MYSQL_PORT:-33306}" 0

say ""
case $WARPGATE_MCP_CLIENT in
  codex)
    if confirm "Write MCP server '$SERVER_NAME' to Codex config now?"; then
      write_codex_config
    else
      say "No config written. Add this block manually:"
      print_codex_block
    fi
    ;;
  hermes)
    if confirm "Write MCP server '$SERVER_NAME' to Hermes config now?"; then
      write_hermes_config
    else
      write_file_config
      say "No Hermes server written. Add it manually:"
      say "  hermes mcp add $SERVER_NAME --command \"${WARPGATE_HERMES_COMMAND:-"${HOME:-.}/.local/bin/warpgate-mcp-hermes"}\""
    fi
    ;;
  *)
    say "Automatic writes for $WARPGATE_MCP_CLIENT are intentionally best-effort. Add this block to your MCP client config:"
    print_json_block
    ;;
esac

say ""
say "Next check:"
if [ "$WARPGATE_MCP_CLIENT" = "hermes" ]; then
  say "  ${WARPGATE_HERMES_COMMAND:-"${HOME:-.}/.local/bin/warpgate-mcp-hermes"} doctor"
else
  say "  npx -y warpgate-mcp doctor"
fi
