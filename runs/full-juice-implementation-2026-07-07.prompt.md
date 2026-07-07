# Worker Prompt: Full Juice Implementation 2026-07-07

Before any work, run
`git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and
report MOUNT_DOWN — do not improvise alternate paths, do not write anywhere
else.

You are the single commit-capable implementation owner for LoopDuel's full
juice proposal pass. Repo pin: `/mnt/nxt-dev/loopduel`. Expected starting HEAD:
`7eda46d`.

Read these local reports first:

- `/mnt/nxt-dev/loopduel/runs/juice-proposal-synthesis-2026-07-07.report.md`
- `/mnt/nxt-dev/loopduel/runs/juice-code-audit-2026-07-07.report.md`
- `/mnt/nxt-dev/loopduel/runs/juice-runtime-ux-audit-2026-07-07.report.md`
- `/mnt/nxt-dev/loopduel/docs/juice-toolkit.md`

Create an early report stub before long implementation or screenshot loops:
`/mnt/nxt-dev/loopduel/runs/full-juice-implementation-2026-07-07.report.md`.

Implement the full ranked proposal from the manager summary:

1. Tile placement stamp/ripple: successful terrain placement should make the
   target tile visibly confirm the card action with a one-shot stamp/ring,
   keyed to the placement command so it does not replay on initial board mount
   or every server delta.
2. Tile arrival plus lap-completion pulse/sweep: runner movement should gain
   cheap tile-arrival feedback and a lap milestone board/route pulse. Do not
   add per-frame React state to the movement hot path.
3. Rarity-aware loot/relic pickup burst: detect newly added `player.loot`
   items and show capped reward feedback. Common loot gets a small item toss,
   rare loot gets a stronger pickup pop, relic loot gets a short `RELIC`
   plaque plus item pop. Reuse existing item/loot idioms where practical.
4. Combat hit/result/seal impact pass: strengthen combat beat impacts,
   result/reward/defeat readability, and boss seal break pips using existing
   combat overlay timing/classes where possible. If a true boss encounter is
   not practical in the bounded proof run, still implement the boss-seal UI
   state safely and state exactly what runtime proof was not reachable.
5. Multiplayer attack/response lines plus rival chip pulses: remote/rival
   actions should briefly connect attacker/victim surfaces and pulse affected
   rival chips without clutter. Mobile should use constrained chip/panel-safe
   feedback rather than layout-shifting motion.

Performance and safety constraints:

- Preserve the cheap-animation rules from `docs/juice-toolkit.md`: transform,
  scale, rotate, and opacity only for keyframes; no animated filters, blur,
  box-shadow, width, left/top, margin, or background-size/position unless an
  existing documented exception is being reused without expanding its risk.
- No new animation libraries and no broad feedback bus unless absolutely
  needed. Prefer local helpers that match existing code patterns.
- All spawned DOM effects must be capped/merged/removed. Avoid unbounded
  particles. Keep mobile layout stable.
- Respect `prefers-reduced-motion`, existing user motion/shake preferences,
  and `quality-low`. Decoration can disappear; gameplay information must
  still read.
- You are not alone in the codebase. Preserve unrelated user/worker edits,
  classify any pre-existing dirt, and do not revert changes you did not make.
- Allowed dev/smoke server ports: 5200-5219 only. If a port is busy, pick
  another in range; never kill processes outside that range.
- Stage files by explicit path only. `git add -A`, `git add .`, and
  `git commit -a` are forbidden. Before committing, run `git status --short`
  and confirm every staged path belongs to your assigned stage.

Verification:

- Run `npm run lint`.
- Run `npm run test`.
- Run `npm run build`.
- Run `npm run test:motion`.
- Run `npm run test:jank`.
- Capture live Playwright proof on both desktop and mobile normal gameplay
  surfaces. Write artifacts under
  `/mnt/nxt-dev/loopduel/.openclaw-artifacts/full-juice-implementation-2026-07-07/`.
  Cover placement, movement/lap feedback, reward pickup, combat/result
  feedback, and multiplayer/rival feedback. Include reduced-motion and
  quality-low observations/screenshots where practical.
- Report any command that cannot complete with the exact command, failure, and
  whether it is a pre-existing issue or caused by this implementation.
- Confirm temp server cleanup and final repo/server status, including whether
  ports 5200-5219 are clean.

Commit:

- Commit the implementation and report with an appropriate message after
  verification. Use explicit-path staging only. Do not push.

Return block:

- Status
- Commit hash
- Changed files
- Report path
- Proof artifact paths
- Verification output summary
- Temp server cleanup and final repo/server status
- Caveats/blockers, especially any proposal item not fully implemented or any
  runtime proof that was unreachable

