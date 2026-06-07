# Combat, Shop Art, And Ability UI Proposal

Date: 2026-06-07

## Goal

Make fights feel like the core Loop Hero moment instead of a quick interruption, keep the
hero ability visible enough to become a primary action, and replace the temporary shop CSS
with bespoke art that belongs beside the current right dock.

## Current Read

- Combat is server-authored in `server/rules.mjs`: each fight creates `combat.beats`,
  `startedAt`, `expiresAt`, and `durationMs`. The client renders those beats in
  `CombatOverlayBody`.
- Live combat timing is currently short: about `130ms` windup, `240ms` per beat, and
  `280ms` tail, clamped to a tight range. This keeps movement snappy, but bigger fights
  can read as a flurry of UI changes rather than a legible duel.
- The overlay has good ingredients: encounter background art, enemy lineup, hit FX,
  damage floats, HP bars, and a two-line combat log. The weak part is pacing and framing,
  not the existence of the overlay.
- The runner already stops cleanly on combat tiles and lethal fights now remain visible
  until combat expires. That gives us enough timeline structure to improve presentation
  without changing combat truth.
- The activated ability button currently lives around `top: 77.6%` in the right dock. It
  is available, but it competes with lower inventory/feed controls and does not feel like
  a first-order hero action.
- The shop drawer behavior is correct, but the panel/offers are CSS-framed. The current
  right dock uses `right-dock-loophero-gothic-v4.png` at `744 x 1619`, so a bespoke shop
  frame should be generated and sliced in the same visual language.

## Combat Timing Direction

Recommended target: fights should have three readable phases.

1. Entry: runner lands, danger cue snaps in, camera/board attention shifts to the combat
   tile, then the combat card opens. Target `260-360ms`.
2. Exchange: each beat is readable as windup, impact, and recovery. Target `360-460ms`
   per beat for live rooms, with faster simulated timing left alone for balance tests.
3. Exit: reward/death/loot result flashes, then movement resumes without sprinting. Target
   `420-620ms`.

This means a normal two-beat fight should sit around `1.4-1.8s`; a stacked danger fight
around `2.6-4.0s`, capped so it never becomes a punishment pause. The current compact
timing is closer to a notification. The better Loop Hero feel is a short ritual.

## Combat Presentation Changes

- Add a `presentationPhase` model on the client derived from `combat.startedAt`,
  `combat.beats`, and `combat.expiresAt`: `entry`, `beat`, `result`, `exit`.
- Keep server beats authoritative, but let the client interpolate local sub-beat timing:
  attacker windup starts about `110ms` before `beat.atMs`, impact lands at `beat.atMs`,
  recovery lasts about `180ms`.
- Move the combat overlay closer to the actual tile before expanding to the centered
  duel card. The existing combat-entry cue already knows the tile point; use that as the
  origin for the overlay transform.
- Add encounter-specific entrance silhouettes: forge smoke, crypt mist, grove brambles,
  road dust. These can be lightweight sprites or layered PNG strips.
- Keep the combat log, but demote it visually. The primary read should be the two
  combatants, HP deltas, and reward/death result; log text is support.
- Add outcome cards: `Victory`, `Loot Found`, `Hero Fell`, `Gate Broken`, `Boss Defeated`.
  These should use art-backed plaques rather than plain text.
- Add a reduced-motion path that keeps the same timing contract but disables strike
  lunges, shakes, and flashes.

## Ability Button Placement

Best placement: make the ability a carved medallion socket in the upper-middle right dock,
directly below the hero/stat area and above the paperdoll.

Why:

- It is close to the hero identity and reads as "this hero's power", not as inventory or
  room control.
- It stays visible while the player scans HP, gold, tier, and loadout.
- It avoids the lower dock where loot, talents, feed, and host controls already compete.
- It can reuse the cooldown loop language: an outer ring drains/fills by remaining loops,
  with the icon centered and the ability name/status on hover or beside the socket.

Suggested layout:

- Permanent circular/rune socket: `52-64px`, art-backed, hero-colored glow only when ready.
- Small adjacent label strip: ability name on desktop, `Ready` or `2 loops` status.
- On cooldown: dim icon, etched cooldown pips around the socket.
- During combat/stun: keep visible but locked, with a brief disabled shimmer.
- Mobile: put the same medallion in the top row of mobile drawer tabs, not buried in the
  menu drawer.

## Shop Art Direction

Generate bespoke PNG assets that match the current retro-gothic, parchment, oxidized-gold,
dark-wood right dock. Keep them inspectable and slightly chunky, not painterly blur.

Minimum asset set:

- `shop-drawer-frame-v1.png`: tall vertical frame for the slide-out market, transparent
  center, ornamented corners, sized around `768 x 1400`.
- `shop-tab-button-v1.png`: narrow left-edge pull tab with a bag/coin silhouette, matching
  the dock side button.
- `shop-offer-card-card-v1.png`: offer row frame for card purchases.
- `shop-offer-card-loot-v1.png`: offer row frame for equipment purchases.
- `shop-price-coin-v1.png`: small coin/rivet badge for gold prices.
- `shop-sell-well-v1.png`: dashed/tray art for drag-selling.
- `shop-refresh-hourglass-v1.png`: small timer icon or tiny animated 4-frame strip.
- `ability-socket-frame-v1.png`: rune medallion socket for the hero ability button.
- `ability-cooldown-ring-v1.png`: transparent ring/pip overlay usable by CSS masking.

Prompt base for Imagen/image generation:

> Retro gothic fantasy game UI asset sheet for a Loop Hero-inspired roguelite, dark carved
> wood and black iron, aged parchment insets, oxidized gold trim, small red ember accents,
> hand-painted pixel-adjacent texture, transparent background, orthographic UI elements,
> readable silhouettes, no text, no logos, no characters, no modern icons.

Generate frames as separate transparent assets instead of one composited mockup. The right
dock already proves this approach works: CSS can place live text and item sprites on top
while the art carries the style.

## Implementation Order

1. Tune live combat timing constants and add tests that assert simulated timing remains
   unchanged.
2. Add client combat phase timing and sub-beat animation classes.
3. Reframe the ability as an upper dock medallion, with cooldown ring and mobile location.
4. Generate/import the shop and ability UI PNGs, then swap drawer/toggle/offer/sell CSS
   from plain borders to art-backed surfaces.
5. Add Playwright checks for combat overlay duration, ability visibility, shop drawer fit,
   and non-overlap on desktop/mobile.

## Risks

- Longer combat timing can feel sluggish if stacked encounters happen too often. Cap total
  visible fight time and consider compressing only after the first three beats.
- Art-backed UI needs stable aspect ratios. The CSS should define dimensions first, then
  layer text inside safe zones.
- Ability visibility should not hide HP or equipment. The medallion should occupy an
  existing visual gap rather than forcing the whole dock to reflow.
