Before any work, run
`git -C /mnt/nxt-dev/loopduel rev-parse --short HEAD`. If it fails, STOP and
report MOUNT_DOWN — do not improvise alternate paths, do not write anywhere
else.

You are working only in `/mnt/nxt-dev/loopduel`.

Goal: update the LoopDuel front title screen by removing the small text above
and below the game title, then replacing the current rendered title text with
the generated painterly title-logo image asset.

Context:
- Manager preflight HEAD before dispatch: `2e525ca`.
- Alex said the text above and below the title is not needed.
- I am treating "Roop Rivals" in Alex's phone prompt as a typo for the current
  game title, `Loop Rivals`; do not change the game name.
- Selected transparent title-logo source:
  `/mnt/nxt-dev/loopduel/.openclaw-artifacts/title-logo-image-pass-2026-07-04/loop-rivals-title-logo-painterly-v1.png`
- Relevant files from quick scan:
  - `src/App.tsx`: front title is around the `title-front` render; current
    elements include `title-kicker`, `h1`, `title-press-hint`, and
    `title-front-footer`.
  - `src/styles.css`: title screen CSS and mobile rules are near `.title-copy`,
    `.title-front-copy`, `.title-press-hint`, `.title-front-footer`, and the
    mobile title-screen block.

Scope:
- Copy the selected PNG into an appropriate committed app asset path, likely
  under `public/assets/ui/`, with a stable descriptive name.
- Replace the front-title `<h1>Loop Rivals</h1>` with an image-based logo while
  preserving accessible text (`alt` or equivalent).
- Remove the visible copy above and below the front title. Specifically remove
  the front title kicker and the small footer/press hint text beneath the
  title/menu area if they are still visible.
- Keep the title buttons, music control, title background art, and join/hero
  screen behavior intact.
- Do not redesign the title screen beyond the logo swap and copy removal.
- If the join screen shares the same title block, keep it functional and avoid
  introducing duplicated styling; the primary acceptance target is the front
  title screen.

Safety:
- Preserve unrelated dirty state. There are likely untracked manager run/report
  files under `runs/`; do not stage them unless you create/update the specific
  report requested below.
- Stage files by explicit path only. `git add -A`, `git add .`, and
  `git commit -a` are forbidden. Before committing, run `git status --short`
  and confirm every staged path belongs to your assigned stage.
- Do not use destructive git or filesystem commands.

Verification:
- Run `npm run build`.
- Run `npm run lint`.
- Start the dev server only on a port in `5200-5219`; if busy, choose another
  in that range. Stop it before finishing and report server cleanup.
- Capture live Playwright screenshots of the normal front title screen on:
  - desktop viewport, e.g. `1440x960`
  - mobile viewport, e.g. `390x844`
- Store screenshots under
  `/mnt/nxt-dev/loopduel/.openclaw-artifacts/title-logo-image-pass-2026-07-04/`.
- Check for console/page errors during capture.

Acceptance bar:
- Front title screen shows no visible text above or below the main title logo.
- Main title uses the generated painterly `Loop Rivals` PNG, is not cropped,
  and remains readable on desktop and mobile.
- Dark fantasy indie RPG vibe is preserved.
- No temporary server remains listening on ports `5200-5219`.

Report:
- Write `/mnt/nxt-dev/loopduel/runs/title-logo-image-pass-2026-07-04.report.md`
  with: summary, changed files, commit hash if committed, verification output,
  screenshot paths, console/page error status, and server cleanup status.

Return:
- Status.
- Commit hash.
- Changed files.
- Verification results.
- Screenshot paths.
- Caveats/blockers.
