# J.A.R.V.I.S Dashboard TODO

## Deliver the command-center shell

- [x] The dashboard is a futuristic, dark-themed AI Assistant Dashboard called “J.A.R.V.I.S” (Just A Rather Very Intelligent System).
- [x] It presents a high-tech command center inspired by Iron Man with dark mode, glowing blue/cyan accents, glassmorphism UI, sleek animations, and a modern technology-focused font.
- [x] The top bar shows a glowing J.A.R.V.I.S logo, current time and date, and a green-dot “System Status: Online” indicator.
- [x] The layout is responsive across desktop and mobile widths.

## Deliver the listening command interface

- [x] The main center contains a large animated AI orb/voice waveform that looks like it is listening.
- [x] The command composer says “Type a command or speak...”, includes a microphone control, and includes a Send button.
- [x] The microphone control visibly changes the orb/listening state.
- [x] A clearly labeled Voice Mode button sits beside the command field and activates a pulsing listening state.
- [x] Voice Mode requests browser microphone access, transcribes speech when Speech Recognition is available, auto-submits the final transcript, and reports a fallback when unsupported.
- [x] Keyboard shortcuts include `/` or `⌘/Ctrl K` to focus the command field and Enter to submit.

## Deliver the terminal and workflow simulation

- [x] A scrolling System Terminal is seeded with `[SYSTEM] Initializing lead scraper...`, `[INFO] 5 new potential clients found on LinkedIn.`, `[SUCCESS] Cold email sent to Riyadh gift shop.`, and `[WAIT] Awaiting user approval for automated video upload.`
- [x] Three clickable Quick Actions are present: Start Outreach (“Scrape leads & send emails”), Generate Video (“Auto-create and post content”), and Deploy Project (“Push to GitHub & Vercel”).
- [x] Clicking a Quick Action appends simulated terminal updates including “Executing command...”.
- [x] Command history, metrics, system health, activity notifications, and status treatments are visible in the dashboard.
- [x] Submitted commands appear in the System Terminal as `[USER]` messages, followed by `Processing command... Routing to n8n workflow...` and a simulated workflow response.
- [x] The dashboard addresses the operator as “CEO” and presents a conversational interaction loop rather than only static page content.

## Deliver connected-ready controls

- [x] A Connections Center exposes Gmail, GitHub, Vercel, LinkedIn/lead sources, OpenAI, and video-service cards.
- [x] Each connection card has a visible connection state and an in-dashboard connect/disconnect interaction using adapter-ready provider metadata.
- [x] The UI makes future OAuth/API wiring explicit without exposing secrets in browser code.
- [x] Approval gates pause simulated email sending, video publishing, and project deployment until the user explicitly approves or rejects the pending action.
- [x] Connection changes and approvals feed the terminal and activity notification stream.

## Prepare the project for delivery

- [x] TypeScript diagnostics are registered for the project.
- [x] The public route manifest contains the `/` page.
- [x] Manus OAuth gates the dashboard with a real loading state, sign-in screen, and authenticated session.
- [x] The top-right operator avatar opens a user-scoped profile surface with editable display name, read-only email/role/account metadata, and sign out.
- [x] Profile updates use a protected tRPC mutation scoped to the authenticated user's `openId`; role, email, and session fields cannot be edited from the UI.
- [x] Run typecheck/build checks and resolve any actionable issues.
- [x] Authenticated commands route through the protected managed LLM reasoning core with a tactical J.A.R.V.I.S personality and bounded conversation context.
- [x] Assistant replies are written to the terminal and spoken through browser SpeechSynthesis when supported; external side effects remain approval-gated.
- [ ] Commit and push the completed change to the canonical `origin/main` checkpoint.
