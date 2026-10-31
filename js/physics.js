// A small character physics for jelly beans: spheres against boxes, cylinders and balls that can move and spin.
// Moving things know how fast each point of them is going, so they carry you, shove you and launch you.
import * as THREE from '../lib/three.module.min.js';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), loc = new THREE.Vector3();

class Collider {
  constructor(o = {}) {
    this.pos = new THREE.Vector3(...(o.pos || [0, 0, 0]));
    this.quat = new THREE.Quaternion(); if (o.rot) this.quat.setFromEuler(new THREE.Euler(...o.rot, 'YXZ'));
    this.matrix = new THREE.Matrix4(); this.prev = new THREE.Matrix4(); this.inv = new THREE.Matrix4();
    this.anim = o.anim || null; this.mesh = null; this.active = true;
    this.conveyor = o.conveyor || null; this.bouncy = o.bouncy || 0; this.slip = o.slip || 0; this.tag = o.tag || null;
    this.compose(); this.prev.copy(this.matrix);
  }
  compose() { this.matrix.compose(this.pos, this.quat, ONE); this.inv.copy(this.matrix).invert(); }
  step(t, dt) {
    this.prev.copy(this.matrix);
    if (this.anim) { this.anim(t, this, dt); this.compose(); }
    if (this.mesh) { this.mesh.position.copy(this.pos); this.mesh.quaternion.copy(this.quat); }
  }
  // how fast the surface point p is moving (world units per second)
  pointVel(p, dt, out) {
    loc.copy(p).applyMatrix4(this.inv);
    tmp2.copy(loc).applyMatrix4(this.prev);
    return out.copy(p).sub(tmp2).divideScalar(Math.max(dt, 1e-4));
  }
}
const ONE = new THREE.Vector3(1, 1, 1);

export class Box extends Collider {
  constructor(hx, hy, hz, o) { super(o); this.h = new THREE.Vector3(hx, hy, hz); this.r = Math.hypot(hx, hy, hz); }
  // closest point and outward normal for a sphere at c with radius r; null when not touching
  contact(c, r, out) {
    if (Math.abs(c.x - this.pos.x) > this.r + r || Math.abs(c.y - this.pos.y) > this.r + r || Math.abs(c.z - this.pos.z) > this.r + r) return null;
    loc.copy(c).applyMatrix4(this.inv);
    const h = this.h;
    const q = tmp.set(Math.max(-h.x, Math.min(h.x, loc.x)), Math.max(-h.y, Math.min(h.y, loc.y)), Math.max(-h.z, Math.min(h.z, loc.z)));
    let dx = loc.x - q.x, dy = loc.y - q.y, dz = loc.z - q.z, d2 = dx * dx + dy * dy + dz * dz;
    let nx, ny, nz, depth;
    if (d2 > 1e-9) { if (d2 > r * r) return null; const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; depth = r - d; }
    else {
      // centre inside: leave through the nearest face
      const px = h.x - Math.abs(loc.x), py = h.y - Math.abs(loc.y), pz = h.z - Math.abs(loc.z);
      if (py <= px && py <= pz) { nx = 0; ny = Math.sign(loc.y) || 1; nz = 0; depth = py + r; q.y = ny * h.y; }
      else if (px <= pz) { nx = Math.sign(loc.x) || 1; ny = 0; nz = 0; depth = px + r; q.x = nx * h.x; }
      else { nx = 0; ny = 0; nz = Math.sign(loc.z) || 1; depth = pz + r; q.z = nz * h.z; }
    }
    out.n.set(nx, ny, nz).transformDirection(this.matrix);
    out.p.copy(q).applyMatrix4(this.matrix); out.depth = depth;
    return out;
  }
}
// a vertical cylinder (discs, posts, hex tiles)
export class Cyl extends Collider {
  constructor(radius, hh, o) { super(o); this.rad = radius; this.hh = hh; this.r = Math.hypot(radius, hh); }
  contact(c, r, out) {
    if (Math.abs(c.x - this.pos.x) > this.r + r || Math.abs(c.z - this.pos.z) > this.r + r || Math.abs(c.y - this.pos.y) > this.hh + r) return null;
    loc.copy(c).applyMatrix4(this.inv);
    const rl = Math.hypot(loc.x, loc.z), R = this.rad, H = this.hh;
    const q = tmp;
    if (rl <= R) q.set(loc.x, Math.max(-H, Math.min(H, loc.y)), loc.z); else q.set(loc.x / rl * R, Math.max(-H, Math.min(H, loc.y)), loc.z / rl * R);
    let dx = loc.x - q.x, dy = loc.y - q.y, dz = loc.z - q.z, d2 = dx * dx + dy * dy + dz * dz, nx, ny, nz, depth;
    if (d2 > 1e-9) { if (d2 > r * r) return null; const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; depth = r - d; }
    else {
      const top = H - Math.abs(loc.y), side = R - rl;
      if (top <= side) { nx = 0; ny = Math.sign(loc.y) || 1; nz = 0; depth = top + r; q.y = ny * H; }
      else { nx = loc.x / (rl || 1); ny = 0; nz = loc.z / (rl || 1); depth = side + r; q.x = nx * R; q.z = nz * R; }
    }
    out.n.set(nx, ny, nz).transformDirection(this.matrix);
    out.p.copy(q).applyMatrix4(this.matrix); out.depth = depth;
    return out;
  }
}
export class Ball extends Collider {
  constructor(radius, o) { super(o); this.rad = radius; this.r = radius; }
  contact(c, r, out) {
    const dx = c.x - this.pos.x, dy = c.y - this.pos.y, dz = c.z - this.pos.z, d2 = dx * dx + dy * dy + dz * dz, R = this.rad + r;
    if (d2 > R * R) return null; const d = Math.sqrt(d2) || 1e-4;
    out.n.set(dx / d, dy / d, dz / d); out.p.copy(this.pos).addScaledVector(out.n, this.rad); out.depth = R - d;
    return out;
  }
}

// ================================================================ the bean
export const G = 26, JUMP = 9.4, RUN = 7.2, DIVE = 10;
const hit = { n: new THREE.Vector3(), p: new THREE.Vector3(), depth: 0 };
const pv = new THREE.Vector3(), cen = new THREE.Vector3();
export class Body {
  constructor(x = 0, y = 0, z = 0) {
    this.pos = new THREE.Vector3(x, y, z); this.vel = new THREE.Vector3(); this.yaw = 0;
    this.grounded = false; this.ground = null; this.carry = new THREE.Vector3(); this.airT = 0;
    this.stun = 0; this.dive = 0; this.jumpBuf = 0; this.coyote = 0; this.anim = 'idle'; this.bump = 0;
  }
  // input: { x, z } wish direction in world space (length 0..1), jump, dive
  step(dt, input, world) {
    const S = this;
    // ride whatever we stood on last frame
    if (S.grounded && S.ground) S.pos.addScaledVector(S.carry, dt);
    S.stun = Math.max(0, S.stun - dt); S.bump = Math.max(0, S.bump - dt);
    if (input.jump) S.jumpBuf = 0.14; else S.jumpBuf = Math.max(0, S.jumpBuf - dt);
    S.coyote = S.grounded ? 0.1 : Math.max(0, S.coyote - dt);
    const wx = input.x || 0, wz = input.z || 0, wl = Math.hypot(wx, wz);
    if (wl > 0.1 && !S.stun && !S.dive) S.yaw = Math.atan2(wx, wz);
    // walking
    if (!S.stun && !S.dive) {
      const sp = RUN * Math.min(1, wl), acc = S.grounded ? (S.ground?.slip ? 6 : 48) : 16;
      const tx = wx / (wl || 1) * sp, tz = wz / (wl || 1) * sp;
      S.vel.x += Math.max(-acc * dt, Math.min(acc * dt, tx - S.vel.x));
      S.vel.z += Math.max(-acc * dt, Math.min(acc * dt, tz - S.vel.z));
      if (S.jumpBuf > 0 && S.coyote > 0) { S.vel.y = JUMP; S.jumpBuf = 0; S.coyote = 0; S.grounded = false; S.events?.push('jump'); }
      if (input.dive && !S.grounded && S.airT > 0.05) { S.dive = 0.65; S.vel.x = Math.sin(S.yaw) * DIVE; S.vel.z = Math.cos(S.yaw) * DIVE; S.vel.y = Math.min(S.vel.y, 3.5); S.events?.push('dive'); }
      else if (input.dive && S.grounded && wl > 0.2) { S.dive = 0.55; S.vel.x = Math.sin(S.yaw) * DIVE * 0.9; S.vel.z = Math.cos(S.yaw) * DIVE * 0.9; S.vel.y = 4; S.grounded = false; S.events?.push('dive'); }
    } else if (S.grounded) { const f = Math.exp(-dt * (S.dive ? 3 : 6)); S.vel.x *= f; S.vel.z *= f; }
    if (S.dive) { S.dive = Math.max(0, S.dive - dt); if (S.grounded && S.dive < 0.35) S.dive = 0; }
    if (S.grounded && S.ground?.conveyor) { S.pos.x += S.ground.conveyor[0] * dt; S.pos.z += S.ground.conveyor[1] * dt; }
    S.vel.y -= G * dt;
    S.vel.y = Math.max(S.vel.y, -40);
    // move in small steps so fast things don't pass through
    const n = Math.min(6, Math.max(2, Math.ceil(S.vel.length() * dt / 0.18)));
    const wasGround = S.grounded; S.grounded = false; S.ground = null;
    for (let k = 0; k < n; k++) { S.pos.addScaledVector(S.vel, dt / n); this.collide(dt, world); }
    if (S.grounded) S.airT = 0; else S.airT += dt;
    if (!wasGround && S.grounded && S.airT === 0) S.events?.push('land');
    S.anim = S.stun ? 'tumble' : S.dive ? 'dive' : !S.grounded ? 'air' : Math.hypot(S.vel.x, S.vel.z) > 0.8 ? 'run' : 'idle';
  }
  collide(dt, world) {
    const S = this;
    for (const [oy, r] of [[0.5, 0.5], [1.15, 0.4]]) {
      cen.set(S.pos.x, S.pos.y + oy, S.pos.z);
      for (const c of world.colliders) {
        if (!c.active) continue;
        if (!c.contact(cen, r, hit)) continue;
        S.pos.addScaledVector(hit.n, hit.depth); cen.addScaledVector(hit.n, hit.depth);
        c.pointVel(hit.p, dt, pv);
        const rel = S.vel.dot(hit.n) - pv.dot(hit.n);
        if (hit.n.y > 0.55 && oy < 1) {
          S.grounded = true; S.ground = c; S.carry.set(pv.x, Math.min(0, pv.y), pv.z);
          if (rel < 0) S.vel.y = Math.max(S.vel.y, pv.y);
          if (c.bouncy) { S.vel.y = c.bouncy; S.grounded = false; S.events?.push('boing'); }
        } else {
          if (rel < 0) S.vel.addScaledVector(hit.n, -rel);
          // something moving hit us: get shoved, and sent flying if it was fast
          const push = pv.dot(hit.n);
          if (push > 1.2) {
            S.vel.addScaledVector(hit.n, push * 0.6);
            if (push > 4.5 && !S.bump) { S.vel.y = Math.max(S.vel.y, 4 + push * 0.35); S.stun = Math.min(1.1, 0.35 + push * 0.06); S.bump = 0.5; S.events?.push('bonk'); }
          }
          if (c.bouncy) { S.vel.addScaledVector(hit.n, c.bouncy); S.vel.y = Math.max(S.vel.y, 5); S.stun = 0.5; S.events?.push('boing'); }
        }
      }
    }
  }
}
// beans push each other a little
export function separate(bodies) {
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j]; if (!a || !b) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dy = b.pos.y - a.pos.y;
    if (Math.abs(dy) > 1.2) continue;
    const d2 = dx * dx + dz * dz; if (d2 > 0.81 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), push = (0.9 - d) * 0.5, nx = dx / d, nz = dz / d;
    if (!a.remote) { a.pos.x -= nx * push; a.pos.z -= nz * push; }
    if (!b.remote) { b.pos.x += nx * push; b.pos.z += nz * push; }
  }
}
