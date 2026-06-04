# Loopduel

Loopduel is a realtime multiplayer loop-runner prototype. Players choose a hero, run an automatic 16-tile loop, place terrain on their own board, sabotage rivals with rival cards, collect loot, level up, and choose traits.

## Current Status

- Playable production-candidate prototype.
- React 19 + Vite frontend.
- Express + Socket.IO server.
- Multiple room-code rooms with up to 4 total players or bots each.
- Browser-local reconnect tokens keep a player slot through refreshes/disconnects.
- The first player to 7200 points wins, then the room host can reset for a rematch.
- First human in a room becomes host; host controls can add/fill CPU opponents and reset.
- Idle non-main rooms expire automatically when no human is connected.
- In-memory state only; restarting the server resets the game.
- No persistence beyond the running process yet.

## Run It

```bash
npm install
npm run dev
```

The dev server listens on `http://localhost:4173` by default.

## Run In Production

```bash
npm ci
npm run build
LOOPDUEL_ALLOWED_ORIGINS=https://your-domain.example npm start
```

Production serves `dist/` from the same Express process as Socket.IO. Useful environment variables:

- `PORT`: HTTP port, default `4173`.
- `LOOPDUEL_ALLOWED_ORIGINS`: comma-separated Socket.IO browser origins. Required for cross-origin production clients.
- `LOOPDUEL_ROOM_IDLE_TTL_MS`: idle room expiry after all humans disconnect, default `1800000`.
- `LOOPDUEL_ROOM_CLEANUP_INTERVAL_MS`: room cleanup cadence, default `60000`.

Health checks can use `GET /healthz`.

## Verify

```bash
npm run lint
npm run test
npm run build
```

## Game Loop

Players move automatically around a 16-tile circuit. Crossing tiles can trigger fights, healing, loot, XP, slows, or rival hazards. Cards are drawn over time up to a hand limit of 7. Terrain cards modify the player's own loop. Rival cards target another player.

Rooms are created by entering a room code in the lobby. The browser stores a player token in `localStorage`, so refreshing or reconnecting rejoins the same player in the same room when the server is still running.

Scoring is currently:

```text
level * 390 + laps * 130 + kos * 64 + rivalHits * 72 + tilesPlaced * 44 + cardsPlayed * 9 + loot.length * 24 + gold + xp
```

First to 7200 points wins. When a room finishes, movement stops until the room host resets it.

## Known Next Work

- Add durable room persistence if matches need to survive deploys/restarts.
- Add fuller host controls for kick/start/settings.
- Add richer hero passives; several hero descriptions are still mostly flavor.
- Expand rule tests around card placement, traits, loot, and scoring.
- Add deeper responsive QA and polish for dense mobile layouts.
