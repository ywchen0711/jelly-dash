// Keyboard, mouse and touch. Movement is a stick (x right, y forward); jump and dive are buttons; dragging turns the camera.
export class Input {
  constructor(canvas) {
    this.keys = new Set(); this.stick = { x: 0, y: 0 }; this.jumpP = false; this.diveP = false; this.camDX = 0; this.camDY = 0;
    this.touchy = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.jumpP = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE' || e.code === 'KeyJ') this.diveP = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // mouse drag turns the camera
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('pointermove', (e) => { if (drag && e.pointerType === 'mouse') { this.camDX += e.clientX - drag.x; this.camDY += e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; } });
    addEventListener('pointerup', () => drag = null);
    if (this.touchy) this.bindTouch();
  }
  bindTouch() {
    const pad = document.getElementById('tpad'), knob = document.getElementById('tknob'), zone = document.getElementById('tzone'), look = document.getElementById('tlook');
    let sid = null, cx = 0, cy = 0, lid = null, lx = 0, ly = 0;
    zone.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sid = t.identifier; cx = t.clientX; cy = t.clientY; pad.style.left = cx + 'px'; pad.style.top = cy + 'px'; pad.classList.add('on'); e.preventDefault(); }, { passive: false });
    zone.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { let dx = t.clientX - cx, dy = t.clientY - cy; const d = Math.hypot(dx, dy), R = 55; if (d > R) { dx *= R / d; dy *= R / d; } this.stick.x = dx / R; this.stick.y = -dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; } e.preventDefault(); }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; this.stick.x = this.stick.y = 0; knob.style.transform = ''; pad.classList.remove('on'); } };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    look.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; lid = t.identifier; lx = t.clientX; ly = t.clientY; e.preventDefault(); }, { passive: false });
    look.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === lid) { this.camDX += (t.clientX - lx) * 1.3; this.camDY += (t.clientY - ly) * 1.3; lx = t.clientX; ly = t.clientY; } e.preventDefault(); }, { passive: false });
    look.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === lid) lid = null; });
    for (const [id, k] of [['tjump', 'jumpP'], ['tdive', 'diveP']]) {
      const b = document.getElementById(id);
      b.addEventListener('touchstart', (e) => { this[k] = true; b.classList.add('down'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
      b.addEventListener('touchend', () => b.classList.remove('down'));
    }
  }
  // read once per frame
  poll() {
    const K = this.keys;
    let x = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    let y = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0);
    if (this.stick.x || this.stick.y) { x = this.stick.x; y = this.stick.y; }
    if (K.has('KeyQ')) this.camDX -= 6; if (K.has('KeyR')) this.camDX += 6;
    const out = { x, y, jump: this.jumpP || K.has('Space'), jumpP: this.jumpP, dive: this.diveP, camDX: this.camDX, camDY: this.camDY };
    this.jumpP = false; this.diveP = false; this.camDX = 0; this.camDY = 0;
    return out;
  }
}
