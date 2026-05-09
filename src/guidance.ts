import type { ConnectionGuidance, GatewayEndpoints, Protocol } from './types.js';

function hostPort(host: string, port?: number): string {
  return port ? `${host}:${port}` : host;
}

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, `''`)}'`;
}

function user(value?: string): string {
  return value && value.trim() ? value : '<warpgate-user>';
}

export function connectionGuide(protocol: Protocol, target: string, gateway: GatewayEndpoints, warpgateUser?: string): ConnectionGuidance {
  const wgUser = user(warpgateUser);
  switch (protocol) {
    case 'ssh': {
      const login = `${wgUser}:${target}@${gateway.ssh.host}`;
      const command = `ssh ${shQuote(login)} -p ${gateway.ssh.port ?? 22}`;
      return {
        protocol,
        target,
        summary: `Connect to SSH target ${target} through the Warpgate SSH listener.`,
        examples: [command],
        commands: [
          { shell: 'bash/zsh', command, copyPasteSafe: true },
          { shell: 'powershell', command: `ssh ${psQuote(login)} -p ${gateway.ssh.port ?? 22}`, copyPasteSafe: true },
          { shell: 'plain', command: `ssh ${wgUser}:${target}@${gateway.ssh.host} -p ${gateway.ssh.port ?? 22}`, copyPasteSafe: !/\s/.test(target) },
        ],
        notes: ['Use your Warpgate username before the colon. Target upstream credentials remain managed by Warpgate.'],
      };
    }
    case 'mysql': {
      const login = `${wgUser}#${target}`;
      const command = `mysql -h ${gateway.mysql.host} -P ${gateway.mysql.port ?? 3306} -u ${shQuote(login)} -p`;
      return {
        protocol,
        target,
        summary: `Connect to MySQL target ${target} through the Warpgate MySQL listener.`,
        examples: [command],
        commands: [
          { shell: 'bash/zsh', command, copyPasteSafe: true },
          { shell: 'powershell', command: `mysql -h ${gateway.mysql.host} -P ${gateway.mysql.port ?? 3306} -u ${psQuote(login)} -p`, copyPasteSafe: true },
          { shell: 'plain', command: `mysql -h ${gateway.mysql.host} -P ${gateway.mysql.port ?? 3306} -u ${login} -p`, copyPasteSafe: !/\s/.test(login) },
        ],
        notes: ['The password prompt expects your Warpgate authentication secret, not an upstream database password.'],
      };
    }
    case 'postgres': {
      const encodedUser = encodeURIComponent(`${wgUser}#${target}`);
      const url = `postgresql://${encodedUser}@${hostPort(gateway.postgres.host, gateway.postgres.port)}/postgres`;
      const command = `psql ${shQuote(url)}`;
      return {
        protocol,
        target,
        summary: `Connect to PostgreSQL target ${target} through the Warpgate PostgreSQL listener.`,
        examples: [command],
        commands: [
          { shell: 'bash/zsh', command, copyPasteSafe: true },
          { shell: 'powershell', command: `psql ${psQuote(url)}`, copyPasteSafe: true },
          { shell: 'plain', command: `psql ${url}`, copyPasteSafe: !/\s/.test(url) },
        ],
        notes: ['The # separator must be URL-encoded as %23 in PostgreSQL URLs.'],
      };
    }
    case 'kubernetes': {
      const server = `${gateway.kubernetes.baseUrl}/${encodeURIComponent(target)}`;
      return {
        protocol,
        target,
        summary: `Use the Warpgate Kubernetes listener path for target ${target}.`,
        examples: [`kubectl --server=${server} get namespaces`],
        commands: [
          { shell: 'bash/zsh', command: `kubectl --server=${shQuote(server)} get namespaces`, copyPasteSafe: true },
          { shell: 'powershell', command: `kubectl --server=${psQuote(server)} get namespaces`, copyPasteSafe: true },
          { shell: 'plain', command: `kubectl --server=${server} get namespaces`, copyPasteSafe: !/\s/.test(server) },
        ],
        notes: ['Authenticate to Warpgate; do not embed upstream Kubernetes tokens in client configuration.'],
      };
    }
    case 'http': {
      const url = `${gateway.http.baseUrl}/?warpgate-target=${encodeURIComponent(target)}`;
      return {
        protocol,
        target,
        summary: `Open HTTP target ${target} through the Warpgate HTTP listener.`,
        examples: [url],
        commands: [
          { shell: 'bash/zsh', command: url, copyPasteSafe: true },
          { shell: 'powershell', command: url, copyPasteSafe: true },
          { shell: 'plain', command: url, copyPasteSafe: true },
        ],
        notes: ['If your Warpgate deployment maps targets to external hostnames, use the configured hostname binding instead.'],
      };
    }
    default:
      return {
        protocol,
        target,
        summary: `Target ${target} has an unrecognized protocol.`,
        examples: [],
        commands: [],
        notes: ['Inspect the redacted target metadata and configure a protocol-specific gateway override if needed.'],
      };
  }
}
