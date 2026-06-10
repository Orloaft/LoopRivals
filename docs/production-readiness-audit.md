# Production-Readiness Audit (2026-06-10)

Four-dimension audit (server robustness/security, client resilience, ops/deployment,
product completeness) run after the frame-consistency work landed. Findings below are
synthesized from code-level review; each item cites where to look. Severity is "for a
public deployment with strangers" — the game already works great for friends-and-family.

**Overall verdict: the game itself is in strong shape** — core loop, multiplayer sync,
spectator mode, bot fill, reconnect tokens, onboarding coach, 5 heroes / 26 terrain /
56 talents / 41 items / 30+ enemies, excellent test gates (verify chain incl. balance
sim, ws-load, motion, jank). What's missing is mostly the **trust boundary and ops
shell** around it.

## Tier 1 — fix before any public URL (correctness & safety, ~1–2 days total)

1. **Player identity is client-supplied (session hijack).** `server/index.mjs:518`:
   `playerId = String(playerToken || crypto.randomUUID())` — a client that learns or
   guesses another player's token (or replays one from broadcast state) can act as
   them. Fix: server issues the token, never accepts an unknown one as a new identity;
   reject join when the claimed player already has a live socket.
2. **No crash containment.** Socket handlers (`index.mjs:372-386`) are not wrapped in
   try/catch and there are no `process.on('uncaughtException'/'unhandledRejection')`
   handlers — one thrown error in game logic can take down every room with no log.
   Fix: wrap the action dispatcher, add process handlers that force-flush persistence
   then exit, wrap the simulation/cleanup `setInterval` callbacks.
3. **Input validation pass on socket payloads.** `tileIndex`, `heroId`, `cardId`,
   `targetId`, `offerId` flow into game logic with only incidental truthy checks
   (`index.mjs:636-668`, `rules.mjs:1687`, `1862+`). Most invalid values fail safe
   today, but that's luck, not policy. Fix: explicit integer-bounds + whitelist
   validation at the handler boundary; explicit `maxHttpBufferSize` on the socket.io
   server.
4. **Unbounded room creation.** `getRoom()` auto-creates on any join/spectate id
   (`index.mjs:154-165`); cleanup only reaps idle rooms after 30 min. Fix: cap total
   rooms (return "server full"), faster reaping of never-started rooms.
5. **No React error boundary** (`src/main.tsx`) — any render crash = blank page.
   Fix: boundary with "reload" CTA (~2h).
6. **No client/server version handshake.** A stale bundle after redeploy talks a
   potentially incompatible protocol silently. Server already exposes build SHA on
   `/healthz`; include it in the `config` event and have the client prompt a refresh
   on mismatch (~half day).
7. **No Dockerfile / deploy config.** CI verify exists (`.github/workflows/verify.yml`)
   but there is no deployable artifact. Fix: Dockerfile + .dockerignore (+ fly.toml or
   equivalent for the chosen host), persistence path documented as a mounted volume
   (~half day).

## Tier 2 — launch polish (the "feels finished" items)

- **Guided-run text precedence** (`src/game-ui.tsx:463-472`): client scripted lessons
  override the better server-contextual prompts/debrief. Invert precedence (2–4h;
  already specced as Phase 1 in docs/game-clarity-balance-proposal.md).
- **Music.** SFX layer is complete (procedural, mute pref); there is no music at all.
  For this genre that reads as unfinished. Loop-friendly exploration + combat tracks
  behind the existing audio pref (1–2 days incl. sourcing).
- **Touch drag verification.** Card/relic drag uses HTML5 drag events
  (`src/App.tsx:498-536`) which are unreliable on touch browsers — needs a real-device
  pass and likely a pointer-events fallback. Mobile layout/components otherwise exist.
- **Security headers + HTTP hardening**: CSP, X-Frame-Options, HTTPS-only origins
  check in prod CORS, express rate limit on HTTP routes.
- **Observability floor**: log socket connect/disconnect/room lifecycle events,
  `/metrics` (rooms, sockets, rate-limit hits), client error reporting endpoint.
  `/healthz` exists and is good.
- **Compat check**: `color-mix()` and `:has()` usage excludes ~2023-era browsers.
  Decide a support floor; if iOS 15/16 matters, replace the `:has()` usages with
  data-attributes and add color fallbacks. (Verify actual support cutoffs before
  spending here.)

## Tier 3 — post-launch (explicitly fine to defer)

- Horizontal scaling (socket.io Redis adapter / sticky sessions) — README already
  documents single-process; one process handles the realistic launch load (ws-load
  gate proves headroom).
- Balance tuning Phase 3 (solo corruption spiral, hero power spread) — gated on
  balance-sim validation, specced in game-clarity-balance-proposal.md.
- Ability medallion / shop art / combat timing redesign
  (docs/proposals/combat-shop-art-ability-ui.md).
- Stat-label glossary (Phase 2 of the clarity proposal), colorblind pass on HP bars,
  npm audit + CodeQL in CI, persistence snapshots/backups.

## Suggested order

Tier 1 is one focused hardening session (items 1–4 are one server PR, 5–6 one client
PR, 7 one ops PR). Then Tier 2's lesson-text fix and touch-drag pass, then music.
Everything in Tier 3 can trail a soft launch.
