"use client"; // Error boundaries must be Client Components

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Replaces the root layout when it fails, so it brings its own <html>, <body> and
// inline styles (the global stylesheet is not loaded here).
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#0a0a0b", color: "#ededea", fontFamily: "system-ui, sans-serif" }}>
        <div role="alert" style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Cockpit est momentanément indisponible</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#9a9aa3", margin: "10px 0 20px" }}>
            Une erreur est survenue au chargement de l’application. Tes données ne sont pas touchées. Réessaie dans un instant.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ background: "#5b8cff", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
