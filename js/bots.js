// Computer beans. Each has a skill level: good ones time their jumps, sloppy ones fall in and get bonked.
import * as THREE from '../lib/three.module.min.js';

const probeHit = { n: new THREE.Vector3(), p: new THREE.Vector3(), depth: 0 }, P = new THREE.Vector3();
// is there floor about a step ahead of this spot?
function floorAhead(L, x, y, z, dx, dz, dist = 1.3) {
  for (const dy of [-0.15, -1.1]) { P.set(x + dx * dist, y + dy, z + dz * dist); for (const c of L.colliders) if (c.active && c.contact(P, 0.35, probeHit)) return true; }
  return false;
}
const lineDist = (a, x, z) => Math.abs(x * Math.sin(a) + z * Math.cos(a));

export function botInput(e, L, T, dt, ents) {
  const b = e.body, m = e.mem; const out = { x: 0, z: 0, jump: false, dive: false };
  if (!m.init) Object.assign(m, { init: true, skill: e.skill ?? (0.5 + Math.random() * 0.5), lane: (Math.random() - 0.5) * 7, wi: 0, door: {}, tried: {}, stuckT: 0, lastZ: b.pos.z, prog: 0, ang: Math.atan2(b.pos.x, b.pos.z), rad: 5 + Math.random() * 2, decided: null, tt: null, hop: 0 });
  if (T < 0) return out;
  let tx = b.pos.x, tz = b.pos.z, speed = 0.82 + m.skill * 0.18;
  // ---------------------------------------------------------------- races
  if (L.waypoints) {
    const W = L.waypoints;
    while (m.wi < W.length - 1 && b.pos.z > W[m.wi].z - 0.3) m.wi++;
    const w = W[m.wi]; let waiting = false;
    tx = (w.x ?? 0) + m.lane * 0.55; tz = w.z + 2;
    if (w.plat) {
      const p = w.plat.pos, edge = p.z - 3.6;
      if (b.ground === w.plat) { tx = p.x; tz = p.z + 3; }
      else if (b.pos.z < p.z - 1.8) {
        const close = Math.abs(p.x - b.pos.x) < 0.7 + (1 - m.skill) * 1.6;
        if (close) { tx = p.x; tz = p.z; if (b.grounded && b.pos.z > edge - 0.6) out.jump = true; }
        else { waiting = true; tx = b.pos.x + (p.x - b.pos.x) * 0.15; tz = edge; if (b.pos.z > edge) speed *= 0.3; }
      }
    }
    if (w.row) {
      const row = w.row, key = row.z;
      // smart beans head for a door someone already broke
      const broken = row.doors.filter(d => d.broken);
      if (broken.length && Math.random() < m.skill * 0.06) m.door[key] = broken.reduce((a, d) => Math.abs(d.x - b.pos.x) < Math.abs(a.x - b.pos.x) ? d : a, broken[0]);
      if (!m.door[key]) { const opts = row.doors.filter(d => !m.tried[d.x + ',' + key]); m.door[key] = opts[Math.random() * opts.length | 0] || row.doors[0]; }
      const d = m.door[key]; tx = d.x; tz = row.z + 2;
      if (b.pos.z < row.z - 0.3 && b.pos.z > row.z - 1.8 && Math.abs(b.pos.x - d.x) < 1.6 && Math.hypot(b.vel.x, b.vel.z) < 1.5) { m.doorT = (m.doorT || 0) + dt; if (m.doorT > 0.35) { m.tried[d.x + ',' + key] = 1; m.door[key] = null; m.doorT = 0; } }
      else if (b.pos.z < row.z - 2.5 && Math.abs(b.pos.x - d.x) > 0.3) tz = row.z - 1.5;
    }
    if (w.jump && b.grounded && Math.abs(b.pos.z - (w.z - 1.1)) < 0.5) out.jump = true;
    // jump gaps we can see
    const dx = tx - b.pos.x, dz = tz - b.pos.z, l = Math.hypot(dx, dz) || 1;
    if (!waiting && b.grounded && !floorAhead(L, b.pos.x, b.pos.y, b.pos.z, dx / l, dz / l)) out.jump = true;
    // stuck behind something: hop and change lanes
    if (b.pos.z - m.lastZ < 0.25) { m.stuckT += dt; if (m.stuckT > 1.6 && !waiting) { out.jump = true; m.lane = (Math.random() - 0.5) * 7; m.stuckT = 0.8; } } else { m.stuckT = 0; m.lastZ = b.pos.z; }
    if (L.finishZ && b.pos.z > L.finishZ - 3.5 && b.pos.z < L.finishZ && !m.dove && Math.random() < 0.3) { m.dove = true; out.dive = true; }
  }
  // ---------------------------------------------------------------- jump the spinning bars
  else if (L.lowA) {
    const t = Math.min(T, 70);
    m.ang += (Math.random() - 0.5) * dt * 0.6;
    tx = Math.sin(m.ang) * m.rad; tz = Math.cos(m.ang) * m.rad;
    if (Math.hypot(tx - b.pos.x, tz - b.pos.z) < 0.6) speed = 0;
    const d = lineDist(L.lowA(t), b.pos.x, b.pos.z), dn = lineDist(L.lowA(t + 0.1), b.pos.x, b.pos.z);
    if (d > 2.2) m.decided = null;
    if (b.grounded && dn < d && d < 1.35) {
      if (m.decided === null) m.decided = Math.random() < 0.45 + m.skill * 0.55;
      const dh = lineDist(L.highA(t + 0.25), b.pos.x, b.pos.z);
      if (m.decided && !(dh < 1.2 && Math.random() < m.skill * 0.5)) out.jump = true;
    }
  }
  // ---------------------------------------------------------------- hex fall: keep moving to tiles that are still there
  else if (L.tiles) {
    const myLayer = L.tiles.filter(c => c.active && c.base < b.pos.y + 0.2).reduce((best, c) => (best == null || c.base > best ? c.base : best), null);
    const bad = (c) => !c || !c.active || (c.fallAt && c.fallAt - T < 0.9);
    if (bad(m.tt) || Math.hypot(m.tt.pos.x - b.pos.x, m.tt.pos.z - b.pos.z) < 0.5) {
      const cand = L.tiles.filter(c => c.active && !c.fallAt && Math.abs(c.base - (myLayer ?? c.base)) < 0.5);
      let best = null, bs = -1e9;
      for (let k = 0; k < 14 && cand.length; k++) {
        const c = cand[Math.random() * cand.length | 0], dd = Math.hypot(c.pos.x - b.pos.x, c.pos.z - b.pos.z);
        const crowd = ents.filter(o => o !== e && Math.hypot(o.body.pos.x - c.pos.x, o.body.pos.z - c.pos.z) < 2).length;
        const s = -Math.abs(dd - 2.4) - crowd * 1.5 - Math.hypot(c.pos.x, c.pos.z) * 0.08 * m.skill;
        if (s > bs) { bs = s; best = c; }
      }
      m.tt = best;
    }
    if (m.tt) { tx = m.tt.pos.x; tz = m.tt.pos.z; }
    const under = b.ground?.tag === 'hex' ? b.ground : null;
    if (under && under.fallAt && under.fallAt - T < 0.25 && Math.random() < m.skill) out.jump = true;
    speed *= 0.7 + m.skill * 0.3;
  }
  const dx = tx - b.pos.x, dz = tz - b.pos.z, l = Math.hypot(dx, dz);
  if (l > 0.05) { out.x = dx / l * speed * Math.min(1, l * 2); out.z = dz / l * speed * Math.min(1, l * 2); }
  return out;
}
