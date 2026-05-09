import type { GatewayEndpoints, ServerConfig, WarpgateTarget } from './types.js';
import { normalizeTarget } from './normalize.js';

export class WarpgateClient {
  constructor(private readonly config: Pick<ServerConfig, 'baseUrl' | 'adminToken' | 'warpgateUser' | 'tlsVerify'> & { gateway: GatewayEndpoints }) {}

  targetsUrl(): string {
    return `${this.config.baseUrl}/@warpgate/admin/api/targets`;
  }

  async listTargets(): Promise<WarpgateTarget[]> {
    if (!this.config.tlsVerify) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    let response: Response;
    try {
      response = await fetch(this.targetsUrl(), {
        headers: {
          Accept: 'application/json',
          'X-Warpgate-Token': this.config.adminToken,
        },
      });
    } catch (error) {
      throw new Error(`Failed to reach Warpgate Admin API at ${this.targetsUrl()}: ${formatFetchError(error)}`);
    }

    if (!response.ok) {
      throw new Error(`Warpgate Admin API returned ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload) ? payload : Array.isArray((payload as { targets?: unknown[] }).targets) ? (payload as { targets: unknown[] }).targets : [];
    return rows.map((target) => normalizeTarget(target, this.config.gateway, this.config.warpgateUser));
  }

  async getTarget(name: string): Promise<WarpgateTarget | undefined> {
    const targets = await this.listTargets();
    return targets.find((target) => target.name === name);
  }
}

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause && typeof cause === 'object') {
    const details = cause as { code?: string; syscall?: string; address?: string; port?: number; reason?: string; message?: string };
    const parts = [details.code, details.syscall, details.address, details.port?.toString(), details.reason ?? details.message].filter(Boolean);
    if (parts.length > 0) return `${error.message} (${parts.join(' ')})`;
  }
  return error.message;
}
