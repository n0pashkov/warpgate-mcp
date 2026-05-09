import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://warpgate-mcp.vercel.app'),
  title: 'Warpgate MCP - Bastion-aware tools for local AI agents',
  description:
    'A read-only MCP server that lets Codex, Claude, Cursor, and VS Code discover Warpgate targets and produce safe bastion connection commands.',
  openGraph: {
    title: 'Warpgate MCP',
    description: 'Bastion-aware MCP tools for local AI agents.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
