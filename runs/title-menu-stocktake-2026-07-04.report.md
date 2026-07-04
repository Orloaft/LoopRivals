# LoopDuel Title/Menu Stocktake - 2026-07-04

## Status

Complete. Read-only audit performed against the normal runtime app at pinned HEAD `3db0d7c`.

## Repo Context

- Repo: `/mnt/nxt-dev/loopduel`
- Pinned HEAD: `3db0d7c`
- Scope: title page/menu implementation, styling, assets, copy, live desktop/mobile runtime captures.
- Source edits/staging/commit: none. Only this requested report was written.

## Runtime Setup

- Dev server: `PORT=5200 LOOPDUEL_VITE_HMR_PORT=6200 npm run dev`
- URL/route: `http://127.0.0.1:5200/`
- Desktop viewport: `1440x960`
- Mobile viewport: `390x844`, Playwright mobile/touch context
- Flow captured:
  - First-load front title menu at `/`
  - Click `Enter the Loop` for join/hero-selection title surface
  - Join a local room and open the real room/settings menu
- Menu capture setup note: `localStorage.loopduel.tutorialSeen=yes` was pre-seeded before page initialization so the first-run tutorial overlay would not block the room menu. A first attempt without that setup confirmed the tutorial overlay intercepts the desktop settings/menu button after joining.

## Screenshots

- [desktop-1440x960-01-front-title.png](../.openclaw-artifacts/title-menu-stocktake-2026-07-04/desktop-1440x960-01-front-title.png)
- [desktop-1440x960-02-join-title.png](../.openclaw-artifacts/title-menu-stocktake-2026-07-04/desktop-1440x960-02-join-title.png)
- [desktop-1440x960-03-room-menu.png](../.openclaw-artifacts/title-menu-stocktake-2026-07-04/desktop-1440x960-03-room-menu.png)
- [mobile-390x844-01-front-title.png](../.openclaw-artifacts/title-menu-stocktake-2026-07-04/mobile-390x844-01-front-title.png)
- [mobile-390x844-02-join-title.png](../.openclaw-artifacts/title-menu-stocktake-2026-07-04/mobile-390x844-02-join-title.png)
- [mobile-390x844-03-room-menu.png](../.openclaw-artifacts/title-menu-stocktake-2026-07-04/mobile-390x844-03-room-menu.png)
- [playwright-observations.json](../.openclaw-artifacts/title-menu-stocktake-2026-07-04/playwright-observations.json)

## Implementation Notes

- Initial title gate is controlled by `showTitle`; normal `/` first load shows the front title unless `?room=` or `?skiptitle=1` is present (`src/App.tsx:257`).
- Front title copy/menu is in `src/App.tsx:886`, with four menu actions: `Enter the Loop`, `Guided Duel`, `Spectate`, `Rules`.
- Join/hero-selection title surface is in `src/App.tsx:931`, including handle/room fields, `Enter`, `Guided Duel`, `Watch`, `Invite`, `Rules`, profile stats, and five hero cards.
- Desktop room menu is the full `GameMenu` in `src/game-ui.tsx:952`, with room settings, QR/profile, roster, music/SFX/screen-shake/render-quality, rules, and reset.
- Mobile drawer menu is a reduced grid in `src/game-ui.tsx:1713`, exposing room menu entry, add/fill/start, pace toggle, profile summary, and BGM only.
- The front title styling is intentionally traditional RPG: centered wordmark over painterly stage, vertical menu, blinking press hint (`src/styles.css:413`).

## Objective Bugs / Regressions

- Mobile join/hero-selection page exceeds the first viewport (`scrollH 909` vs `innerH 844`). This is not fatal, but the first hero card is partly below the fold and the horizontal hero selector has no visible scroll cue.
- Mobile quick menu is materially less complete than desktop: no visible seats/score settings, no SFX, no screen shake, no render quality, no rules, no reset, and the pace control is just the raw value `steady`. The full room menu is reachable via `Room Menu`, but the immediate mobile menu does not communicate that it is a shortcut panel.
- First-time players who join a room hit the tutorial overlay before the room menu can be opened. That is a reasonable onboarding choice, but it does mean room/settings access is gated until `Close` or `Continue`.
- Desktop room menu is feature-complete but tall. On `1440x960`, lower controls begin below the captured first view, so important toggles feel buried compared with the title's polish.

## Production-Readiness Verdict

Strong beta/near-production title impression, not quite production-polished across the whole title-to-menu flow.

- First impression is strong: the painterly background, huge serif wordmark, gold-on-black UI plaques, and menu rhythm clearly read as dark fantasy indie RPG.
- Hierarchy is solid on the first-load title screen. `Loop Rivals` and `Enter the Loop` are unmistakable, and the secondary actions are understandable.
- The title-to-join flow becomes denser and more utility-like. It remains attractive, but the second title screen feels closer to a lobby setup form than a main-menu experience.
- Readability is generally good, especially desktop. Mobile title readability is good, but the join page is cramped and relies on scrolling.
- The desktop room menu has the expected production controls. The mobile shortcut menu feels under-specified and less premium.
- Audio/settings/start flow exists, but music is only surfaced after entering a room; the front title has no audio/settings affordance.

## Subjective Art-Direction Notes

- The title art and UI frames already carry dark fantasy well: moon, ruined road loop, fortress, graveyard, thorny silhouettes, muted blood/gold accents.
- The name `Loop Rivals` reads more competitive/arcade than dark fantasy RPG. It is clear, but it does not carry the same mythic weight as the art and copy.
- `Retro gothic loop combat` is accurate but slightly mechanical. It explains genre, not mood.
- The first title is tasteful, but it could use one sharper bit of diegetic flavor: a subtitle, sigil, animated ember/candle detail, or short menu sting.
- The join screen's QR/profile/action rail is useful but pulls the mood toward web-app lobby. It would feel more RPG if the handle/room setup were framed as a pact, gate, or character selection ritual without hiding the controls.

## Improvement Ideas

- Add a small front-title settings/audio glyph row: Music, SFX, reduced motion/render quality. Keep it secondary and icon-led.
- Rename or supplement the kicker with mood-first copy, for example `A cursed road repeats` or `Pactbound loop tactics`, while keeping the current genre line elsewhere if needed.
- Add a subtle live treatment to the title: slow parallax drift, candle flicker, pulsing Tyrant eye, or one looping ambient audio cue gated behind the first interaction.
- Make mobile join page tighter: reduce hero showcase height, collapse stats, or show only one selected hero card plus a clear horizontal carousel affordance.
- Promote the mobile menu's `Room Menu` as `Full Settings` or split quick controls from full settings so players know where rules/reset/SFX/render quality live.
- Consider a "Continue / New Run / Settings / Codex" front-menu language pass if the target is solo-RPG first impression rather than multiplayer room-first.

## Verification Performed

- `git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD` -> `3db0d7c`
- `pwd` and `git rev-parse --show-toplevel` both resolved to `/mnt/nxt-dev/loopduel`
- Read repo instructions: `AGENTS.md`, `CLAUDE.md`
- Inspected `src/App.tsx`, `src/game-ui.tsx`, `src/styles.css`, `package.json`, `server/index.mjs`
- Started dev server on allowed port `5200`
- Captured Playwright screenshots on desktop and mobile of normal runtime surfaces
- Playwright capture reported no page errors or console errors

## Cleanup

- Dev server started on port `5200`.
- Dev server stopped with `Ctrl-C`.
- Post-cleanup check: no listener remains on `:5200`.

## Caveats

- This was visual/runtime stocktaking, not a full accessibility or cross-browser test.
- The mobile room menu capture used `loopduel.tutorialSeen=yes` to reach the menu directly; first-run tutorial gating was separately observed.
- No source files were changed, so all suggested fixes are intentionally scoped as follow-up ideas.

## Suggested Next Worker Prompt

Production-polish LoopDuel's title-to-menu flow without a full redesign. Keep the existing painterly dark fantasy direction, but improve mobile join-page fit, make the mobile menu/full-settings relationship clear, and add a small front-title audio/settings affordance. Capture before/after desktop and mobile screenshots of `/`, the join/hero-selection title surface, and the room menu.
