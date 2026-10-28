import type { MetadataRoute } from "next";

// Installable shell with a share target: "Share → Cockpit" posts to /partager.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cockpit",
    short_name: "Cockpit",
    description: "Ton centre de contrôle : projets, appels, conseils, tâches et progression.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    share_target: {
      action: "/partager",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "files", accept: ["image/*", "audio/*", "video/*", "application/pdf", "text/*"] }],
      },
    },
  };
}
