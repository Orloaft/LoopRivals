# Loop Rivals

Loop Rivals (repo: `loopduel`) is a realtime multiplayer loop-runner prototype. Players choose a hero, run an automatic 16-tile loop, place terrain on their own board, sabotage rivals with rival cards, collect loot, level up, and choose traits.

## Current Status

- Playable production-candidate prototype.
- React 19 + Vite frontend.
- Express + Socket.IO server.
- Multiple room-code rooms with up to 4 total players or bots each, plus read-only spectators.
- Browser-local reconnect tokens keep a player slot through refreshes/disconnects.
- The first player to 12600 points and a final boss clear wins, then the room host can reset for a rematch.
- First human in a room becomes host; host controls can add/fill CPU opponents, start the match, remove non-host runners, and reset.
- Invite links carry the room code in the URL, and spectators can watch before taking a player seat.
- Idle non-main rooms expire automatically when no human is connected.
- Rooms run in memory, with optional JSON snapshot persistence for single-process restart recovery.

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
- `LOOPDUEL_SOCKET_ACTION_LIMIT`: per-socket action budget per window, default `36`.
- `LOOPDUEL_SOCKET_ACTION_WINDOW_MS`: socket action rate-limit window, default `4000`.
- `LOOPDUEL_PERSISTENCE_PATH`: optional JSON file for room snapshots, for example `./data/rooms.json`.
- `LOOPDUEL_PERSISTENCE_FLUSH_INTERVAL_MS`: persistence flush cadence, default `2000`.
- `LOOPDUEL_BUILD_SHA`: optional deployed commit SHA surfaced by `/healthz`.

Health checks can use `GET /healthz`. The response includes service status, version, build SHA, environment, uptime, live room/player counts, configured runtime limits, and persistence status when enabled.

### Docker

```bash
docker build -t loopduel .
docker run -p 4173:4173 \
  -e LOOPDUEL_ALLOWED_ORIGINS=https://your.domain \
  -e LOOPDUEL_PERSISTENCE_PATH=/data/rooms.json \
  -v loopduel-data:/data \
  loopduel
```

The image is multi-stage (build → slim runtime), serves the built client from
the Node server, and health-checks `/healthz`. Mount a volume for
`LOOPDUEL_PERSISTENCE_PATH` or rooms are lost when the container stops.

### Deployment Checklist

- Build with Node 22 or newer.
- Terminate TLS at the platform/load balancer or reverse proxy.
- Set `NODE_ENV=production`.
- Set `LOOPDUEL_ALLOWED_ORIGINS` to the public origin list before exposing the server.
- Set `LOOPDUEL_BUILD_SHA` from the deployed git commit.
- Set `LOOPDUEL_PERSISTENCE_PATH` to a writable path if active rooms should survive process restarts.
- Run exactly one process per room pool unless sticky sessions and shared persistence have been added.
- Configure a restart policy and a health check against `/healthz`.
- Preserve WebSocket upgrade headers if deploying behind nginx, Caddy, Cloudflare, Fly, Render, Railway, or similar.

### Operations

The server writes structured JSON logs for startup, room restore failures, persistence failures, and rate-limit events. Pipe stdout/stderr into the host platform log drain, systemd journal, Docker logs, or a service such as Grafana/Loki, Datadog, or CloudWatch.

Room state is held in memory at runtime. When `LOOPDUEL_PERSISTENCE_PATH` is set, the server also writes atomic room snapshots and restores them on startup. Human players are marked disconnected after restore and can rejoin with the same browser token; bots and match progress are preserved. This is restart recovery for a single process, not multi-process shared state.

### Troubleshooting

- If players cannot connect in production, check `LOOPDUEL_ALLOWED_ORIGINS` and WebSocket upgrade support first.
- If `/healthz` is healthy but the browser shows an old UI, confirm `npm run build` ran for the deployed commit.
- If room actions feel delayed, inspect rate-limit logs and server CPU before raising `LOOPDUEL_SOCKET_ACTION_LIMIT`.
- If a deploy interrupts games, confirm `LOOPDUEL_PERSISTENCE_PATH` points to durable writable storage and inspect `/healthz.persistence.lastError`.

## Verify

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
npm run test:balance -- 80
npm run test:ws-load -- --rooms=4 --players=4 --duration-ms=8000
npm run verify
```

`npm run verify` is the production gate used by CI. It runs lint, unit tests, production build, Playwright smoke, an 80-run balance sample, and a short WebSocket load check.

## Game Loop

Players move automatically around a 16-tile circuit. Crossing tiles can trigger fights, healing, loot, XP, slows, or rival hazards. Cards are drawn over time up to a hand limit of 7. Terrain cards modify the player's own loop. Rival cards target another player.

Rooms are created by entering a room code in the lobby. The browser stores a player token in `localStorage`, so refreshing or reconnecting rejoins the same player in the same room. Invite links use `?room=code`, and the lobby can watch that room without occupying a seat. Rooms stay in lobby setup until the host starts the match. With `LOOPDUEL_PERSISTENCE_PATH`, the saved player token can also reclaim the runner after a process restart.

Scoring is currently:

```text
level * 390 + laps * 130 + kos * 64 + rivalHits * (72 + sabotage * 8) + tilesPlaced * 44 + cardsPlayed * 9 + loot.length * 24 + gold + xp
```

First to 12600 points with a tier III boss clear wins. When a room finishes, movement stops until the room host resets it.

## Known Next Work

- Add fuller host settings beyond explicit start, such as match length and seat presets.
- Add QR join and richer rematch flow.
- Add richer hero passives; several hero descriptions are still mostly flavor.
- Expand rule tests around card placement, traits, loot, and scoring.
- Add deeper responsive QA and polish for dense mobile layouts.
- Run larger balance sims before public launch; short CI samples catch regressions but are not final tuning evidence.
