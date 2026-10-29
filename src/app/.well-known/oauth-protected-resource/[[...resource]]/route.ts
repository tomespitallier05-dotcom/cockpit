import { auth } from "@/server/auth";

// RFC 9728 protected resource metadata for the Cockpit connector (/api/mcp).
// The MCP plugin answers it from Better Auth's request hook, keyed on this path.
export function GET(request: Request) {
  return auth.handler(request);
}
