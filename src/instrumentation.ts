import * as Sentry from "@sentry/nextjs";

// Loads the Sentry configuration of the runtime that is starting. Without
// NEXT_PUBLIC_SENTRY_DSN, Sentry stays disabled and nothing is sent.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}

// Reports errors thrown by Server Components, route handlers and server actions.
export const onRequestError = Sentry.captureRequestError;
