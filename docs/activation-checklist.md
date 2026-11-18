# J.A.R.V.I.S activation checklist

## Already implemented

- Manus OAuth authentication and per-user profiles.
- Managed server-side reasoning with a task-oriented J.A.R.V.I.S prompt.
- Durable connector records with encrypted OAuth tokens.
- Five-minute Heartbeat worker for background connector jobs.
- Task Forge with visible task stages and approval-gated preparation.
- Browser image/file staging, voice-note recording, and hands-free voice-call mode.
- Browser SpeechSynthesis replies using an original regal anime-inspired profile.

## Required before full production multimodal operation

1. **Storage and media index:** configure the managed storage presign service and add an application media table so uploaded images/audio/documents can be persisted per user. The current UI stages files in the browser and sends filenames as evidence metadata; it does not claim that the model has viewed or transcribed the binary yet.
2. **Vision and speech processing:** route stored image URLs through the managed multimodal LLM request and route voice-note blobs through the managed Speech transcription API. Keep signed download URLs server-side and scoped to the request.
3. **OAuth connectors:** configure provider credentials and callback origin `https://jarvisdash-yqasfxkt.manus.space`. GitHub and Vercel can then use the existing PKCE callbacks. Instagram/TikTok/LinkedIn/Gmail require their own developer apps, scopes, review, and account authorization.
4. **Background work:** keep the existing `jarvis-background-worker` Heartbeat active every five minutes. Add media-transcription and queued build jobs only after their database records and idempotency rules are defined.
5. **GitHub:** enable the Manus GitHub connector, choose the destination repository, then push the canonical project branch through the connector. Do not paste a personal token into the dashboard or chat.
6. **Vercel:** provide a Vercel project/team target and deployment authorization, configure production environment variables server-side, and verify the health endpoint after deployment. Do not expose provider secrets in frontend code.

## Autonomy boundary

J.A.R.V.I.S may continuously plan, draft, test, and prepare work in the authorized project. It must pause for approval before repository writes, permission changes, infrastructure changes, external messages, publishing, production deployment, spending, or destructive operations. It cannot safely authenticate itself with passwords, OTPs, private keys, or hidden credentials.
