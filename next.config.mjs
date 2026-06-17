import path from 'node:path'
import { fileURLToPath } from 'node:url'

const isDev = process.env.NODE_ENV !== 'production'
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
// Optimizado para Vercel: Next.js App Router + Edge API routes + middleware
const config = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,

  /** Misma URL canónica que Supabase Redirect URLs (evita fallos PKCE www vs apex). */
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/favicon.png',
        permanent: false,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'runlabs42.com' }],
        destination: 'https://www.runlabs42.com/:path*',
        permanent: true,
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '54321',
      },
    ],
  },

  headers: async () => [
    {
      source: '/visual-edit/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        {
          key: 'Content-Security-Policy',
          value:
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'; base-uri 'self'",
        },
      ],
    },
    {
      source: '/api/mcp',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, Mcp-Session-Id' },
      ],
    },
    {
      source: '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value:
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://*.vercel-insights.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: http://127.0.0.1:54321 http://localhost:54321; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321 http://localhost:54321 ws://localhost:54321 https://api.stripe.com https://*.sentry.io https://vitals.vercel-insights.com; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
        },
      ],
    },
  ],

  experimental: {
    // Menos workers en dev → menos carreras con static-paths-worker y vendor-chunks.
    ...(isDev ? { workerThreads: false, cpus: 1 } : {}),
    // En dev, externalizar Supabase vía optimizePackageImports provoca vendor-chunks rotos tras HMR.
    optimizePackageImports: isDev
      ? ['lucide-react']
      : ['@supabase/supabase-js', 'lucide-react'],
    // esbuild es un binario nativo: requerirlo en runtime, no empaquetarlo.
    serverComponentsExternalPackages: [
      'esbuild',
      'tailwindcss',
      'postcss',
      'autoprefixer',
    ],
  },

  webpack: (config, { dev, isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/lib/design/designImageRequests': path.join(
          projectRoot,
          'src/lib/design/designImageRequests.stub.ts',
        ),
      }
    }
    if (dev) {
      config.cache = false
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 400,
      }
      // Evita vendor-chunks/async chunks rotos en dev (p. ej. __webpack_require__.C is not a function
      // al cargar /api/projects/[id]/files tras recompilar rutas de diseño).
      if (isServer) {
        config.parallelism = 1
        config.optimization = {
          ...config.optimization,
          splitChunks: false,
          runtimeChunk: false,
        }
      }
    }
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /@opentelemetry/ },
      { module: /require-in-the-middle/ },
      { module: /file-type/ },
    ]
    // Evita avisos PackFileCacheStrategy por CSS/i18n grandes (strings >100kiB en caché).
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: 'error',
    }
    if (
      !dev &&
      config.cache &&
      typeof config.cache === 'object' &&
      config.cache.type === 'filesystem'
    ) {
      config.cache.compression = 'gzip'
    }
    return config
  },
}

export default config
