// The rounds: two races, a spinning-bar survival and the tile-drop final. Each builds its meshes and colliders,
// knows where to spawn, where the finish and checkpoints are, and how a bot should play it.
import * as THREE from '../lib/three.module.min.js';
import { Box, Cyl, Ball } from './physics.js';

export const toonGrad = (() => { const t = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const matCache = new Map();
export function toon(color, o = {}) { const k = color + JSON.stringify(o); if (!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: toonGrad, ...o })); return matCache.get(k); }
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296); }

// stripes for floors
function stripeTex(a, b, n = 8) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.fillStyle = b; for (let i = 0; i < n; i += 2) g.fillRect(0, i * 64 / n, 64, 64 / n);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}

class Builder {
  constructor(scene) { this.scene = scene; this.group = new THREE.Group(); scene.add(this.group); this.colliders = []; this.updaters = []; }
  add(c, mesh, ghost) { c.mesh = mesh; mesh.position.copy(c.pos); mesh.quaternion.copy(c.quat); mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh); if (!ghost) this.colliders.push(c); return c; }
  box(w, h, d, color, o = {}) {
    let m = toon(color);
    if (o.stripes) { const t = stripeTex(color, o.stripes, 8); t.repeat.set(1, d / 4); m = new THREE.MeshToonMaterial({ color: '#ffffff', map: t, gradientMap: toonGrad }); }
    return this.add(new Box(w / 2, h / 2, d / 2, o), new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), o.ghost);
  }
  cyl(r, h, color, o = {}, seg = 40) { return this.add(new Cyl(r, h / 2, o), new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), toon(color)), o.ghost); }
  ball(r, color, o = {}) { return this.add(new Ball(r, o), new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), toon(color)), o.ghost); }
  deco(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh); return mesh; }
  update(f) { this.updaters.push(f); }
  dispose() { this.scene.remove(this.group); this.group.traverse(o => { o.geometry?.dispose?.(); }); }
}
// a sea of jelly far below
function slimeSea(B, y, color) {
  const g = new THREE.PlaneGeometry(400, 400, 1, 1), m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ color, gradientMap: toonGrad, transparent: true, opacity: 0.92 }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; B.group.add(m);
  B.update((t) => { m.position.y = y + Math.sin(t * 0.8) * 0.15; });
}
// confetti cannons and arches for the finish
function finishArch(B, z, y, w) {
  const posts = [-w / 2, w / 2].map(x => B.deco(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 16), toon('#ffffff'))));
  posts[0].position.set(-w / 2, y + 2.5, z); posts[1].position.set(w / 2, y + 2.5, z);
  const top = B.deco(new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 1.2, 0.6), toon('#ff5ab0'))); top.position.set(0, y + 5.2, z);
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const g = c.getContext('2d'); g.fillStyle = '#ff5ab0'; g.fillRect(0, 0, 256, 48); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FINISH', 128, 26);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 1.1), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(0, y + 5.2, z - 0.31); sign.rotation.y = Math.PI; B.group.add(sign);
  const s2 = sign.clone(); s2.position.z = z + 0.31; s2.rotation.y = 0; B.group.add(s2);
  // checkered line on the floor
  const ck = document.createElement('canvas'); ck.width = 64; ck.height = 16; const cg = ck.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { cg.fillStyle = (i + j) % 2 ? '#222' : '#fff'; cg.fillRect(i * 4, j * 4, 4, 4); }
  const ct = new THREE.CanvasTexture(ck); ct.magFilter = THREE.NearestFilter;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(w, 1), new THREE.MeshBasicMaterial({ map: ct })); line.rotation.x = -Math.PI / 2; line.position.set(0, y + 0.02, z); B.group.add(line);
}
function startArch(B, z, w) { const m = B.deco(new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.35, 10, 40, Math.PI), toon('#7ae0ff'))); m.position.set(0, 0, z); }
// fluffy clouds and balloons around the course
function scenery(B, r, len) {
  const R = rng(99);
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group(); const col = ['#ffffff', '#fff4fa', '#f0f8ff'][i % 3];
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(2 + R() * 2.5, 14, 10), toon(col)); s.position.set(k * 2.5 - 4, R() * 1.5, R() * 2); g.add(s); }
    const side = i % 2 ? 1 : -1; g.position.set(side * (r + 18 + R() * 40), -14 + R() * 30, -40 + R() * (len + 80)); B.group.add(g);
  }
  for (let i = 0; i < 16; i++) {
    const col = ['#ff6ab0', '#ffd23a', '#6ad0ff', '#8aff8a', '#c8a0ff'][i % 5];
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), toon(col)); b.scale.y = 1.2;
    const side = i % 2 ? 1 : -1; const x = side * (r + 4 + R() * 10), z = R() * len, y0 = 4 + R() * 8;
    b.position.set(x, y0, z); B.group.add(b);
    B.update((t) => { b.position.y = y0 + Math.sin(t * 0.9 + i) * 0.6; });
  }
}

// ================================================================ round 1: spin road (race)
const spinRoad = {
  id: 'spin', name: '旋轉大道', type: 'race', icon: '🌀', desc: '躲過旋轉棒、跳上移動平台、閃開大鐵鎚，衝上終點！前面的人晉級。',
  sky: ['#7ec8ff', '#ffe0f4'],
  build(scene, seed) {
    const B = new Builder(scene), R = rng(seed);
    slimeSea(B, -9, '#ff8ad0'); scenery(B, 10, 130);
    B.box(16, 1, 16, '#7ad0ff', { pos: [0, -0.5, 6], stripes: '#5ab8f0' });
    startArch(B, 13.5, 12);
    // sweepers
    B.box(12, 1, 28, '#ffd06a', { pos: [0, -0.5, 28], stripes: '#ffc040' });
    [20, 28, 36].forEach((z, i) => {
      B.cyl(0.6, 1.6, '#ffffff', { pos: [0, 0.8, z] });
      const w = (i % 2 ? -1 : 1) * (1.3 + R() * 0.5), a0 = R() * 6;
      B.box(11.2, 0.6, 0.6, '#ff5a7a', { pos: [0, 0.55, z], anim: (t, c) => c.quat.setFromAxisAngle(UP, a0 + w * t) });
    });
    // moving platforms over the gap
    const plats = [45, 50.5, 56].map((z, i) => B.box(4.2, 0.6, 4.2, '#8aff9a', { pos: [0, -0.3, z], anim: (t, c) => { c.pos.x = Math.sin(t * 1.25 + i * 2.1) * 3.6; } }));
    // hammers
    B.box(12, 1, 26, '#c8a0ff', { pos: [0, -0.5, 72], stripes: '#b088f0' });
    [64, 70, 76, 82].forEach((z, i) => {
      const ph = i * 1.4, sp = 1.5 + R() * 0.3;
      const rod = B.deco(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8), toon('#888899')));
      const beam = B.deco(new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 0.5), toon('#ffffff'))); beam.position.set(0, 8, z);
      B.box(2, 2, 2, '#ff7a3a', { pos: [0, 2, z], anim: (t, c) => { const a = Math.sin(t * sp + ph) * 1.0; c.pos.set(Math.sin(a) * 5.6, 8 - Math.cos(a) * 5.6, z); c.quat.setFromAxisAngle(FWD, a); rod.position.set(Math.sin(a) * 2.75, 8 - Math.cos(a) * 2.75, z); rod.quaternion.setFromAxisAngle(FWD, a); } });
    });
    // spinning discs
    const d1 = B.cyl(5, 0.8, '#6ad0ff', { pos: [0, -0.4, 90], anim: (t, c) => c.quat.setFromAxisAngle(UP, t * 0.7) });
    const d2 = B.cyl(5, 0.8, '#ffb0e0', { pos: [0, -0.4, 101.5], anim: (t, c) => c.quat.setFromAxisAngle(UP, -t * 0.8) });
    for (const [d, w, n] of [[d1, 0.7, 3], [d2, -0.8, 4]]) for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2; B.cyl(0.5, 1.6, '#ffffff', { pos: [0, 0.8, d.pos.z], anim: (t, c) => { const a = a0 + w * t; c.pos.set(Math.sin(a) * 3, 0.8, d.pos.z + Math.cos(a) * 3); } }); }
    // the conveyor ramp up to the finish
    const ang = Math.atan2(3, 12);
    B.box(12, 1, Math.hypot(12, 3), '#ffe46a', { pos: [0, 1.0, 112.5], rot: [-ang, 0, 0], conveyor: [0, -2.2], stripes: '#ffd23a' });
    B.box(14, 1, 14, '#ff8ad0', { pos: [0, 2.5, 125.5], stripes: '#ff6ab8' });
    finishArch(B, 122, 3, 12);
    return Object.assign(B, { finishZ: 122, finishY: 2, killY: -8,
      spawn: (i) => [((i % 5) - 2) * 2.2, 0.1, 3 + Math.floor(i / 5) * 2.4, 0],
      checkpoints: [[0, 6], [42, 39.5], [58, 60], [86, 84.5], [96, 95.2, 90], [106.5, 107]].map(([z, sz, dz]) => ({ z, at: [0, 0.2, sz] })),
      waypoints: [{ z: 18 }, { z: 41.5 }, ...plats.map(p => ({ z: p.pos.z, plat: p })), { z: 60 }, { z: 85 }, { z: 89, x: 0 }, { z: 94.6, jump: true }, { z: 101.5 }, { z: 106.6, jump: true }, { z: 124 }],
    });
  },
};

// ================================================================ round 2: door dash (race)
const doorDash = {
  id: 'doors', name: '真假門門', type: 'race', icon: '🚪', desc: '每一排門有真有假，假的撞得破、真的撞不開。猜對就衝過去！',
  sky: ['#9ae0ff', '#fff0c8'],
  build(scene, seed) {
    const B = new Builder(scene), R = rng(seed);
    slimeSea(B, -9, '#8ad0ff'); scenery(B, 9, 110);
    B.box(16, 1, 16, '#ffd06a', { pos: [0, -0.5, 6], stripes: '#ffc040' });
    startArch(B, 13.5, 14);
    B.box(16, 1, 80, '#ffffff', { pos: [0, -0.5, 54], stripes: '#e8f4ff' });
    for (const x of [-8.3, 8.3]) B.box(0.6, 1.4, 80, '#6ad0ff', { pos: [x, 0.7, 54] });
    const rows = [], fakes = [3, 3, 2, 2, 1];
    [24, 38, 52, 66, 80].forEach((z, r) => {
      const xs = [-6, -3, 0, 3, 6], order = xs.map((x, i) => [R(), i]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
      const fake = new Set(order.slice(0, fakes[r]));
      for (const x of [-7.75, -4.5, -1.5, 1.5, 4.5, 7.75]) B.box(x === -7.75 || x === 7.75 ? 0.5 : 0.4, 3.2, 0.6, '#ff6ab0', { pos: [x, 1.6, z] });
      const doors = xs.map((x, i) => {
        const col = ['#ffd23a', '#7ae0ff', '#a0ff8a', '#ffb07a', '#d0a0ff'][(i + r) % 5];
        const d = B.box(2.6, 3.0, 0.45, col, { pos: [x, 1.5, z], ghost: fake.has(i) });
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), toon('#ffffff')); knob.position.set(0.8, 0, 0.3); d.mesh.add(knob);
        return { x, z, fake: fake.has(i), c: d, broken: false };
      });
      rows.push({ z, doors });
    });
    // bouncy mushrooms between rows
    for (let k = 0; k < 6; k++) { const z = 30 + k * 9 + R() * 3; B.cyl(1.1, 0.4, '#ff5a7a', { pos: [(R() - 0.5) * 11, 0.2, z], bouncy: 12 }); }
    B.box(16, 1, 14, '#a0ff8a', { pos: [0, -0.5, 100], stripes: '#80f070' });
    finishArch(B, 97, 0, 14);
    B.update((t, dt, bodies) => {
      for (const row of rows) for (const d of row.doors) {
        if (d.fake && !d.broken && bodies.some(b => Math.abs(b.pos.z - d.z) < 0.9 && Math.abs(b.pos.x - d.x) < 1.4 && b.pos.y < 3)) { d.broken = true; d.bt = 0; B.onBreak?.(d); }
        if (d.broken && d.bt < 1.2) { d.bt += dt; const m = d.c.mesh; m.rotation.x = Math.min(Math.PI / 2, d.bt * 3); m.position.y = 1.5 - Math.min(1.3, d.bt * 2); m.position.z = d.z + Math.min(1.4, d.bt * 2); if (d.bt > 0.9) m.visible = false; }
      }
    });
    return Object.assign(B, { finishZ: 97, finishY: -1, killY: -8, rows,
      spawn: (i) => [((i % 5) - 2) * 2.4, 0.1, 3 + Math.floor(i / 5) * 2.4, 0],
      checkpoints: [{ z: 0, at: [0, 0.2, 6] }, ...[24, 38, 52, 66, 80].map(z => ({ z: z + 1, at: [0, 0.2, z + 2.5] }))],
      waypoints: [{ z: 20 }, ...rows.map(r => ({ z: r.z + 1.5, row: r })), { z: 100 }],
    });
  },
};

// ================================================================ survival: jump spin
const jumpSpin = {
  id: 'jump', name: '跳跳轉盤', type: 'survival', icon: '🤸', desc: '低的棒子要跳過去、高的棒子別撞上！越轉越快，被掃下去就淘汰。',
  sky: ['#ffb0d8', '#fff2c8'],
  build(scene, seed) {
    const B = new Builder(scene), R = rng(seed);
    slimeSea(B, -8, '#8a7aff'); scenery(B, 14, 20);
    B.cyl(10, 1, '#ffe46a', { pos: [0, -0.5, 0] }, 64);
    const ring = B.deco(new THREE.Mesh(new THREE.TorusGeometry(10, 0.3, 8, 64), toon('#ff6ab0'))); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
    B.cyl(1.3, 4.6, '#ffffff', { pos: [0, 2.3, 0] });
    const lowA = (t) => 0.9 * t + 0.014 * t * t, highA = (t) => -0.55 * t - 0.008 * t * t + 1.2;
    const low = B.box(20.5, 0.7, 0.7, '#ff4a6a', { pos: [0, 0.5, 0], anim: (t, c) => c.quat.setFromAxisAngle(UP, lowA(Math.min(t, 70))) });
    const high = B.box(20.5, 0.7, 0.7, '#4a8aff', { pos: [0, 2.35, 0], anim: (t, c) => c.quat.setFromAxisAngle(UP, highA(Math.min(t, 70))) });
    return Object.assign(B, { killY: -6, timeLimit: 75, low, high, lowA, highA,
      spawn: (i, n) => { const a = i / Math.max(1, n) * Math.PI * 2 + 0.3; return [Math.sin(a) * 6.5, 0.1, Math.cos(a) * 6.5, a + Math.PI]; },
    });
  },
};

// ================================================================ final: hex fall
const hexFall = {
  id: 'hex', name: '蜂巢墜落', type: 'survival', final: true, icon: '🐝', desc: '踩過的地板會掉下去！三層地板，最後還站著的人就是冠軍！',
  sky: ['#6a8aff', '#ffd0f0'],
  build(scene, seed) {
    const B = new Builder(scene);
    slimeSea(B, -24, '#ff6ab0'); scenery(B, 14, 20);
    const tiles = []; const cols = ['#ffd23a', '#6ad0ff', '#ff8ad0'];
    const geo = new THREE.CylinderGeometry(1.0, 1.0, 0.6, 6);
    [0, -7, -14].forEach((y, L) => {
      const N = 6;
      for (let q = -N; q <= N; q++) for (let r = -N; r <= N; r++) {
        if (Math.abs(q + r) > N) continue;
        const x = 1.78 * (q + r / 2), z = 1.54 * r;
        const c = new Cyl(0.92, 0.3, { pos: [x, y - 0.3, z], rot: [0, Math.PI / 6, 0], tag: 'hex' });
        B.add(c, new THREE.Mesh(geo, toon(cols[L]).clone()));
        c.id = tiles.length; c.layer = L; c.fallAt = 0; c.base = y - 0.3; tiles.push(c);
      }
    });
    B.update((t, dt) => {
      for (const c of tiles) {
        if (!c.fallAt) continue;
        const k = t - c.fallAt;
        if (k > -0.55 && k < 0) { c.mesh.material.emissive.setRGB(0.6, 0.2, 0.2); c.mesh.position.x = c.pos.x + Math.sin(t * 60) * 0.05; }
        if (k >= 0) { c.active = false; c.mesh.position.y = c.base - k * k * 9; c.mesh.visible = k < 1.5; }
      }
    });
    return Object.assign(B, { killY: -21, tiles, timeLimit: 180,
      spawn: (i, n) => { const a = i / Math.max(1, n) * Math.PI * 2; const rr = 3 + (i % 2) * 2.5; return [Math.sin(a) * rr, 0.2, Math.cos(a) * rr, a + Math.PI]; },
    });
  },
};

const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
export const LEVELS = { spin: spinRoad, doors: doorDash, jump: jumpSpin, hex: hexFall };
export const RACES = ['spin', 'doors'], SURVIVALS = ['jump'];
