# J.A.R.V.I.S Dashboard Plan

## Product scope

Build a connected-ready React/Next.js-style web dashboard called J.A.R.V.I.S (Just A Rather Very Intelligent System). It is a high-tech command center for orchestrating outreach, content generation, and deployments. The first release uses realistic in-session mock data, but every connection card and workflow is shaped as an adapter boundary for future OAuth/API wiring.

The assistant addresses the operator as **CEO** and behaves conversationally: typed commands are written into the System Terminal as `[USER]` entries, J.A.R.V.I.S then reports `Processing command... Routing to n8n workflow...`, and the orb exposes a dedicated Voice Mode that enters a pulsing listening state. Voice Mode uses the browser Speech Recognition API when available, requests microphone permission, auto-submits the final transcript through the same conversational flow, and reports a clear fallback when the browser does not support speech recognition.

## Implementation approach

- Use the initialized React/Express/tRPC/Vite project and keep the public dashboard client-first so it is responsive and fast in Preview.
- Model the UI around a single dashboard state: terminal logs, pending approvals, connection states, command history, metrics, notification activity, and the selected navigation focus all update from explicit user actions.
- Keep sensitive workflow behavior behind approval gates. Quick actions simulate discovery/execution, then pause at a review state before email sending, publishing, or production deployment.
- Build the Connections Center as a reusable connection registry with provider metadata, current status, and adapter-ready action callbacks. The initial buttons demonstrate the intended authorization surface without embedding provider secrets in the browser.
- Use CSS for the motion system: orbital rings, signal bars, scanline texture, status dots, hover lift, and subtle glow. Voice Mode accelerates the orb aura, activates a microphone pulse, and changes the core label to listening.
- Add `/manus-routes.json` for the single `/` route and preserve the existing server/database scaffolding for later persistence and OAuth callbacks.
- Preserve the starter's Manus OAuth/session implementation as the only authentication system. The dashboard renders a secure sign-in state for logged-out visitors and only mounts private command-center UI after `auth.me` resolves an authenticated user.
- Treat the existing `users` row keyed by Manus `openId` as the multi-user profile boundary. `profile.update` is a protected server mutation that can edit only the current user's display name; email, role, openId, and sign-in timestamps remain server-owned.

## Project structure

- `client/src/pages/Home.tsx` — authenticated dashboard composition, user-scoped profile dialog, mock data, action state, conversational command handling, approval and connection interactions.
- `client/src/index.css` — dark command-center visual system, responsive layout, orbital animation, terminal styles, and component primitives.
- `client/src/App.tsx` — dark-only theme shell and routing.
- `public/manus-routes.json` — published route manifest.
- `server/` and `drizzle/` — retained starter backend/database foundation with Manus OAuth, protected tRPC procedures, and user-scoped profile persistence for future connection records, audit logs, and OAuth callback persistence.

## Design direction

### Chosen style: Cinematic Ops Console

A restrained aerospace control-room interface with hard-edged panels, command telemetry, electric cyan instrumentation, and a calm operator voice.

### Core principles

1. Signal over decoration: every glow communicates state, focus, or system activity.
2. Layered command hierarchy: the orb and composer own attention; terminal and approvals supply context.
3. Trust before execution: visible status, connection states, and approval gates make consequential actions explicit.
4. Conversational feedback: operator intent appears as USER telemetry and assistant routing/response entries appear immediately after it.

### Signature elements

- The J.A.R.V.I.S core: a multi-ring orb with breathing glow, listening waveform bars, and a state label.
- The telemetry rail: timestamped monospace logs with user, system, info, success, wait, and error colors.
- The signal corners: clipped panel corners, tiny section labels, and cyan accent rules that make every surface feel instrumented.

### Interaction philosophy

Interactions should feel like issuing a command to a calm, attentive co-pilot: click or keyboard shortcuts make state changes immediate, typed commands are echoed as USER messages, routing feedback follows in the terminal, and any consequential step pauses for clear approval.

## Future integration seam

Real Gmail, GitHub, Vercel, lead-source, OpenAI, and video-service connectors should enter through provider-specific server routes or tRPC procedures. Connection records, provider account IDs, token references, and audit events belong in the managed database; browser code should only receive safe connection status and callback URLs. Secrets must be requested through protected environment/configuration flows rather than pasted into the UI or chat.
