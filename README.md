# J.A.R.V.I.S AI Assistant Dashboard

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

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
