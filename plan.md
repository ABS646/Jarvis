# J.A.R.V.I.S Dashboard Plan

## Product scope

Build a connected-ready React/Next.js-style web dashboard called J.A.R.V.I.S (Just A Rather Very Intelligent System). It is a high-tech command center for orchestrating outreach, content generation, and deployments. The first release uses realistic in-session mock data, but every connection card and workflow is shaped as an adapter boundary for future OAuth/API wiring.

## Implementation approach

- Use the initialized React/Express/tRPC/Vite project and keep the public dashboard client-first so it is responsive and fast in Preview.
- Model the UI around a single dashboard state: terminal logs, pending approvals, connection states, command history, metrics, notification activity, and the selected navigation focus all update from explicit user actions.
- Keep sensitive workflow behavior behind approval gates. Quick actions simulate discovery/execution, then pause at a review state before email sending, publishing, or production deployment.
- Build the Connections Center as a reusable connection registry with provider metadata, current status, and adapter-ready action callbacks. The initial buttons demonstrate the intended authorization surface without embedding provider secrets in the browser.
- Use CSS for the motion system: orbital rings, signal bars, scanline texture, status dots, hover lift, and subtle glow. Avoid decorative imagery so the terminal, orb, and operational data stay legible.
- Add `/manus-routes.json` for the single `/` route and preserve the existing server/database scaffolding for later persistence and OAuth callbacks.

## Project structure

- `client/src/pages/Home.tsx` — dashboard composition, mock data, action state, command handling, approval and connection interactions.
- `client/src/index.css` — dark command-center visual system, responsive layout, orbital animation, terminal styles, and component primitives.
- `client/src/App.tsx` — dark-only theme shell and routing.
- `public/manus-routes.json` — published route manifest.
- `server/` and `drizzle/` — retained starter backend/database foundation for future user-scoped connection records, audit logs, and OAuth callback persistence.

## Design direction

### Candidate styles

- **Cinematic Ops Console** — 0.06: a restrained aerospace control-room interface with hard-edged panels, command telemetry, and electric cyan instrumentation.
- **Liquid Glass AI Lab** — 0.07: a softer floating-glass interface with luminous gradients and ambient color blooms.
- **Neon Hacker Terminal** — 0.08: a dense green/cyan terminal-first interface with expressive monospace typography.

Chosen: **Cinematic Ops Console**.

### Design movement

Cinematic aerospace operations UI: the dashboard should feel like a calm, premium mission-control surface rather than a game HUD.

### Core principles

1. **Signal over decoration:** every glow communicates state, focus, or system activity.
2. **Layered command hierarchy:** the orb and composer own attention; terminal and approvals supply context.
3. **Trust before execution:** visible status, connection states, and approval gates make consequential actions explicit.
4. **Quiet density:** compact metadata and monospace telemetry create richness without visual clutter.

### Color philosophy

The palette uses near-black navy as the cockpit substrate, cyan as the J.A.R.V.I.S signature signal, electric blue for active execution, green for confirmed system health, and amber for human review. Panels are translucent navy glass with thin blue-gray borders so the screen feels illuminated from within.

### Layout paradigm

A left command rail anchors navigation while the main workspace uses an asymmetric hero split: a large orb/composer bay on the left and a scrolling terminal on the right. Operational modules continue below as wide rail-like panels rather than a generic centered card grid.

### Signature elements

- The **J.A.R.V.I.S core**: a multi-ring orb with breathing glow, listening waveform bars, and a state label.
- The **telemetry rail**: timestamped monospace logs with kind-specific colors and scanline texture.
- The **signal corners**: clipped panel corners, tiny section labels, and cyan accent rules that make every surface feel instrumented.

### Interaction philosophy

Interactions should feel like issuing a command to a calm co-pilot: click or keyboard shortcuts make state changes immediate, terminal feedback appears within the same visual surface, and any consequential step pauses for clear approval.

### Animation

Use slow orbital rotation and breathing on idle, faster pulse when listening or executing, short slide/fade for new logs, and 150–220ms hover transitions. Keep motion continuous but low amplitude so the page feels alive without becoming distracting.

### Typography system

Use Space Grotesk for display/navigation text and IBM Plex Mono for terminal logs, labels, timestamps, and keyboard hints. Headings are compact and letter-spaced; body copy is short, factual, and operational.

### Brand essence

A composed AI operations layer for moving from intent to approved execution. Personality: precise, vigilant, composed.

### Brand voice

Microcopy is concise and mission-oriented: “Ready for instruction.” and “Execution paused — operator approval required.”

### Wordmark and logo

Render the wordmark as `J.A.R.V.I.S` beside a small four-point cyan core mark with a horizontal signal slash; the mark should read as a system identity, not a generic robot icon.

### Signature brand color

**Arc Cyan** `#59E7FF` — a crisp icy cyan reserved for the orb, active focus, and primary calls to action.

## Future integration seam

Real Gmail, GitHub, Vercel, lead-source, OpenAI, and video-service connectors should enter through provider-specific server routes or tRPC procedures. Connection records, provider account IDs, token references, and audit events belong in the managed database; browser code should only receive safe connection status and callback URLs. Secrets must be requested through protected environment/configuration flows rather than pasted into the UI or chat.
