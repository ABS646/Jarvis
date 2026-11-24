import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

export const PROVIDERS = ["github", "vercel", "instagram", "tiktok", "linkedin", "gmail"] as const;
export type Provider = (typeof PROVIDERS)[number];

const providerLabels: Record<Provider, string> = {
  github: "GitHub",
  vercel: "Vercel",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  gmail: "Gmail",
};

const getKey = () => {
  if (!ENV.connectorEncryptionKey) throw new Error("CONNECTOR_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(ENV.connectorEncryptionKey).digest();
};

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted connector secret");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

const publicOrigin = () => ENV.publicAppUrl.replace(/\/$/, "");

export function getConnectorRedirectUri(provider: Provider) {
  if (!publicOrigin()) throw new Error("PUBLIC_APP_URL is required before connecting a provider");
  return `${publicOrigin()}/api/connect/${provider}/callback`;
}

export function getProviderPublicStatus(provider: Provider) {
  // Only providers with a complete authorization and identity adapter may be reported configured.
  const configured = provider === "github"
    ? Boolean(ENV.githubClientId && ENV.githubClientSecret && ENV.publicAppUrl)
    : provider === "vercel"
      ? Boolean(ENV.vercelClientId && ENV.vercelClientSecret && ENV.publicAppUrl)
      : false;
  return { provider, label: providerLabels[provider], configured };
}

function stateSecret() {
  if (!ENV.cookieSecret) throw new Error("MANUS_JWT_SECRET is unavailable");
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createConnectorState(provider: Provider, openId: string, redirectUri: string, codeVerifier: string) {
  return new SignJWT({ provider, openId, redirectUri, codeVerifier })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .setJti(randomBytes(16).toString("hex"))
    .sign(stateSecret());
}

export async function verifyConnectorState(state: string) {
  const { payload } = await jwtVerify(state, stateSecret(), { algorithms: ["HS256"] });
  const provider = payload.provider;
  const openId = payload.openId;
  const redirectUri = payload.redirectUri;
  const codeVerifier = payload.codeVerifier;
  if (!PROVIDERS.includes(provider as Provider) || typeof openId !== "string" || typeof redirectUri !== "string" || typeof codeVerifier !== "string") {
    throw new Error("Invalid connector OAuth state");
  }
  return { provider: provider as Provider, openId, redirectUri, codeVerifier };
}

export function createCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

export function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function getAuthorizationUrl(provider: Provider, state: string, redirectUri: string, codeChallenge: string) {
  if (provider === "github") {
    if (!ENV.githubClientId) throw new Error("GitHub OAuth credentials are not configured");
    const params = new URLSearchParams({ client_id: ENV.githubClientId, redirect_uri: redirectUri, scope: "read:user user:email repo", state, code_challenge: codeChallenge, code_challenge_method: "S256", allow_signup: "false" });
    return `https://github.com/login/oauth/authorize?${params}`;
  }
  if (provider === "vercel") {
    if (!ENV.vercelClientId) throw new Error("Vercel OAuth credentials are not configured");
    const params = new URLSearchParams({ client_id: ENV.vercelClientId, redirect_uri: redirectUri, response_type: "code", response_mode: "query", scope: "openid email profile offline_access", state, code_challenge: codeChallenge, code_challenge_method: "S256" });
    return `https://vercel.com/oauth/authorize?${params}`;
  }
  throw new Error(`${providerLabels[provider]} requires a configured developer OAuth application before it can be connected`);
}

type TokenResult = { accessToken: string; refreshToken?: string; expiresAt?: Date; scopes?: string };

export async function exchangeCode(provider: Provider, code: string, redirectUri: string, codeVerifier: string): Promise<TokenResult> {
  if (provider === "github") {
    const response = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: ENV.githubClientId, client_secret: ENV.githubClientSecret, code, redirect_uri: redirectUri, code_verifier: codeVerifier }) });
    const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number; scope?: string; error?: string };
    if (!response.ok || !data.access_token) throw new Error(data.error || "GitHub token exchange failed");
    return { accessToken: data.access_token, refreshToken: data.refresh_token, scopes: data.scope, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined };
  }
  if (provider === "vercel") {
    const body = new URLSearchParams({ client_id: ENV.vercelClientId, client_secret: ENV.vercelClientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: codeVerifier });
    const response = await fetch("https://api.vercel.com/login/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
    const data = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
    if (!response.ok || !data.access_token) throw new Error(data.error || "Vercel token exchange failed");
    return { accessToken: data.access_token, refreshToken: data.refresh_token, scopes: data.scope, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined };
  }
  throw new Error(`${providerLabels[provider]} token exchange is not enabled yet`);
}

export async function fetchProviderIdentity(provider: Provider, accessToken: string) {
  const url = provider === "github" ? "https://api.github.com/user" : "https://api.vercel.com/login/oauth/userinfo";
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "User-Agent": "JARVIS-Dashboard" } });
  const data = await response.json() as { id?: string | number; login?: string; username?: string; name?: string; email?: string; sub?: string };
  if (!response.ok) throw new Error(`Could not validate ${providerLabels[provider]} identity`);
  return { accountId: String(data.id ?? data.sub ?? data.login ?? data.username ?? "unknown"), accountLabel: data.name || data.login || data.username || data.email || providerLabels[provider], metadata: JSON.stringify({ email: data.email ?? null }) };
}
