import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { encryptSecret, exchangeCode, fetchProviderIdentity, PROVIDERS, verifyConnectorState, type Provider } from "../connectors";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: the nonce in `state` must match the one-time cookie that
    // startLogin set in the browser that began this login. An attacker can
    // forge `state`, but cannot plant this cookie in the victim's browser.
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/connect/:provider/callback", async (req: Request, res: Response) => {
    const provider = req.params.provider as Provider;
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const error = getQueryParam(req, "error");
    if (!PROVIDERS.includes(provider)) {
      res.status(404).send("Unknown connector");
      return;
    }
    if (error) {
      res.redirect(302, `/?connection=${encodeURIComponent(provider)}&status=denied`);
      return;
    }
    if (!code || !state) {
      res.status(400).send("Connector OAuth code and state are required");
      return;
    }
    try {
      const connectorState = await verifyConnectorState(state);
      if (connectorState.provider !== provider) throw new Error("Connector state provider mismatch");
      const token = await exchangeCode(provider, code, connectorState.redirectUri, connectorState.codeVerifier);
      const identity = await fetchProviderIdentity(provider, token.accessToken);
      const user = await db.getUserByOpenId(connectorState.openId);
      if (!user) throw new Error("Authenticated J.A.R.V.I.S user not found");
      await db.upsertServiceConnection({
        userId: user.id,
        provider,
        status: "connected",
        accountId: identity.accountId,
        accountLabel: identity.accountLabel,
        scopes: token.scopes ?? null,
        encryptedAccessToken: encryptSecret(token.accessToken),
        encryptedRefreshToken: token.refreshToken ? encryptSecret(token.refreshToken) : null,
        expiresAt: token.expiresAt ?? null,
        metadata: identity.metadata,
        lastUsedAt: new Date(),
      });
      res.redirect(302, `/?connection=${encodeURIComponent(provider)}&status=connected`);
    } catch (callbackError) {
      console.error(`[Connector OAuth] ${provider} callback failed`, callbackError instanceof Error ? callbackError.message : "unknown error");
      res.redirect(302, `/?connection=${encodeURIComponent(provider)}&status=error`);
    }
  });
}
