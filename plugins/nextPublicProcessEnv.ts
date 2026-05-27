import { type Plugin, loadEnv } from 'vite';

/**
 * Makes `process.env` safe on the **client** only.
 *   • NEXT_PUBLIC_* keys get their literal values.
 *   • Every other key returns `undefined`.
 * Server / SSR code is untouched.
 */
export function nextPublicProcessEnv(): Plugin {
  const publicEnv = loadEnv(
    process.env.NODE_ENV ?? 'development',
    process.cwd(),
    'NEXT_PUBLIC_',
  );

  const qbEnv = loadEnv(
    process.env.NODE_ENV ?? 'development',
    process.cwd(),
    'QB_',
  );

  const gmailEnv = loadEnv(
    process.env.NODE_ENV ?? 'development',
    process.cwd(),
    'GMAIL_',
  );

  // Securely pick only IDs, NEVER secrets
  // Fallback to system process.env if loadEnv (which only reads files) misses them
  const integrationEnv = {
    QB_CLIENT_ID: qbEnv.QB_CLIENT_ID || process.env.QB_CLIENT_ID,
    GMAIL_CLIENT_ID: gmailEnv.GMAIL_CLIENT_ID || process.env.GMAIL_CLIENT_ID,
  };

  const stub = `
if (typeof window !== 'undefined') {
  const $public = ${JSON.stringify({ ...publicEnv, ...integrationEnv })};
  globalThis.process ??= {};
  // Preserve any env vars set by other libraries
  const base = globalThis.process.env ?? {};
  
  // Use a proxy to merge values and prevent double-injection issues in chunks
  if (!globalThis.process.__env_proxy_applied) {
    globalThis.process.env = new Proxy(Object.assign({}, $public, base), {
      get(t, p) { return p in t ? t[p] : undefined; },
      has() { return true; }
    });
    globalThis.process.__env_proxy_applied = true;
  } else {
    // If already applied, just merge new values into the existing target
    Object.assign(globalThis.process.env, $public);
  }
}
`;

  return {
    name: 'vite:next-public-process-env',
    enforce: 'post',

    transform(code, id, opts) {
      if (opts?.ssr) return null;                          // server/SSR build → leave untouched
      if (id.includes('node_modules')) return null;        // ignore libraries to speed up build
      if (!/\.[cm]?[jt]sx?$/.test(id)) return null;  // ignore non-JS modules
      if (code.includes('globalThis.process.__env_proxy_applied')) return null; // already injected
      return { code: stub + code, map: null };
    },
  };
}

