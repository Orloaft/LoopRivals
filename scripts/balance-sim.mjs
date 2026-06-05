import { heroes, testApi } from '../server/rules.mjs';

function rotateHeroes(seed) {
  const list = [...heroes];
  const offset = seed % list.length;
  const rotated = [...list.slice(offset), ...list.slice(0, offset)];
  if (seed % 2 === 1) rotated.reverse();
  return rotated.slice(0, testApi.maxPlayers);
}

export function simulateMatch(seed, options = {}) {
  const room = testApi.createRoom(`sim-${seed}`, { seed, simulated: true, now: 0 });
  const roster = options.roster ?? rotateHeroes(seed);
  for (const hero of roster) {
    const player = testApi.createPlayer(`cpu-${hero.id}-${seed}`, hero.name, hero.id, true, room);
    room.players[player.id] = player;
  }
  room.status = 'running';

  const maxSteps = options.maxSteps ?? 7200;
  for (let step = 0; step < maxSteps && room.status !== 'finished'; step += 1) {
    testApi.runRoomStep(room, { advanceMs: options.advanceMs ?? 260 });
  }

  const snapshot = testApi.roomSnapshot(room);
  const winner = snapshot.winner ?? snapshot.players[0];
  return {
    seed,
    finished: room.status === 'finished',
    ticks: room.tick,
    seconds: Math.round((room.now - room.startedAt) / 1000),
    winnerHero: winner?.heroId ?? null,
    players: snapshot.players.map((player) => ({
      heroId: player.heroId,
      score: player.score,
      level: player.level,
      laps: player.laps,
      deaths: player.deaths,
      loopTier: player.loopTier,
      maxHp: player.maxHp,
      power: player.power,
      guard: player.guard,
      rivalHits: player.rivalHits,
      tilesPlaced: player.tilesPlaced
    }))
  };
}

export function runBalanceSuite(matchCount = 120) {
  const wins = Object.fromEntries(heroes.map((hero) => [hero.id, 0]));
  const totals = Object.fromEntries(heroes.map((hero) => [hero.id, {
    appearances: 0,
    score: 0,
    deaths: 0,
    rivalHits: 0,
    loopTier: 0,
    maxHp: 0,
    power: 0,
    guard: 0
  }]));
  const matches = [];

  for (let seed = 1; seed <= matchCount; seed += 1) {
    const result = simulateMatch(seed);
    matches.push(result);
    if (result.winnerHero) wins[result.winnerHero] += 1;
    for (const player of result.players) {
      totals[player.heroId].appearances += 1;
      totals[player.heroId].score += player.score;
      totals[player.heroId].deaths += player.deaths;
      totals[player.heroId].rivalHits += player.rivalHits;
      totals[player.heroId].loopTier += player.loopTier;
      totals[player.heroId].maxHp += player.maxHp;
      totals[player.heroId].power += player.power;
      totals[player.heroId].guard += player.guard;
    }
  }

  const heroesReport = heroes.map((hero) => {
    const total = totals[hero.id];
    return {
      heroId: hero.id,
      wins: wins[hero.id],
      winRate: wins[hero.id] / matchCount,
      avgScore: Math.round(total.score / Math.max(1, total.appearances)),
      avgDeaths: Number((total.deaths / Math.max(1, total.appearances)).toFixed(2)),
      avgRivalHits: Number((total.rivalHits / Math.max(1, total.appearances)).toFixed(2)),
      avgLoopTier: Number((total.loopTier / Math.max(1, total.appearances)).toFixed(2)),
      avgMaxHp: Number((total.maxHp / Math.max(1, total.appearances)).toFixed(2)),
      avgPower: Number((total.power / Math.max(1, total.appearances)).toFixed(2)),
      avgGuard: Number((total.guard / Math.max(1, total.appearances)).toFixed(2))
    };
  });

  const winRates = heroesReport.map((hero) => hero.winRate);
  const scores = heroesReport.map((hero) => hero.avgScore);

  return {
    matchCount,
    finishedRate: matches.filter((match) => match.finished).length / matchCount,
    avgSeconds: Math.round(matches.reduce((sum, match) => sum + match.seconds, 0) / matchCount),
    winRateSpread: Number((Math.max(...winRates) - Math.min(...winRates)).toFixed(3)),
    avgScoreSpread: Math.max(...scores) - Math.min(...scores),
    heroes: heroesReport
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = Number(process.argv[2] ?? 120);
  console.log(JSON.stringify(runBalanceSuite(count), null, 2));
}
