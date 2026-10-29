import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/server/auth";

// OpenID discovery at the site root, mirroring the issuer under /api/auth.
export const GET = oauthProviderOpenIdConfigMetadata(auth);
