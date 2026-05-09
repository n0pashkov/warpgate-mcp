const installCommand = 'curl -fsSL https://raw.githubusercontent.com/n0pashkov/warpgate-mcp/master/scripts/install.sh | sh';
const npxCommand = 'npx -y warpgate-mcp init';

const manualFlow = ['npx -y warpgate-mcp init', 'npx -y warpgate-mcp doctor', 'npx -y warpgate-mcp install codex'].join('\n');
const codexConfig = [
  '[mcp_servers.warpgate]',
  'command = "npx"',
  'args = ["-y", "warpgate-mcp"]',
  'env = {',
  '  WARPGATE_BASE_URL = "https://warpgate.example.com",',
  '  WARPGATE_USER = "admin",',
  '  WARPGATE_TLS_VERIFY = "true"',
  '}',
].join('\n');
const doctorCommand = [
  'WARPGATE_BASE_URL=https://warpgate.example.com \\',
  'WARPGATE_ADMIN_TOKEN=... \\',
  'WARPGATE_USER=admin \\',
  'npx -y warpgate-mcp doctor',
].join('\n');

const tools = [
  ['resolve_connection', 'Best first call when a user asks to connect. Returns a Warpgate route and copy-paste-safe commands.'],
  ['resolve_target', 'Matches a human request to one target without producing a connection command.'],
  ['search_targets', 'Filters visible targets by name, group, protocol, label, host hint, or description.'],
  ['connection_guide', 'Generates SSH, HTTP, MySQL, PostgreSQL, or Kubernetes command examples for a known target.'],
];

const clients = [
  ['Codex', 'Writes an MCP server named warpgate into your Codex config when confirmed.'],
  ['Claude', 'Prints a ready mcpServers block for Claude Desktop style configs.'],
  ['Cursor', 'Prints a Cursor-compatible MCP JSON block.'],
  ['VS Code', 'Prints a VS Code MCP block when direct config editing is not safe.'],
];

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="relative rounded-md border border-[color:var(--terminal-line)] bg-[color:var(--terminal)] p-4 pr-24 text-sm leading-6 text-slate-100 shadow-sm">
      <CopyButton value={children} />
      <pre className="whitespace-pre-wrap break-words">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 lg:px-8">
      <h2 className="max-w-3xl text-2xl font-semibold tracking-normal sm:text-3xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="border-b border-[color:var(--line)] bg-[color:var(--background)]/90">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <a className="mono text-sm font-semibold" href="#top" aria-label="Warpgate MCP home">
            Warpgate MCP
          </a>
          <div className="hidden items-center gap-5 text-sm text-[color:var(--muted)] sm:flex">
            <a href="#install">Install</a>
            <a href="#clients">Clients</a>
            <a href="#security">Security</a>
            <a href="https://github.com/n0pashkov/warpgate-mcp">GitHub</a>
          </div>
        </nav>
      </header>

      <section id="top" className="mx-auto grid min-h-[calc(100vh-65px)] w-full max-w-6xl items-center gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8">
        <div>
          <p className="mono text-sm font-semibold uppercase text-[color:var(--accent-strong)]">Read-only MCP for Warpgate</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight tracking-normal sm:text-6xl lg:text-7xl">
            Warpgate MCP
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)]">
            Give local AI agents a bastion-aware way to discover targets and produce safe connection commands without exposing upstream credentials.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="primary-cta inline-flex min-h-11 items-center justify-center rounded-md bg-slate-100 px-5 text-sm font-semibold shadow-sm transition hover:bg-white dark:bg-slate-100" href="#install">
              {npxCommand}
            </a>
            <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--line)] px-5 text-sm font-semibold" href="https://github.com/n0pashkov/warpgate-mcp">
              GitHub repository
            </a>
          </div>
        </div>

        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-3 shadow-sm">
          <div className="rounded-md bg-[color:var(--terminal)] p-4 text-sm text-slate-100">
            <div className="mb-4 flex gap-2 border-b border-[color:var(--terminal-line)] pb-3">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-yellow-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="mono space-y-3 leading-6">
              <p><span className="text-teal-300">$</span> npx -y warpgate-mcp doctor</p>
              <p className="text-slate-300">✓ Node.js version OK</p>
              <p className="text-slate-300">✓ WARPGATE_BASE_URL reachable</p>
              <p className="text-slate-300">✓ Token accepted</p>
              <p className="text-slate-300">✓ 18 targets loaded</p>
              <p className="pt-4"><span className="text-teal-300">$</span> resolve_connection node1</p>
              <p className="text-slate-300">ssh 'admin:node1@gateway.example.com' -p 2222</p>
            </div>
          </div>
        </div>
      </section>

      <Section id="what" title="What It Does">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['Discovers targets', 'Reads Warpgate Admin API targets and returns normalized, redacted metadata for agents.'],
            ['Resolves intent', 'Turns requests like connect to node1 into the right target, protocol, and bastion route.'],
            ['Guides connections', 'Produces SSH, HTTP, MySQL, PostgreSQL, and Kubernetes commands that authenticate through Warpgate.'],
          ].map(([title, body]) => (
            <article className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5" key={title}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-3 leading-7 text-[color:var(--muted)]">{body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="install" title="Install">
        <div className="grid gap-5">
          <div>
            <p className="mb-4 leading-7 text-[color:var(--muted)]">Interactive setup with a config backup before writing client settings:</p>
            <CodeBlock>{installCommand}</CodeBlock>
          </div>
          <div>
            <p className="mb-4 leading-7 text-[color:var(--muted)]">Manual npm flow when you want to inspect every step:</p>
            <CodeBlock>{manualFlow}</CodeBlock>
          </div>
        </div>
      </Section>

      <Section id="clients" title="Add To Codex, Claude, Cursor, Or VS Code">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {clients.map(([title, body]) => (
            <article className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5" key={title}>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="security" title="Security Model">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="leading-7 text-[color:var(--muted)]">
            <p>Warpgate MCP is read-only. It does not create, edit, delete, or connect to upstream targets.</p>
            <p className="mt-4">It redacts credential-bearing fields and produces commands that route through the Warpgate bastion, so local agents do not need upstream passwords, private keys, or database credentials.</p>
          </div>
          <CodeBlock>{codexConfig}</CodeBlock>
        </div>
      </Section>

      <Section id="tools" title="MCP Tools">
        <div className="divide-y divide-[color:var(--line)] rounded-md border border-[color:var(--line)] bg-[color:var(--panel)]">
          {tools.map(([name, body]) => (
            <div className="grid gap-2 p-5 md:grid-cols-[220px_1fr]" key={name}>
              <code className="mono text-sm font-semibold text-[color:var(--accent-strong)]">{name}</code>
              <p className="leading-7 text-[color:var(--muted)]">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="troubleshooting" title="Troubleshooting">
        <div className="grid gap-5 lg:grid-cols-2">
          <CodeBlock>{doctorCommand}</CodeBlock>
          <div className="leading-7 text-[color:var(--muted)]">
            <p>Use <code className="mono">doctor</code> to verify Node.js, configuration, TLS behavior, API reachability, token acceptance, and target loading.</p>
            <p className="mt-4">For local self-signed Warpgate deployments, set <code className="mono">WARPGATE_TLS_VERIFY=false</code> explicitly and keep the admin token out of shell history where possible.</p>
          </div>
        </div>
      </Section>

      <footer className="border-t border-[color:var(--line)] px-5 py-8 text-center text-sm text-[color:var(--muted)]">
        <span className="mono">warpgate-mcp</span> is MIT licensed and designed for local agent workflows.
      </footer>
    </main>
  );
}
import { CopyButton } from './components/CopyButton';
