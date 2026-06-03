# Loopduel

Loopduel is a realtime multiplayer loop-runner prototype. Players choose a hero, run an automatic 16-tile loop, place terrain on their own board, sabotage rivals with rival cards, collect loot, level up, and choose traits.

## Current Status

- Working MVP/prototype.
- React 19 + Vite frontend.
- Express + Socket.IO server.
- Multiple room-code rooms with up to 4 total players or bots each.
- Browser-local reconnect tokens keep a player slot through refreshes/disconnects.
- A match ends when one player reaches 600 points, then the room can be reset for a rematch.
- In-memory state only; restarting the server resets the game.
- No persistence beyond the running process yet.

## Run It

```bash
npm install
npm run dev
```

The dev server listens on `http://localhost:4173` by default.

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
level * 100 + laps * 32 + kos * 18 + loot.length * 5 + xp
```

First to 600 points wins. When a room finishes, movement stops until the room is reset.

## Known Next Work

- Persist rooms or add expiry/cleanup for inactive rooms.
- Add host controls for reset/kick/start settings.
- Add richer hero passives; several hero descriptions are still mostly flavor.
- Expand rule tests around card placement, traits, loot, and scoring.
- Add deeper responsive QA and polish for dense mobile layouts.
