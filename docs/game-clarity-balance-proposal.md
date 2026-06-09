# Game Clarity & Balance — Remediation Proposal (2026-06-09)

Proposal to address the audit of **guided run**, **player-facing information quality**, and
**difficulty/balance**. Findings live in the audit summary; this doc is the *plan to fix them*.

Three guiding principles frame every change below:

1. **Flavor and instruction are separate jobs.** The Warden's voice is an asset — keep it. But
   every lesson/tooltip must also carry one plain, literal, actionable line. Flavor tells you
   *why it matters*; the action line tells you *what to do*. Today many strings only have flavor.
2. **Never write design intent into player copy.** Strings that describe how the UI *should*
   behave ("status copy", "should not clutter the tiles", "hunting for badges") are notes to
   ourselves, not the player. They get rewritten or deleted.
3. **Balance changes are validated, not vibes.** Every numeric change is checked against the
   sim harness before/after. No silent tuning.

The work splits into three phases, sequenced smallest-risk-first. Phases 1 and 2 are pure
UI/copy and can ship independently and quickly. Phase 3 (balance) is gated on harness runs and
on a few design decisions only Alex can make (listed at the end).

---

## Phase 1 — Guided Run (the flagged issue)

**Goal:** the guided run shows only what's relevant to the current step, and stops discarding
the server's own contextual text.

### 1A. Gate the mechanic runes to the current lesson
- **Problem:** `game-ui.tsx:517-520` always appends all five `coreMechanicRunes`
  (Combos/Omens/Purge/Wager/Relics) + `projectedMechanics`, capped at 5 — so a "place your
  first Meadow" beat is buried under boss-wager and relic lectures.
- **Fix:** add a per-step `relevantRunes: string[]` allow-list to each guided step. During the
  guided run, filter `coreMechanics`/`projectedMechanics` to that step's allow-list (empty for
  the earliest beats; widening as the run progresses). Outside the guided run, behavior is
  unchanged.
  - `welcome` / `place-safe`: no runes (or just Combos once a haven is in hand).
  - `prep-threat`: Combos.
  - `build-fork`: Combos + Purge.
  - `rival`: add the rival/bonk context rune.
  - `free-run` onward: full set (player has seen the basics).
- **Risk:** low — additive filter, guarded by `onboarding.enabled`.

### 1B. Stop discarding the server's contextual lesson text
- **Problem:** `game-ui.tsx:439-454` (`onboardingLesson`) prefers the generic `guidedLessons`
  script and ignores `onboarding.title/prompt/detail` whenever a scripted entry exists. The
  server (`rules.mjs:936-1006`) computes *better, tile-specific* prompts — and a fully
  **personalized debrief** (`rules.mjs:941-951`: level, cards played, deaths) that the player
  never sees.
- **Fix (recommended):** invert the precedence — prefer server-provided `title/prompt/detail`
  when present, fall back to the scripted lesson only as a default. The scripted table becomes
  the safety net, not the override.
- **Alternative (if we'd rather keep the curated voice):** keep scripted prose for the *flavor*
  fields but always render the server's `detail`/debrief as the action line, and delete the
  now-dead personalization code in `rules.mjs` so we're not maintaining two sources of truth.
- **Decision needed:** D1 below.
- **Risk:** low-medium — touches what text renders; covered by an e2e guided-run snapshot.

### 1C. Verify
- Extend the guided-run e2e (sim harness) to assert: (a) rune count per early step, (b) debrief
  shows the player's real level/cards/deaths. Screenshot each beat.

**Deliverable:** one commit, "Guided run: scope lessons to the active beat and surface the
server's contextual + debrief copy."

---

## Phase 2 — Player Information Quality

**Goal:** no internal jargon in player copy; every game term is defined somewhere; stats are
self-explaining.

### 2A. Rewrite the design-intent strings (highest priority)
Targeted rewrites, preserving Warden tone but adding a literal action line:

| Location | Replace | Direction |
|---|---|---|
| `game-ui.tsx:417` | "follow the status copy… not clutter the tiles" | "When an omen marks a date, the banner at the top shows exactly what's coming and when." |
| `game-ui.tsx:435`, `:485` | "whisper from narrow triggers… hunting for badges" | "Relics fire on specific combat events. Watch the combat log to see when one triggers." |
| `App.tsx:1208` | "status copy is the truth… crown of badges" | "When an omen appears, read the banner — it spells out the effect and the turn it lands." |
| `App.tsx:1223` | "Watch status copy and the log, not hidden hover text" | "Relics activate mid-fight. The combat log names the one that fired and why." |
| `game-ui.tsx:264` | "two visual steps of lead time" | "Combat tiles must land at least 2 tiles ahead, so you have time to prepare." |

### 2B. Add a glossary + flesh out the Rules panel
- The Rules/Help panel (`game-ui.tsx:~2762`) currently omits omens, corruption, relic
  activation, seals, and armor-vs-HP. Add a concise **Glossary** block defining every term that
  appears in the UI: Omen, Seal, Sabotage, Loot luck, Lap heal, Terrain score, Revive, Purge,
  Wager, Heat, Corruption.
- Keep each definition one sentence, plain language, no flavor.

### 2C. Self-explaining stat labels
- `game-ui.tsx:~1913` shows bare labels ("Draw", "Sabotage", "Loot luck"). Either rename to
  unambiguous labels (Draw → "Card draw speed", Sabotage → "Rival damage", Loot luck → "Loot
  rarity") **or** attach an `InfoPopover` to each. Recommendation: keep short labels, add
  popovers (consistent with the existing hover-pop pattern, no layout churn).

### 2D. Fix terminology drift
- "chunk" (code) vs "seal" (UI) vs "Seal I/II/III" (tile names) all name one concept
  (`game-ui.tsx:479`, `rules.mjs`). Pick **"seal"** as the single player-facing term; leave the
  internal `chunk` variable names alone or rename for consistency in a follow-up.

**Deliverable:** one commit, "Player copy: remove design-intent jargon, add glossary, label
stats clearly." (2D can fold in or be its own tiny commit.)

---

## Phase 3 — Difficulty & Balance (validated, gated on decisions)

**Goal:** tighten the hero power spread and remove the solo difficulty wall, without flattening
the game's intended risk. **Every change measured against the sim harness** (baseline win-rates
first, then re-run after each change).

Ranked by impact:

1. **Solo corruption spiral (biggest difficulty problem).** `rules.mjs:71-73, 2589-2590` — solo
   players eat 0.35–0.45× corruption→threat scaling that multiplayer ignores; failed boss
   attempts compound until Act III is effectively unwinnable for casual players.
   - **Proposed:** lower the solo corruption cap (32 → ~18-20), reduce the scaling coefficient,
     and refund some corruption on a cleared seal so a partial success isn't pure loss.
   - Needs harness confirmation that this doesn't trivialize multiplayer.

2. **Hero power spread.** Rune Archer (56/10/9) dominates; Night Vagrant (36/2) and Grave Singer
   (39/2) get chip-killed before their identities (loot / revive) come online
   (`rules.mjs:426-513`).
   - **Proposed:** small base-stat nudges — Archer down a touch (HP 56→52 *or* power 10→9),
     Vagrant + Grave Singer guard 2→4. Conservative, then iterate on harness win-rates.

3. **Loot-luck weight = 72** in the item scorer (`rules.mjs:3761`) vs power=4 — an early relic
   is a 2-3 level swing, turning runs into an RNG lottery. **Proposed:** halve the weight; cap
   conditional loot drops per N clears.

4. **Dead / cosmetic mechanics.** `drawRate` talents (irrelevant in realtime), the `curse`
   mechanic (+3, auto-clears, never threatening), `revivePower` (only pays out after death,
   capped at 6). **Proposed:** decide per-mechanic — buff into relevance or cut. Lower priority.

**Process:** baseline sim → change one lever → re-sim → compare. No batching multiple balance
levers into one unmeasured commit. Likely 2-4 small commits, each with before/after numbers in
the message.

---

## Open decisions (need Alex)

- **D1 — Guided lesson voice:** when server text and scripted prose disagree, prefer (a) server
  text always [recommended, simpler, surfaces the debrief], or (b) keep scripted *flavor* +
  always append server *action/debrief* line [more curated, more code]?
- **D2 — Stat clarity style:** rename stat labels, or keep short labels + add hover popovers
  [recommended]?
- **D3 — Balance appetite:** do we want a genuine rebalance pass now (Phase 3 in full), or just
  fix the solo-corruption wall (#1) and defer hero/loot tuning? This is the difference between a
  quick fix and a tuning project.
- **D4 — Dead mechanics:** buff `curse`/`drawRate`/`revivePower` into relevance, or cut them?

## Suggested sequencing

1. Phase 1 (guided run) — ship first; it's your flagged issue and it's low-risk.
2. Phase 2 (copy/glossary/labels) — ship next; pure clarity win, no gameplay change.
3. Phase 3 (balance) — only after D3/D4 are settled, validated on the harness.

Phases 1 and 2 together are a focused day of work with no balance risk. Phase 3's size depends
entirely on D3.
