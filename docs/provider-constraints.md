# Provider constraints

Verified 2026-11-18 from official documentation:

- GitHub OAuth web flow: authorization endpoint `https://github.com/login/oauth/authorize`; token exchange `https://github.com/login/oauth/access_token`; state is recommended for CSRF; PKCE is supported; API identity check is `GET https://api.github.com/user` with a bearer token.
  Source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- Vercel Sign in with Vercel: authorization endpoint `https://vercel.com/oauth/authorize`; token endpoint `https://api.vercel.com/login/oauth/token`; PKCE S256 is required; supported scopes include `openid`, `email`, `profile`, and `offline_access`; user info endpoint is `https://api.vercel.com/login/oauth/userinfo`.
  Source: https://vercel.com/docs/sign-in-with-vercel/authorization-server-api
- Instagram Content Publishing: requires Instagram professional accounts and the appropriate Meta/Instagram publishing permissions. Media must be publicly hosted when publishing. Reels use a media container and `media_publish`; publishing limits are enforced by the platform.
  Source: https://developers.facebook.com/documentation/instagram-platform/content-publishing
- TikTok Content Posting API: requires a registered app with Content Posting API and Direct Post enabled, approval for `video.publish`, and user authorization. Unaudited clients may be restricted to private viewing. Direct posting uses the TikTok `/v2/post/publish/...` endpoints.
  Source: https://developers.tiktok.com/doc/content-posting-api-get-started
