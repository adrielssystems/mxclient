/// <reference types="vite/client" />
import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// Helper function to transform file path to Hono route path
function getHonoPath(routeFile: string): { name: string; pattern: string }[] {
  // Normalize path separators to forward slashes
  const normalizedPath = routeFile.replace(/\\/g, '/');
  
  // Extract the part relative to /src/app/api/
  const match = normalizedPath.match(/\/src\/app\/api\/(.*)/);
  if (!match) return [{ name: 'root', pattern: '' }];
  
  const relativePath = match[1];
  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1); // Remove 'route.js'
  
  if (routeParts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }
  
  const transformedParts = routeParts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [_, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });
  return transformedParts;
}

async function registerRoutes() {
  // Use import.meta.glob to find files at build time
  const modules = import.meta.glob('../src/app/api/**/route.js', { eager: true });

  // Sort routes by path length (deepest first) to handle precedence
  const routeFiles = Object.keys(modules).sort((a, b) => {
      // Prioritize root route.js specially if needed, but length sort usually works.
      // The original code unshifted the root route, putting it first?
      // Actually original sort: return b.length - a.length; (Longest first)
      // Root route '.../api/route.js' is shorter than '.../api/sub/route.js'.
      // So root route comes LAST in desc length sort.
      // But original code: if root, unshift (put at start).
      // Let's stick to simple length sort for now, longest (most specific) first.
      return b.length - a.length;
  });

  api.routes = [];

  for (const routeFile of routeFiles) {
    try {
      const route: any = modules[routeFile];
      
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        try {
          if (route[method]) {
            const parts = getHonoPath(routeFile);
            const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
            const handler: Handler = async (c) => {
              const params = c.req.param();

              // In PROD/Build, we use the bundled module.
              // In DEV, we might want hot reload, but eager glob is static.
              // For true HMR in dev with glob, we'd need non-eager or just rely on Vite HMR.
              // Simple approach: just call the function.
              return await route[method](c.req.raw, { params });
            };
            
            const methodLowercase = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
             if (api[methodLowercase]) {
                api[methodLowercase](honoPath, handler);
             } else {
                 console.warn(`Unsupported method: ${method}`);
             }
          }
        } catch (error) {
          console.error(`Error registering route ${routeFile} for method ${method}:`, error);
        }
      }
    } catch (error) {
       console.error(`Error processing route file ${routeFile}:`, error);
    }
  }
}

// Initial route registration
await registerRoutes();

if (import.meta.env.DEV) {
    // Basic HMR support for the API routes is tricky with eager glob.
    // We can rely on full page reload or server restart for now.
    if (import.meta.hot) {
        import.meta.hot.accept(() => {
            // Re-importing isn't easy with eager glob as it's static.
            // But Vite server restart works.
        });
    }
}

export { api, API_BASENAME };
