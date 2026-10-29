"use client"; // Error boundaries must be Client Components

import { ErrorPanel } from "@/components/error-panel";

// Inside the app shell: the sidebar and navigation stay usable when a page fails.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} />;
}
