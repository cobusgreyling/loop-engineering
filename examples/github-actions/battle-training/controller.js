// sSenkuuu bot v2 — improved controller for battle.training Season 2 (s2.0.0)
// Ideas: squad-wide focus fire (finish low-HP / high-threat targets first),
// spread objectives (one unit per objective, not all on the same one),
// per-kind roles: MBT brawls at mid range, missile locks with drone spotting,
// drone stays far and spots, scout caps and harasses, artillery shells parked
// targets at mid range, dodge incoming shells, resupply at spawn when out of ammo.
// Draft is set by DRAFT below; everything else is shared.

const FP = 65536;
const FULL = 4096;
const DRAFT = ["mbt", "missile", "drone", "scout"];

let rules, map, side, hill, spawn, spawnPt;
const seen = new Map(); // contact id -> {x,y,kind,hpFrac,tick}

function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function angleTo(ax, ay, bx, by) { return Math.round((Math.atan2(by - ay, bx - ax) / (2 * Math.PI)) * FULL) & (FULL - 1); }
function angDiff(a, b) { let d = (b - a) & (FULL - 1); return d > FULL / 2 ? d - FULL : d; }
function passable(x, y) {
  const tx = Math.floor(x / FP), ty = Math.floor(y / FP);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  const t = map.terrain[ty * map.width + tx];
  return t !== 2 && t !== 4 && t !== 6; // water, rock, ruin
}
function steerToward(u, goal) {
  let want = angleTo(u.x, u.y, goal[0], goal[1]);
  const offsets = [0, 341, -341, 683, -683, 1024, -1024, 1536, -1536];
  for (const off of offsets) {
    const a = (want + off) & (FULL - 1);
    const rad = (a / FULL) * 2 * Math.PI;
    if (passable(u.x + Math.cos(rad) * FP * 1.5, u.y + Math.sin(rad) * FP * 1.5)) { want = a; break; }
  }
  const spec = rules.units[u.kind];
  const d = angDiff(u.heading, want);
  return { steer: Math.max(-FP, Math.min(FP, Math.round((d / spec.turnRate) * FP))), throttle: Math.abs(d) > 512 ? Math.round(FP * 0.25) : FP };
}
function awayFrom(u, px, py, tiles) {
  const d = Math.max(1, dist(u.x, u.y, px, py));
  const k = (tiles * FP) / d;
  return [u.x + Math.round((u.x - px) * k), u.y + Math.round((u.y - py) * k)];
}

const THREAT = { missile: 5, artillery: 5, mbt: 4, apc: 3, engineer: 3, scout: 2, drone: 1 };

globalThis.controller = {
  draft(h) {
    const d = h.draft;
    if (!d) return undefined;
    const cost = DRAFT.reduce((c, k) => c + (d.costs[k] ?? 99), 0);
    return cost <= d.budget && DRAFT.every(k => d.roster.includes(k)) ? DRAFT.slice() : undefined;
  },

  hello(h) {
    rules = h.rules; map = h.map; side = h.side;
    hill = [Math.floor(map.width / 2) * FP + FP / 2, Math.floor(map.height / 2) * FP + FP / 2];
    spawn = map.spawns[side];
    spawnPt = [spawn[0] * FP + FP / 2, spawn[1] * FP + FP / 2];
  },

  tick(o) {
    // remember contacts (for artillery fire at last-known positions)
    for (const c of o.contacts) seen.set(c.id, { x: c.x, y: c.y, kind: c.kind, hpFrac: c.hpFrac, tick: o.tick });
    for (const [id, s] of seen) if (o.tick - s.tick > 120) seen.delete(id);

    const alive = o.units.filter(u => u.alive);

    // squad-wide focus target: finish low-HP high-threat targets first
    let focus = null, focusScore = -1;
    for (const c of o.contacts) {
      const threat = THREAT[c.kind] ?? 2;
      const v = threat + (1 - c.hpFrac / FP) * 2.5;
      if (v > focusScore) { focusScore = v; focus = c; }
    }

    // objective assignment: spread units, weight / distance, penalise taken ones
    const taken = new Map();
    const assigned = new Map();
    for (const u of alive) {
      let best = null, bs = -1;
      for (const obj of o.objectives || []) {
        if (obj.owner === side && obj.state === "held") continue;
        const pen = taken.get(obj) ? 0.45 : 1;
        const s = (obj.weight * pen) / (1 + dist(u.x, u.y, obj.x, obj.y) / FP);
        if (s > bs) { bs = s; best = obj; }
      }
      if (best) { taken.set(best, (taken.get(best) || 0) + 1); assigned.set(u.id, [best.x, best.y]); }
      else assigned.set(u.id, hill);
    }

    const units = [];
    for (const u of alive) {
      const spec = rules.units[u.kind];
      const order = { id: u.id };
      const myGoal = assigned.get(u.id) || hill;

      // --- decide movement goal ---
      let goal = myGoal;
      // out of ammo -> go home to resupply
      if ((u.kind === "artillery" || u.kind === "missile") && u.ammo === 0) goal = spawnPt;
      // low HP -> fall back to spawn (preserve the unit)
      else if (u.hp < u.maxHp * 0.22 && u.kind !== "drone") goal = spawnPt;
      // dodge incoming artillery shells landing near us
      let dodge = null;
      for (const inc of o.incoming || []) {
        if (dist(u.x, u.y, inc.x, inc.y) < 2.5 * FP) { dodge = awayFrom(u, inc.x, inc.y, 4); break; }
      }
      if (dodge) goal = dodge;
      else if (focus) {
        const fd = dist(u.x, u.y, focus.x, focus.y);
        if (u.kind === "drone") {
          // spotter: stay 16+ tiles away from the enemy, near the objective
          if (fd < 16 * FP) goal = awayFrom(u, focus.x, focus.y, 6);
          else goal = myGoal;
        } else if (u.kind === "missile") {
          if (fd < 14 * FP) goal = awayFrom(u, focus.x, focus.y, 6);
          else if (fd > 34 * FP) goal = [focus.x, focus.y];
          else goal = null; // in the sweet spot: hold and lock
        } else if (u.kind === "artillery") {
          if (fd < spec.gun.minRange * 1.6) goal = awayFrom(u, focus.x, focus.y, 8);
          else if (fd > 42 * FP) goal = myGoal;
          else goal = null; // hold and shell
        } else {
          // mbt / scout / apc: close to ~60% of gun range, then hold and shoot
          if (spec.gun && spec.gun.mode === "direct" && fd < spec.gun.maxRange * 0.55) goal = null;
          else if (fd > (spec.gun ? spec.gun.maxRange * 0.9 : 10 * FP)) goal = [focus.x, focus.y];
          // else keep moving to the objective while engaging
        }
      }
      if (goal && o.canMove) {
        const mv = steerToward(u, goal);
        order.steer = mv.steer; order.throttle = mv.throttle;
        if (u.blocked) { order.throttle = -FP; order.steer = FP; }
      }

      // --- weapons: everybody shoots the focus target ---
      if (u.kind === "missile") {
        if (focus) {
          order.target = focus.id; // hold the lock every tick
          // fire ONLY once the lock is complete (lockTicks >= 40) and in range
          const fd = dist(u.x, u.y, focus.x, focus.y);
          if (u.lockTarget === focus.id && u.lockTicks >= (spec.gun.lockTicks || 40)
              && u.reload === 0 && fd >= spec.gun.minRange && fd <= spec.gun.maxRange) order.fire = true;
        }
      } else if (u.kind === "artillery") {
        const tgt = focus || null;
        if (tgt) {
          const d = dist(u.x, u.y, tgt.x, tgt.y);
          if (u.reload === 0 && d >= spec.gun.minRange && d <= spec.gun.maxRange) {
            // lead the target: shell flight ~40 ticks + 1 tick/tile
            const flight = 40 + Math.round(d / FP);
            const rad = (tgt.heading / FULL) * 2 * Math.PI;
            const px = tgt.x + Math.round(Math.cos(rad) * tgt.speed * flight);
            const py = tgt.y + Math.round(Math.sin(rad) * tgt.speed * flight);
            order.fire = [px, py];
          }
        } else if (u.reload === 0 && u.ammo !== 0) {
          // no live contact: shell the freshest remembered position in range
          let mem = null;
          for (const s of seen.values()) if (!mem || s.tick > mem.tick) mem = s;
          if (mem) {
            const d = dist(u.x, u.y, mem.x, mem.y);
            if (d >= spec.gun.minRange && d <= spec.gun.maxRange) order.fire = [mem.x, mem.y];
          }
        }
      } else if (u.kind === "drone") {
        // no gun; pure spotter
      } else if (focus && spec.gun && spec.gun.mode === "direct") {
        const d = dist(u.x, u.y, focus.x, focus.y);
        order.aimAt = [focus.x, focus.y];
        const aimed = Math.abs(angDiff(u.turret, angleTo(u.x, u.y, focus.x, focus.y))) <= spec.gun.aimTolerance;
        if (u.reload === 0 && aimed && d <= spec.gun.maxRange) order.fire = true;
      } else if (focus && spec.gun && spec.gun.mode === "none") {
        if (spec.secondary && u.reload2 === 0 && dist(u.x, u.y, focus.x, focus.y) <= spec.secondary.maxRange) order.fire = true;
      }
      units.push(order);
    }
    return { units };
  },
};
