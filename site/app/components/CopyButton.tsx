'use client';

import { useState } from 'react';

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      aria-label="Copy command"
      className="absolute right-3 top-3 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-teal-300 hover:text-teal-100"
      onClick={copy}
      type="button"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
