import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy without nonces: nonces force every page to render per request, which
 * is incompatible with cacheComponents / partial prefetching (see the Next.js CSP guide). The
 * policy therefore keeps 'unsafe-inline' for scripts and styles, and relies on the rest to
 * limit what a successful injection could do: no foreign scripts, no framing, no <object>,
 * and network calls only to Cockpit, Vercel Blob (direct uploads) and Sentry.
 *
 * Set CSP_REPORT_ONLY=1 on Vercel to watch violations in the browser console without blocking
 * anything (useful for the first deploy after a change).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  `connect-src 'self' https://*.blob.vercel-storage.com https://vercel.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite ships WebAssembly + data files that must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    // Pin the workspace root: a lockfile higher up the disk must not be picked as the root.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Source maps are uploaded to Sentry only when SENTRY_AUTH_TOKEN, SENTRY_ORG and
// SENTRY_PROJECT are all set on Vercel; otherwise the build behaves as before.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
});
