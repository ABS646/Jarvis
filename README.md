# J.A.R.V.I.S AI Assistant Dashboard

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## Owner-only access

Set `OWNER_OPEN_ID` to the Open ID of the single Manus account that should use this instance. All protected tRPC procedures, including assistant chat, profile, connectors, and administrative routes, fail closed unless the authenticated session matches that value. Keep it in the server environment or project secret store; never put it in client code.

The assistant accepts bounded browser attachments up to 8 MB each, including images, PDFs, text and structured documents, audio, video, and recorded voice notes. The active message sends the file content to the multimodal reasoning adapter; browser chat history persists only the readable text and never stores the large data payload. External actions still require an authorized connection and explicit approval.

## Operating mode and safety

The server recognizes the following environment flags with safe defaults:

```env
OPERATING_MODE=compliant   # compliant | aggressive (aggressive adapters are not implemented)
WA_TRANSPORT=cloud         # cloud | baileys (only official cloud transport is supported)
SCRAPER_MODE=strict        # strict | broad (strict, permitted-source behavior only)
AUTO_SEND=false            # automatic external sending is not available
FOLLOWUP_MAX=3             # safe maximum; unsupported values resolve to 3
CONSENT_ENFORCE=true       # consent and opt-out protections remain enforced
PROXY_POOL=                # empty means direct requests
```

These values are parsed server-side for compatibility and diagnostics. Setting an aggressive value does not activate unofficial WhatsApp automation, proxy rotation or evasion, `robots.txt` bypassing, unauthorized scraping, consent bypass, or automatic outbound messaging. Those capabilities are intentionally not implemented. J.A.R.V.I.S uses approval-gated, authorized integrations and fails closed when a requested adapter is unavailable.

### Going aggressive

There is no supported aggressive mode in this release. Do not add unofficial messaging transports, scraping-evasion logic, credential collection, consent bypasses, or uncontrolled dispatch behind a feature flag. Safe expansion should use official provider APIs, permitted sources, enforced opt-outs, rate limits, audit records, and explicit operator approval.

## API Vault and provider credentials

The Settings → API Vault accepts per-user credentials for:

- `OPENAI_API_KEY`
- `APIFY_API_TOKEN`
- `N8N_API_KEY`
- `N8N_WEBHOOK_URL`

Values are encrypted with AES-256-GCM before they are stored in the database. The API returns only masked values. Set `CONNECTOR_ENCRYPTION_KEY` as a strong, private deployment secret before saving credentials; if it is missing, writes fail closed. Never commit API keys or encryption keys to this repository.

**Adapter status:** OpenAI credentials can currently be stored and removed, but the assistant still uses the application-managed model runtime. Apify and n8n credentials are stored, but their actor/workflow execution adapters are not yet implemented. Saving a key does not mean the provider is connected or operational.

GitHub and Vercel OAuth application credentials are separate server-side deployment secrets: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `VERCEL_CLIENT_ID`, `VERCEL_CLIENT_SECRET`, and `PUBLIC_APP_URL`. Only providers with a complete implemented OAuth and identity flow are reported as configured.
