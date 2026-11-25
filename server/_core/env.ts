// Platform values are read at use time. See the Webdev service/authentication skills.
export const ENV = {
  get appId() { return process.env.MANUS_PROJECT_ID ?? ""; },
  get supabaseUrl() { return (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\\/$/, ""); },
  get supabasePublishableKey() { return process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ""; },
  get adminEmail() { return process.env.ADMIN_EMAIL ?? "imamudeenmuhammad646@gmail.com"; },
  get cookieSecret() { return process.env.MANUS_JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.MANUS_OAUTH_API_URL ?? ""; },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY ?? ""; },
  get publicAppUrl() { return process.env.PUBLIC_APP_URL ?? ""; },
  get connectorEncryptionKey() { return process.env.CONNECTOR_ENCRYPTION_KEY ?? ""; },
  get githubClientId() { return process.env.GITHUB_CLIENT_ID ?? ""; },
  get githubClientSecret() { return process.env.GITHUB_CLIENT_SECRET ?? ""; },
  get vercelClientId() { return process.env.VERCEL_CLIENT_ID ?? ""; },
  get vercelClientSecret() { return process.env.VERCEL_CLIENT_SECRET ?? ""; },
  get instagramClientId() { return process.env.INSTAGRAM_CLIENT_ID ?? ""; },
  get instagramClientSecret() { return process.env.INSTAGRAM_CLIENT_SECRET ?? ""; },
  get tiktokClientKey() { return process.env.TIKTOK_CLIENT_KEY ?? ""; },
  get tiktokClientSecret() { return process.env.TIKTOK_CLIENT_SECRET ?? ""; },
  // Compatibility flags are intentionally safe by default. Unsupported unsafe adapters
  // remain unavailable even if an aggressive value is supplied at runtime.
  get operatingMode() { return process.env.OPERATING_MODE === "aggressive" ? "aggressive" : "compliant"; },
  get waTransport() { return process.env.WA_TRANSPORT === "baileys" ? "baileys" : "cloud"; },
  get scraperMode() { return process.env.SCRAPER_MODE === "broad" ? "broad" : "strict"; },
  get autoSend() { return process.env.AUTO_SEND === "true"; },
  get followupMax() { return process.env.FOLLOWUP_MAX === "6" ? 6 : 3; },
  get consentEnforce() { return process.env.CONSENT_ENFORCE !== "false"; },
  get proxyPool() { return process.env.PROXY_POOL ?? ""; },
};
