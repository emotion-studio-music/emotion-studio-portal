/** Accetta solo link web veri (http/https): niente "javascript:" o altri trucchi nei link salvati. */
export function safeUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export function safeLinks<T extends object>(links: T | undefined): { [K in keyof T]?: string } {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(links ?? {})) { const s = safeUrl(v); if (s) out[k] = s; }
  return out as { [K in keyof T]?: string };
}
