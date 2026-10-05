import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

const waServiceUrl = (process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL || 'http://localhost:3001')
  .trim()
  .replace(/\/+$/, '');

let waSources = [];
try {
  const u = new URL(waServiceUrl);
  const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
  waSources = [u.origin, `${wsProto}//${u.host}`];
} catch {
  // URL invalida: no se agrega nada extra al CSP.
}

const connectSrc = [
  "'self'",
  ...waSources,
  ...(isProd
    ? []
    : ['http://localhost:3001', 'ws://localhost:3001', 'http://127.0.0.1:3001', 'ws://127.0.0.1:3001']),
].join(' ');

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "media-src 'self' data:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src ${connectSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // HSTS solo tiene efecto sobre HTTPS; se emite solo en produccion.
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  // No revelar la version de Next.js en la cabecera `X-Powered-By`.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: "https",
        hostname: "cdn-icons-png.flaticon.com",
        pathname: "/512/**",
      },
    ],
  },
  // Cabeceras de seguridad aplicadas a todas las respuestas.
  // La CSP permite 'unsafe-inline' y 'unsafe-eval' porque Next y Tailwind
  // inyectan estilos y scripts en linea; endurecerla requiere nonces.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
