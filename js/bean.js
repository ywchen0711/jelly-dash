// Jelly beans: a squishy capsule with big eyes, little arms and feet, a pattern and a hat, plus a name tag.
import * as THREE from '../lib/three.module.min.js';
import { toon } from './levels.js';

export const COLORS = ['#ff6ab0', '#ffd23a', '#6ad0ff', '#8aff7a', '#c89aff', '#ff8a4a', '#ffffff', '#ff4a5a', '#4ae0c0', '#7a8aff', '#ffb0d8', '#3a3a4a'];
export const PATTERNS = ['solid', 'band', 'top', 'dots', 'stripes'];
export const PATTERN_N = { solid: '單色', band: '腰帶', top: '雙色', dots: '點點', stripes: '條紋' };
export const HATS = ['none', 'crown', 'cap', 'ears', 'propeller', 'bow', 'horn', 'chef'];
export const HAT_N = { none: '無', crown: '皇冠', cap: '棒球帽', ears: '貓耳', propeller: '竹蜻蜓', bow: '蝴蝶結', horn: '獨角', chef: '廚師帽' };
const NAMES = ['小果凍', '布丁', '糖糖', '豆豆', '軟軟', 'QQ', '麻糬', '湯圓', '奶酪', '果果', '泡泡', '彈彈', '圓仔', '蜜豆', '芋圓', '小熊軟糖', '跳跳', '咕嚕', '嘟嘟', '啾啾'];
export function randomLook(r = Math.random) { return { color: COLORS[r() * COLORS.length | 0], color2: COLORS[r() * COLORS.length | 0], pattern: PATTERNS[r() * PATTERNS.length | 0], hat: HATS[r() * HATS.length | 0] }; }
export function botName(i) { return NAMES[i % NAMES.length] + (i >= NAMES.length ? i : ''); }

export class Bean {
  constructor(look, name, opts = {}) {
    this.look = look; this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    const c1 = look.color, c2 = look.color2 === look.color ? '#ffffff' : look.color2;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.7, 6, 18), toon(c1)); torso.position.y = 0.95; torso.castShadow = true; this.body.add(torso); this.torso = torso;
    // pattern
    if (look.pattern === 'band') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.515, 0.515, 0.22, 24, 1, true), toon(c2, { side: THREE.DoubleSide })); b.position.y = 0.8; this.body.add(b); }
    if (look.pattern === 'top') { const t = new THREE.Mesh(new THREE.SphereGeometry(0.515, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(c2)); t.position.y = 1.3; this.body.add(t); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.515, 0.515, 0.25, 24, 1, true), toon(c2, { side: THREE.DoubleSide })); r.position.y = 1.18; this.body.add(r); }
    if (look.pattern === 'dots') for (let i = 0; i < 9; i++) { const a = i * 2.4, y = 0.55 + (i % 3) * 0.38; if (Math.cos(a) > 0.55 && y > 1) continue; const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toon(c2)); d.position.set(Math.sin(a) * 0.48, y, Math.cos(a) * 0.48); d.scale.set(1, 1, 0.4); d.lookAt(d.position.x * 3, y, d.position.z * 3); this.body.add(d); }
    if (look.pattern === 'stripes') for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.512, 0.512, 0.09, 24, 1, true), toon(c2, { side: THREE.DoubleSide })); b.position.y = 0.55 + k * 0.22; this.body.add(b); }
    // face: a visor-shaped patch with big eyes
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 12, -0.95, 1.9, 0.9, 1.0), toon('#fff4ea')); face.position.set(0, 1.18, 0.17); face.scale.set(1, 0.85, 1); this.body.add(face);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), toon('#1a1a2a')); e.position.set(s * 0.13, 1.24, 0.5); e.scale.set(1, 1.35, 0.6); this.body.add(e);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); h.position.set(s * 0.13 + 0.025, 1.28, 0.535); this.body.add(h);
    }
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI), toon('#c83a5a')); this.mouth.position.set(0, 1.08, 0.5); this.mouth.rotation.z = Math.PI; this.body.add(this.mouth);
    // arms and feet
    this.arms = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.5, 1.0, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.28, 4, 8), toon(c1)); a.position.y = -0.2; g.add(a); this.body.add(g); return g; });
    this.feet = [-1, 1].map(s => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), toon(c1)); f.scale.set(1, 0.6, 1.3); f.position.set(s * 0.2, 0.1, 0.05); f.castShadow = true; this.root.add(f); return f; });
    this.hat(look.hat);
    // name tag
    if (name) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
      g.font = 'bold 34px "PingFang TC","Microsoft JhengHei",sans-serif'; const w = Math.min(250, g.measureText(name).width + 28);
      g.fillStyle = opts.me ? 'rgba(255,90,170,0.92)' : 'rgba(20,20,40,0.6)'; g.beginPath(); g.roundRect(128 - w / 2, 8, w, 48, 24); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 33);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); this.tag.scale.set(2.2, 0.55, 1); this.tag.position.y = 2.35; this.tag.renderOrder = 10; this.root.add(this.tag);
    }
    this.t = Math.random() * 10; this.squash = 0; this.spin = 0;
  }
  hat(kind) {
    const H = new THREE.Group(); H.position.y = 1.68; this.body.add(H);
    if (kind === 'crown') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.22, 10, 1, true), toon('#ffd23a', { side: THREE.DoubleSide })); c.position.y = 0.05; H.add(c); for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), toon('#ffd23a')); const a = i / 5 * Math.PI * 2; s.position.set(Math.sin(a) * 0.26, 0.22, Math.cos(a) * 0.26); H.add(s); } const j = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), toon('#ff3a6a')); j.position.set(0, 0.06, 0.27); H.add(j); }
    if (kind === 'cap') { const c = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#ff4a5a')); c.position.y = -0.18; H.add(c); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16, 1, false, -Math.PI / 2, Math.PI), toon('#ff4a5a')); b.position.set(0, -0.15, 0.3); H.add(b); }
    if (kind === 'ears') for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 4), toon(this.look.color)); e.position.set(s * 0.24, -0.02, 0); e.rotation.z = -s * 0.35; H.add(e); const i = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), toon('#ffb0d0')); i.position.set(s * 0.24, -0.03, 0.05); i.rotation.z = -s * 0.35; H.add(i); }
    if (kind === 'propeller') { const c = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#6ad0ff')); c.position.y = -0.12; H.add(c); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), toon('#888')); st.position.y = 0.12; H.add(st); this.prop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.1), toon('#ffd23a')); this.prop.position.y = 0.22; H.add(this.prop); }
    if (kind === 'bow') { for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 4), toon('#ff6ab0')); w.rotation.z = s * Math.PI / 2; w.position.set(s * 0.14, -0.05, 0.12); H.add(w); } const k = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), toon('#ff3a8a')); k.position.set(0, -0.05, 0.12); H.add(k); H.position.x = 0.22; }
    if (kind === 'horn') { const h = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.38, 10), toon('#fff4a0')); h.position.set(0, 0.08, 0.15); h.rotation.x = 0.3; H.add(h); }
    if (kind === 'chef') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.22, 14), toon('#ffffff')); b.position.y = -0.04; H.add(b); for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), toon('#ffffff')); p.position.set(Math.sin(i * 1.57) * 0.12, 0.16, Math.cos(i * 1.57) * 0.12); H.add(p); } }
  }
  // pose the bean from its body state
  update(dt, st) {
    this.t += dt; const t = this.t, b = this.body, anim = st.anim;
    this.root.position.set(st.x, st.y, st.z);
    let dy = st.yaw - this.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.root.rotation.y += dy * Math.min(1, dt * 14);
    this.squash *= Math.exp(-dt * 10);
    let tilt = 0, bob = 0, armA = 0.2, foot = 0, roll = 0;
    if (anim === 'run') { const p = t * 14; bob = Math.abs(Math.sin(p)) * 0.08; tilt = 0.18; roll = Math.sin(p) * 0.08; armA = Math.sin(p) * 0.9; foot = Math.sin(p) * 0.25; }
    else if (anim === 'air') { armA = 2.6; tilt = 0.05; }
    else if (anim === 'dive') { tilt = 1.35; armA = 3.0; }
    else if (anim === 'tumble') { this.spin += dt * 12; tilt = this.spin; armA = 2.2 + Math.sin(t * 20); }
    else { bob = Math.sin(t * 3) * 0.015; armA = 0.15 + Math.sin(t * 3) * 0.05; }
    if (anim !== 'tumble') this.spin = 0;
    b.rotation.set(tilt, 0, roll); b.position.y = bob;
    const sq = 1 + this.squash; b.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.arms[0].rotation.set(-armA, 0, 0.3); this.arms[1].rotation.set(anim === 'run' ? armA : -armA, 0, -0.3);
    this.feet[0].position.z = 0.05 + foot; this.feet[1].position.z = 0.05 - foot;
    this.feet[0].visible = this.feet[1].visible = anim !== 'dive' && anim !== 'tumble';
    if (this.prop) this.prop.rotation.y += dt * (anim === 'air' ? 30 : 8);
  }
  pop(k) { this.squash = k; }
}
