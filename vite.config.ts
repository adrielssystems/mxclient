import path from 'node:path';
import { reactRouter } from '@react-router/dev/vite';
import { reactRouterHonoServer } from 'react-router-hono-server/dev';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import tsconfigPaths from 'vite-tsconfig-paths';
import { addRenderIds } from './plugins/addRenderIds';
import { aliases } from './plugins/aliases';
import consoleToParent from './plugins/console-to-parent';
import { layoutWrapperPlugin } from './plugins/layouts';
import { loadFontsFromTailwindSource } from './plugins/loadFontsFromTailwindSource';
import { nextPublicProcessEnv } from './plugins/nextPublicProcessEnv';
import { restart } from './plugins/restart';
import { restartEnvFileChange } from './plugins/restartEnvFileChange';

export default defineConfig({
  // Keep them available via import.meta.env.NEXT_PUBLIC_*
  envPrefix: ['NEXT_PUBLIC_'],
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  optimizeDeps: {
    // Explicitly include fast-glob, since it gets dynamically imported and we
    // don't want that to cause a re-bundle.
    include: ['fast-glob', 'lucide-react'],
    exclude: [
      '@hono/auth-js/react',
      '@hono/auth-js',
      '@auth/core',
      '@hono/auth-js',
      'hono/context-storage',
      '@auth/core/errors',
      'fsevents',
      'lightningcss',
    ],
  },
  logLevel: 'info',
  plugins: [
    nextPublicProcessEnv(),
    restartEnvFileChange(),
    reactRouterHonoServer({
      serverEntryPoint: './__create/index.ts',
      runtime: 'node',
    }),
    babel({
      filter: /\.(jsx|tsx)(\?.*)?$/,
      babelConfig: {
        presets: [
          ['@babel/preset-react', { runtime: 'automatic' }],
          ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
        ],
        plugins: [],
      },
    }),
    restart({
      restart: [
        'src/**/page.jsx',
        'src/**/page.tsx',
        'src/**/layout.jsx',
        'src/**/layout.tsx',
        'src/**/route.js',
        'src/**/route.ts',
      ],
    }),
    consoleToParent(),
    loadFontsFromTailwindSource(),
    addRenderIds(),
    reactRouter(),
    tsconfigPaths(),
    aliases(),
    layoutWrapperPlugin(),
  ],
  resolve: {
    alias: {
      lodash: 'lodash-es',
      'npm:stripe': 'stripe',
      stripe: path.resolve(__dirname, './src/__create/stripe'),
      '@auth/create/react': '@hono/auth-js/react',
      '@auth/create': path.resolve(__dirname, './src/__create/@auth/create'),
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  clearScreen: false,
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: 4001,
    hmr: {
      overlay: false,
    },
    warmup: {
      clientFiles: ['./src/app/**/*', './src/app/root.tsx', './src/app/routes.ts'],
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // Silenciar los avisos molestos de mapas de código fuente virtuales (?noLayout)
        if (warning.code === 'SOURCEMAP_ERROR' || warning.message.includes('sourcemap')) {
          return;
        }
        defaultHandler(warning);
      },
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return;

          // Heavy PDF/canvas libraries — almost never change
          if (
            id.includes('pdfjs-dist') ||
            id.includes('jspdf') ||
            id.includes('html2canvas') ||
            id.includes('canvg') ||
            id.includes('dompurify')
          ) return 'vendor-pdf';

          // Charting library — rarely changes
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
            return 'vendor-charts';
          }

          // Spreadsheet library — rarely changes
          if (id.includes('xlsx') || id.includes('exceljs')) return 'vendor-xlsx';

          // Auth & session — rarely changes
          if (
            id.includes('@hono/auth-js') ||
            id.includes('@auth/core') ||
            id.includes('next-auth')
          ) return 'vendor-auth';

          // Data fetching — rarely changes
          if (id.includes('@tanstack/react-query')) return 'vendor-query';

          // Lucide icons — changes occasionally but heavy
          if (id.includes('lucide-react')) return 'vendor-icons';

          // React core — move to misc to avoid circularity
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('react/')
          ) return 'vendor-misc';

          // Everything else in node_modules
          return 'vendor-misc';
        },
      },
    },
  },
});
