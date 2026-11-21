# Vercel deployment

J.A.R.V.I.S uses an Express API and a Vite React frontend. Vercel must build the React output and route `/api/*` requests to the serverless Express entrypoint at `api/index.ts`.

Required Vercel project settings are committed in `vercel.json`:

- Build command: `pnpm build`
- Output directory: `dist/public`
- API function: `api/index.ts`
- API rewrite: `/api/:path*` to `/api/index.ts`
- Frontend fallback: all non-API routes to `/index.html`

For the Vercel-hosted copy, configure the runtime variables in the Vercel project settings, including `PUBLIC_APP_URL` set to the production Vercel URL. GitHub OAuth must use that deployment's callback URL:

`https://YOUR-VERCEL-DOMAIN/api/connect/github/callback`

The managed Manus deployment remains separate and continues to use its own public origin and environment configuration.
