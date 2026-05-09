import type { RedactionMetadata } from './types.js';

const SECRET_KEY_RE = /(password|passwd|passphrase|private[_-]?key|secret|token|credential|auth|certificate|client[_-]?key|bearer|api[_-]?key)/i;

export function redactUrlCredentials(value: string): string {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = url.username ? 'REDACTED' : '';
      url.password = url.password ? 'REDACTED' : '';
      return url.toString();
    }
  } catch {
    return value;
  }
  return value;
}

export function redactSecrets<T>(value: T): T {
  return redactSecretsWithMetadata(value).value;
}

export function redactSecretsWithMetadata<T>(value: T): { value: T; metadata: RedactionMetadata } {
  const paths = new Set<string>();
  const redacted = redactValue(value, '', '', paths) as T;
  return {
    value: redacted,
    metadata: {
      enabled: true,
      redactedFieldsCount: paths.size,
      redactedFieldPaths: [...paths].sort(),
    },
  };
}

function redactValue(value: unknown, key: string, path: string, paths: Set<string>): unknown {
  if (SECRET_KEY_RE.test(key)) {
    paths.add(path || key);
    return '[REDACTED]';
  }
  if (typeof value === 'string') {
    const redacted = redactUrlCredentials(value);
    if (redacted !== value) {
      paths.add(path ? `${path}.url_credentials` : 'url_credentials');
    }
    return redacted;
  }
  if (Array.isArray(value)) return value.map((item, index) => redactValue(item, key, `${path}[${index}]`, paths));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childValue, childKey, path ? `${path}.${childKey}` : childKey, paths),
      ]),
    );
  }
  return value;
}
