import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/server/auth";

// RFC 8414 discovery at the site root (the issuer lives under /api/auth), for
// MCP clients such as Claude: /.well-known/oauth-authorization-server[/api/auth].
export const GET = oauthProviderAuthServerMetadata(auth);
