// Jelly Dash: an online party obstacle-course game. One browser hosts the show (rounds, bots, who qualifies);
// everyone moves their own bean and sends where it is. Solo play is the same show with only bots.
import * as THREE from '../lib/three.module.min.js';
import { Body, separate } from './physics.js';
import { LEVELS, RACES, SURVIVALS, toon } from './levels.js';
import { Bean, COLORS, PATTERNS, PATTERN_N, HATS, HAT_N, randomLook, botName } from './bean.js';
import { HostNet, ClientNet, makeCode } from './net.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { botInput } from './bots.js';

const $ = (s) => document.querySelector(s);
const ANIMS = ['idle', 'run', 'air', 'dive', 'tumble'];
const now = () => performance.now() / 1000;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const PROFILE = 'jellydash-profile';

class Game {
  constructor() {
    const canvas = $('#view');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#c8a0d8', 1.4); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.2); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 120; this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);
    this.input = new Input(canvas); this.snd = new Sound();
    document.body.classList.toggle('touchy', this.input.touchy);
    addEventListener('pointerdown', () => this.snd.init()); addEventListener('keydown', () => this.snd.init());
    this.me = this.loadProfile();
    this.role = null; this.net = null; this.myId = 'me';
    this.roster = new Map(); this.total = 10; this.show = null; this.round = null; this.ents = new Map();
    this.camYaw = 0; this.camPitch = 0.5; this.camDist = 8.5; this.camPos = new THREE.Vector3(0, 5, -8); this.camLook = new THREE.Vector3();
    this.off = 0; this.offN = 0; this.sendT = 0; this.spec = 0; this.fx = [];
    addEventListener('resize', () => this.resize()); this.resize();
    this.bindUI(); this.titleStage();
    // a room link (#CODE) jumps straight into joining
    const code = location.hash.replace('#', '').toUpperCase(); if (/^[A-Z2-9]{5}$/.test(code)) { $('#joincode').value = code; }
    this.last = now(); requestAnimationFrame(() => this.loop());
    window.JD = this;
  }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 1 ? 72 : 60; this.camera.updateProjectionMatrix(); }
  hostNow() { return this.role === 'client' ? now() + this.off : now(); }

  // ================================================================ profile and title
  loadProfile() {
    try { const p = JSON.parse(localStorage.getItem(PROFILE)); if (p?.look) return p; } catch (e) { /* none */ }
    return { name: '果凍' + (100 + Math.floor(Math.random() * 900)), look: randomLook() };
  }
  saveProfile() { try { localStorage.setItem(PROFILE, JSON.stringify(this.me)); } catch (e) { /* private mode */ } }
  titleStage() {
    this.clearRound();
    this.stage = LEVELS.jump.build(this.scene, 7); this.scene.background = new THREE.Color('#ffc8e4'); this.scene.fog = new THREE.Fog('#ffd8ec', 40, 160);
    this.preview = new Bean(this.me.look, null); this.preview.root.position.set(0, 0, 5); this.scene.add(this.preview.root);
    this.mode = 'title'; this.showScreen('title'); this.refreshTitle();
  }
  refreshTitle() {
    $('#pname').value = this.me.name;
    if (this.preview) { this.scene.remove(this.preview.root); }
    this.preview = new Bean(this.me.look, null); this.preview.root.position.set(0, 0, 5); this.scene.add(this.preview.root);
    $('#lk-color').style.background = this.me.look.color; $('#lk-color2').style.background = this.me.look.color2;
    $('#lk-pattern').textContent = PATTERN_N[this.me.look.pattern]; $('#lk-hat').textContent = HAT_N[this.me.look.hat];
  }
  bindUI() {
    const cyc = (arr, v, d) => arr[(arr.indexOf(v) + d + arr.length) % arr.length];
    const L = () => this.me.look;
    const on = (sel, f) => $(sel).addEventListener('click', (e) => { this.snd.init(); this.snd.sfx('click'); f(e); });
    on('#lk-color', () => { L().color = cyc(COLORS, L().color, 1); this.saveProfile(); this.refreshTitle(); });
    on('#lk-color2', () => { L().color2 = cyc(COLORS, L().color2, 1); this.saveProfile(); this.refreshTitle(); });
    on('#lk-pattern', () => { L().pattern = cyc(PATTERNS, L().pattern, 1); this.saveProfile(); this.refreshTitle(); });
    on('#lk-hat', () => { L().hat = cyc(HATS, L().hat, 1); this.saveProfile(); this.refreshTitle(); });
    on('#lk-random', () => { this.me.look = randomLook(); this.saveProfile(); this.refreshTitle(); });
    $('#pname').addEventListener('input', (e) => { this.me.name = e.target.value.trim().slice(0, 10) || '果凍'; this.saveProfile(); });
    on('#btn-solo', () => this.startSolo());
    on('#btn-host', () => this.startHost());
    on('#btn-join', () => { const c = $('#joincode').value.trim().toUpperCase(); if (!/^[A-Z2-9]{5}$/.test(c)) { this.toast('請輸入5個字的房間代碼'); return; } this.startJoin(c); });
    on('#btn-start', () => this.hostStartShow());
    on('#btn-leave', () => this.leave());
    on('#btn-copy', () => { const url = location.origin + location.pathname + '#' + this.code; (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => this.toast('已複製邀請連結！'), () => this.toast(url)); });
    on('#bots-minus', () => { this.total = Math.max(Math.max(2, this.humans().length), this.total - 1); this.lobbyUI(); this.broadcastRoster(); });
    on('#bots-plus', () => { this.total = Math.min(20, this.total + 1); this.lobbyUI(); this.broadcastRoster(); });
    on('#btn-quit', () => { if (confirm('離開這場遊戲？')) this.leave(); });
    on('#btn-mute', () => { this.snd.musicOn = !this.snd.musicOn; $('#btn-mute').textContent = this.snd.musicOn ? '🔊' : '🔇'; this.snd.music(this.snd.musicOn && this.mode === 'play', this.round?.L?.final); });
    on('#btn-help', () => $('#help').classList.toggle('on'));
    on('#help', () => $('#help').classList.remove('on'));
  }
  showScreen(k) { for (const s of ['title', 'lobby', 'hud']) $('#' + s).classList.toggle('on', s === k || (k === 'play' && s === 'hud')); document.body.dataset.mode = k; }
  toast(t, ms = 2200) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('#toasts').appendChild(d); setTimeout(() => d.classList.add('out'), ms); setTimeout(() => d.remove(), ms + 500); }

  // ================================================================ rooms
  humans() { return [...this.roster.values()].filter(p => !p.bot); }
  startSolo() { this.role = 'solo'; this.myId = 'me'; this.code = null; this.roster = new Map([['me', { id: 'me', name: this.me.name, look: this.me.look }]]); this.total = 10; this.openLobby(); }
  startHost() {
    this.role = 'host'; this.myId = 'host'; this.total = 8; this.code = makeCode();
    this.roster = new Map([['host', { id: 'host', name: this.me.name, look: this.me.look, host: true }]]);
    this.openLobby(); $('#lobby-status').textContent = '正在建立房間…';
    this.net = new HostNet(this.code, {
      onOpen: () => { $('#lobby-status').textContent = '房間開好了！把代碼或連結傳給朋友。'; },
      onJoin: () => { },
      onMsg: (cid, m) => this.hostMsg(cid, m),
      onLeave: (cid) => this.dropPlayer(cid),
      onError: (k) => { if (k === 'taken') { this.net.close(); this.startHost(); return; } $('#lobby-status').textContent = k === 'nopeer' ? '連線元件載入失敗，請重新整理' : '連線出了點問題（' + k + '），可以先單人玩'; },
    });
    this.net.start();
  }
  startJoin(code) {
    this.role = 'client'; this.code = code; this.myId = null; this.roster = new Map();
    this.openLobby(); $('#lobby-status').textContent = '正在加入房間 ' + code + '…';
    this.net = new ClientNet(code, {
      onOpen: () => { this.net.send({ t: 'hello', name: this.me.name, look: this.me.look }); this.ping(); this.pingT = setInterval(() => this.ping(), 2000); },
      onMsg: (m) => this.clientMsg(m),
      onClose: () => { this.toast('和房主的連線中斷了'); this.leave(true); },
      onError: (k) => { $('#lobby-status').textContent = k === 'noroom' ? '找不到這個房間，代碼對嗎？房主還開著嗎？' : k === 'nopeer' ? '連線元件載入失敗，請重新整理' : '連線出了點問題（' + k + '）'; },
    });
    this.net.start();
  }
  ping() { this.net?.send({ t: 'png', c: now() }); }
  leave(silent) {
    clearInterval(this.pingT); this.net?.close(); this.net = null; this.role = null; this.show = null;
    clearTimeout(this.showTimer); this.snd.music(false); history.replaceState(null, '', location.pathname);
    this.titleStage();
  }
  openLobby() { this.clearRound(); this.titleBackdrop(); this.mode = 'lobby'; this.showScreen('lobby'); this.lobbyUI(); }
  titleBackdrop() {
    if (!this.stage) { this.stage = LEVELS.jump.build(this.scene, 7); this.scene.background = new THREE.Color('#ffc8e4'); this.scene.fog = new THREE.Fog('#ffd8ec', 40, 160); }
    if (!this.preview) { this.preview = new Bean(this.me.look, null); this.preview.root.position.set(0, 0, 5); this.scene.add(this.preview.root); }
  }
  lobbyUI() {
    const isHost = this.role !== 'client';
    $('#lobby-code').textContent = this.code || '單人遊玩';
    $('#lobby-share').style.display = this.code ? '' : 'none';
    $('#lobby-hostctl').style.display = isHost ? '' : 'none';
    $('#lobby-wait').style.display = isHost ? 'none' : '';
    const hs = this.humans(); const bots = Math.max(0, this.total - hs.length);
    $('#bots-n').textContent = `${this.total} 人（電腦 ${bots}）`;
    $('#lobby-list').innerHTML = hs.map(p => `<li><i style="background:${p.look.color}"></i>${esc(p.name)}${p.host ? ' 👑' : ''}${p.id === this.myId ? '（你）' : ''}</li>`).join('') + (bots ? `<li class="bot"><i></i>電腦玩家 ×${bots}</li>` : '');
    if (this.role === 'solo') $('#lobby-status').textContent = '和電腦一起比賽！調整人數後按開始。';
  }
  broadcastRoster() { if (this.role !== 'host') return; this.net.all({ t: 'roster', list: this.humans().map(p => ({ id: p.id, name: p.name, look: p.look, host: p.host })), total: this.total }); }
  dropPlayer(cid) {
    const p = this.roster.get(cid); if (!p) return; this.roster.delete(cid);
    this.toast(`${p.name} 離開了`); this.broadcastRoster(); if (this.mode === 'lobby') this.lobbyUI();
    if (this.round && !this.round.over) { const e = this.ents.get(cid); if (e) { this.scene.remove(e.bean.root); this.ents.delete(cid); } this.markOut(cid, true); }
    if (this.show) this.show.alive = this.show.alive.filter(i => i !== cid);
  }
  // ---------------------------------------------------------------- host messages
  hostMsg(cid, m) {
    if (m.t === 'hello') {
      if (this.humans().length >= 20) { this.net.send(cid, { t: 'full' }); return; }
      this.roster.set(cid, { id: cid, name: String(m.name || '果凍').slice(0, 10), look: m.look || randomLook() });
      this.total = Math.max(this.total, this.humans().length);
      this.net.send(cid, { t: 'welcome', id: cid, code: this.code });
      this.broadcastRoster(); this.lobbyUI(); this.toast(`${m.name} 加入了！`); this.snd.sfx('qual');
      if (this.round && !this.round.over) this.net.send(cid, { ...this.round.msg, spectate: true });
      return;
    }
    if (m.t === 'png') { this.net.send(cid, { t: 'pog', c: m.c, h: now() }); return; }
    const e = this.ents.get(cid);
    if (m.t === 'st' && e) { e.target = m.p; e.tAnim = m.a; e.tYaw = m.y; return; }
    if (m.t === 'fin') return this.markQual(cid);
    if (m.t === 'out') return this.markOut(cid);
    if (m.t === 'tile') return this.dropTile(m.i);
  }
  // ---------------------------------------------------------------- client messages
  clientMsg(m) {
    switch (m.t) {
      case 'welcome': this.myId = m.id; $('#lobby-status').textContent = '已加入！等房主開始遊戲。'; history.replaceState(null, '', '#' + this.code); break;
      case 'full': $('#lobby-status').textContent = '房間滿了'; break;
      case 'roster': this.roster = new Map(m.list.map(p => [p.id, p])); this.total = m.total; if (this.mode === 'lobby') this.lobbyUI(); break;
      case 'pog': { const rtt = now() - m.c, off = m.h + rtt / 2 - now(); this.off = this.offN ? this.off * 0.8 + off * 0.2 : off; this.offN++; break; }
      case 'round': this.onRound(m); break;
      case 's': for (const [id, x, y, z, yaw, a] of m.p) { if (id === this.myId) continue; const e = this.ents.get(id); if (e) { e.target = [x, y, z]; e.tYaw = yaw; e.tAnim = a; } } break;
      case 'qual': this.onQual(m.id); break;
      case 'out': this.onOut(m.id); break;
      case 'tile': { const c = this.round?.L?.tiles?.[m.i]; if (c && (!c.fallAt || c.fallAt > m.at)) c.fallAt = m.at; break; }
      case 'end': this.onEnd(m); break;
      case 'champ': this.onChamp(m); break;
      case 'lobby': this.openLobby(); break;
    }
  }
  send(m) { if (this.role === 'client') this.net?.send(m); else if (this.role === 'host') this.net?.all(m); }

  // ================================================================ the show (host and solo)
  hostStartShow() {
    if (this.role === 'client') return;
    const hs = this.humans(); const bots = Math.max(0, this.total - hs.length);
    if (hs.length + bots < 2) { this.toast('至少要2個人'); return; }
    const parts = hs.map(p => p.id);
    this.botInfo = new Map();
    for (let i = 0; i < bots; i++) { const id = 'b' + i; this.botInfo.set(id, { id, name: botName(Math.floor(Math.random() * 40) + i * 3), look: randomLook(), bot: true, skill: 0.45 + Math.random() * 0.55 }); parts.push(id); }
    this.show = { alive: parts, played: 0, pool: shuffle([...RACES, ...SURVIVALS]) };
    this.hostRound();
  }
  hostRound() {
    const S = this.show, n = S.alive.length;
    const id = n <= 3 || S.played >= 3 ? 'hex' : S.pool[S.played % S.pool.length];
    const L = LEVELS[id];
    const q = L.final ? 1 : Math.max(1, Math.min(n - 1, Math.round(n * (L.type === 'race' ? 0.62 : 0.55))));
    const people = S.alive.map(pid => { const p = this.roster.get(pid) || this.botInfo.get(pid); return [pid, p.name, p.look, !!p.bot]; });
    const msg = { t: 'round', id, seed: Math.random() * 1e9 | 0, t0: now() + 7.5, q, people, no: S.played + 1 };
    S.played++;
    this.send(msg); this.onRound(msg);
  }
  // ---------------------------------------------------------------- every peer: build the round
  onRound(m) {
    this.clearRound();
    const L = LEVELS[m.id].build(this.scene, m.seed);
    L.onBreak = () => this.snd.sfx('door');
    const D = LEVELS[m.id];
    this.scene.background = new THREE.Color(D.sky[0]); this.scene.fog = new THREE.Fog(D.sky[1], 60, 220);
    this.round = { msg: { ...m, spectate: undefined }, id: m.id, D, L, t0: m.t0, q: m.q, qual: [], out: [], over: false, no: m.no };
    const ids = m.people.map(p => p[0]);
    m.people.forEach(([id, name, look, bot], i) => {
      const [x, y, z, yaw] = L.spawn(i, ids.length);
      const body = new Body(x, y, z); body.yaw = yaw; body.events = [];
      const mine = id === this.myId;
      const bean = new Bean(look, name, { me: mine }); this.scene.add(bean.root);
      const localSim = mine || (bot && this.role !== 'client');
      body.remote = !localSim;
      this.ents.set(id, { id, name, bot, body, bean, local: localSim, mine, mem: {}, skill: this.botInfo?.get(id)?.skill, cp: 0, done: false, target: [x, y, z], tYaw: yaw, tAnim: 0 });
      if (mine) this.camYaw = yaw;
    });
    if (!this.ents.has(this.myId)) this.spec = 0;
    this.mode = 'play'; this.showScreen('play');
    this.card(D);
    $('#results').classList.remove('on');
    this.snd.music(false); this.lastCount = null;
    this.hud();
  }
  clearRound() {
    for (const e of this.ents.values()) this.scene.remove(e.bean.root);
    this.ents.clear();
    if (this.round?.L) this.round.L.dispose();
    if (this.stage) { this.stage.dispose(); this.stage = null; }
    if (this.preview) { this.scene.remove(this.preview.root); this.preview = null; }
    for (const f of this.fx) this.scene.remove(f.pts); this.fx = [];
    this.round = null;
  }
  card(D) {
    const c = $('#card');
    c.innerHTML = `<div class="cd-no">第 ${this.round.no} 回合${D.final ? '・決賽' : ''}</div><div class="cd-ic">${D.icon}</div><h2>${D.name}</h2><p>${D.desc}</p><div class="cd-goal">${D.type === 'race' ? `前 <b>${this.round.q}</b> 名晉級` : D.final ? '最後站著的人獲勝！' : `留下 <b>${this.round.q}</b> 人就結束`}</div>`;
    c.classList.add('on'); clearTimeout(this.cardT); this.cardT = setTimeout(() => c.classList.remove('on'), 3800);
  }
  // ---------------------------------------------------------------- qualifying and elimination (host decides, everyone shows)
  markQual(id) {
    const R = this.round; if (!R || R.over || R.qual.includes(id) || R.D.type !== 'race') return;
    R.qual.push(id); this.send({ t: 'qual', id }); this.onQual(id, true);
    if (R.qual.length >= R.q) this.hostEnd();
  }
  markOut(id, gone) {
    const R = this.round; if (!R || R.over || R.out.includes(id) || R.qual.includes(id)) return;
    R.out.push(id); this.send({ t: 'out', id }); this.onOut(id, true);
    if (R.D.type === 'survival') { const alive = [...this.ents.keys()].filter(i => !R.out.includes(i)); if (alive.length <= R.q) this.hostEnd(); }
    else if (gone) { const left = [...this.ents.keys()].filter(i => !R.out.includes(i) && !R.qual.includes(i)); if (!left.length) this.hostEnd(); }
  }
  onQual(id, local) {
    const R = this.round; if (!R) return; if (!local && !R.qual.includes(id)) R.qual.push(id);
    const e = this.ents.get(id); if (e) { e.done = true; this.confetti(e.body.pos, e.bean.look.color); }
    if (id === this.myId) { this.big('晉級！', '#5aff8a'); this.snd.sfx('qual'); }
    this.hud();
  }
  onOut(id, local) {
    const R = this.round; if (!R) return; if (!local && !R.out.includes(id)) R.out.push(id);
    const e = this.ents.get(id); if (e) e.done = true;
    if (id === this.myId) { this.big('淘汰了…', '#ff6a8a'); this.snd.sfx('out'); this.spec = 0; }
    else if (R.D.type === 'survival') this.feed(`${e?.name || ''} 淘汰！`);
    this.hud();
  }
  dropTile(i) {
    const R = this.round, c = R?.L?.tiles?.[i]; if (!c || c.fallAt) return;
    c.fallAt = this.roundTime() + 0.6; this.send({ t: 'tile', i, at: c.fallAt });
  }
  hostEnd() {
    const R = this.round; if (!R || R.over || this.role === 'client') return;
    const ids = [...this.ents.keys()];
    let qual;
    if (R.D.type === 'race') qual = [...R.qual];
    else { qual = ids.filter(i => !R.out.includes(i)); if (!qual.length) qual = R.out.slice(-1); }
    if (R.D.final && qual.length > 1) qual = [qual[Math.random() * qual.length | 0]];
    const elim = ids.filter(i => !qual.includes(i));
    const m = { t: 'end', qual, elim };
    this.send(m); this.onEnd(m);
    this.showTimer = setTimeout(() => {
      this.show.alive = qual.filter(i => this.roster.has(i) || this.botInfo.has(i));
      if (R.D.final || this.show.alive.length <= 1) { const c = { t: 'champ', ids: this.show.alive }; this.send(c); this.onChamp(c); }
      else this.hostRound();
    }, 5200);
  }
  onEnd(m) {
    const R = this.round; if (!R) return; R.over = true; R.qual = m.qual;
    this.snd.music(false);
    const name = (id) => esc(this.ents.get(id)?.name || this.roster.get(id)?.name || '?');
    const me = this.myId;
    const res = $('#results');
    res.innerHTML = `<div class="rs-box"><h3>${R.D.icon} ${R.D.name} 結束</h3>
      <div class="rs-cols"><div><h4>晉級 ${m.qual.length}</h4><ol>${m.qual.map(id => `<li class="${id === me ? 'me' : ''}">${name(id)}</li>`).join('')}</ol></div>
      <div><h4>淘汰 ${m.elim.length}</h4><ul>${m.elim.map(id => `<li class="out ${id === me ? 'me' : ''}">${name(id)}</li>`).join('')}</ul></div></div>
      <p class="rs-next">${R.D.final ? '' : '下一回合即將開始…'}</p></div>`;
    res.classList.add('on');
    if (this.ents.has(me)) { if (m.qual.includes(me)) { if (!R.D.final) this.big('晉級！', '#5aff8a'); } else if (!R.out.includes(me)) { this.big('淘汰了…', '#ff6a8a'); this.snd.sfx('out'); } }
  }
  onChamp(m) {
    $('#results').classList.remove('on');
    const id = m.ids[0], e = this.ents.get(id), name = esc(e?.name || this.roster.get(id)?.name || '冠軍');
    this.champ = id; this.mode = 'champ';
    $('#champ').innerHTML = `<div class="ch-crown">👑</div><h2>${name}</h2><p>${id === this.myId ? '你是冠軍！太厲害了！' : '獲得冠軍！'}</p>`;
    $('#champ').classList.add('on'); this.snd.sfx('win');
    if (e) for (let k = 0; k < 6; k++) setTimeout(() => this.confetti(e.body.pos, ['#ff6ab0', '#ffd23a', '#6ad0ff', '#8aff7a'][k % 4]), k * 400);
    clearTimeout(this.champT);
    this.champT = setTimeout(() => {
      $('#champ').classList.remove('on'); this.champ = null;
      if (this.role === 'host') { this.send({ t: 'lobby' }); }
      if (this.role !== 'client') { this.show = null; }
      if (this.role) this.openLobby();
    }, 8000);
  }

  // ================================================================ the frame
  roundTime() { return this.round ? this.hostNow() - this.round.t0 : 0; }
  loop() {
    requestAnimationFrame(() => this.loop());
    const t = now(), dt = Math.min(0.05, t - this.last); this.last = t;
    const inp = this.input.poll();
    if (this.mode === 'play' || this.mode === 'champ') this.play(dt, inp);
    else this.titleFrame(dt);
    for (const f of this.fx) this.stepFx(f, dt);
    this.fx = this.fx.filter(f => f.life > 0 || (this.scene.remove(f.pts), false));
    this.renderer.render(this.scene, this.camera);
  }
  titleFrame(dt) {
    this.tt = (this.tt || 0) + dt;
    if (this.stage) { for (const c of this.stage.colliders) c.step(this.tt, dt); for (const u of this.stage.updaters) u(this.tt, dt, []); }
    if (this.preview) { this.preview.update(dt, { x: 0, y: 0, z: 5, yaw: Math.sin(this.tt * 0.7) * 0.6, anim: 'idle' }); if (Math.random() < dt * 0.3) this.preview.pop(0.25); }
    const mob = innerWidth < innerHeight;
    // the bean stands left of the menu panel (above it on phones)
    if (mob) { this.camera.position.set(0, 2.6, 10.5); this.camera.lookAt(0, 0.2, 5); } else { this.camera.position.set(2.2, 1.6, 9.6); this.camera.lookAt(2.2, 1.1, 5); }
    this.sun.position.set(8, 20, 14); this.sun.target.position.set(0, 0, 5);
  }
  play(dt, inp) {
    const R = this.round; if (!R) return;
    const L = R.L, T = this.roundTime(), Tc = Math.max(0, T);
    // obstacles move on the shared clock
    for (const c of L.colliders) c.step(Tc, dt);
    const ents = [...this.ents.values()], bodies = ents.map(e => e.body);
    for (const u of L.updaters) u(Tc, dt, bodies);
    // countdown
    const cd = Math.ceil(-T);
    if (T < 0 && T > -3.2 && cd !== this.lastCount && cd <= 3) { this.lastCount = cd; this.big(String(cd), '#ffffff', 700); this.snd.sfx('count'); }
    if (T >= 0 && this.lastCount !== 0 && this.lastCount !== null) { this.lastCount = 0; this.big('GO!', '#ffd23a', 800); this.snd.sfx('go'); this.snd.music(true, R.D.final); }
    // camera turning
    this.camYaw -= inp.camDX * 0.006; this.camPitch = Math.max(0.05, Math.min(1.2, this.camPitch + inp.camDY * 0.004));
    const fwd = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)), right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    for (const e of ents) {
      const b = e.body;
      if (e.local) {
        if (e.done && R.D.type === 'survival') { e.bean.root.visible = false; continue; }
        let input = { x: 0, z: 0 };
        if (T >= 0 && !R.over) {
          if (e.mine) { input = { x: fwd.x * inp.y + right.x * inp.x, z: fwd.z * inp.y + right.z * inp.x, jump: inp.jumpP, dive: inp.dive }; }
          else if (e.bot) input = botInput(e, L, T, dt, ents);
        }
        if (T < 0) { b.vel.set(0, Math.min(0, b.vel.y), 0); }
        b.step(dt, input, L);
        for (const ev of b.events.splice(0)) { if (e.mine || (Math.abs(b.pos.x - this.camLook.x) + Math.abs(b.pos.z - this.camLook.z) < 14)) this.snd.sfx(ev); if (ev === 'jump' || ev === 'dive') e.bean.pop(0.22); if (ev === 'land') e.bean.pop(-0.25); }
        this.rules(e, T);
      } else {
        // someone else's bean: glide toward where they said they are
        const [x, y, z] = e.target, k = 1 - Math.exp(-dt * 14);
        if (Math.hypot(x - b.pos.x, y - b.pos.y, z - b.pos.z) > 6) b.pos.set(x, y, z); else { b.pos.x += (x - b.pos.x) * k; b.pos.y += (y - b.pos.y) * k; b.pos.z += (z - b.pos.z) * k; }
        b.yaw = e.tYaw; b.anim = ANIMS[e.tAnim] || 'idle';
        if (e.done && R.D.type === 'survival') { e.bean.root.visible = false; continue; }
      }
      e.bean.root.visible = true;
      e.bean.update(dt, { x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: b.yaw, anim: b.anim });
    }
    separate(bodies);
    // network
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / 15;
      if (this.role === 'client') { const me = this.ents.get(this.myId); if (me && !me.done) this.net.send({ t: 'st', p: [+me.body.pos.x.toFixed(2), +me.body.pos.y.toFixed(2), +me.body.pos.z.toFixed(2)], y: +me.body.yaw.toFixed(2), a: ANIMS.indexOf(me.body.anim) }); }
      if (this.role === 'host') this.net.all({ t: 's', p: ents.map(e => [e.id, +e.body.pos.x.toFixed(2), +e.body.pos.y.toFixed(2), +e.body.pos.z.toFixed(2), +e.body.yaw.toFixed(2), ANIMS.indexOf(e.body.anim)]) });
    }
    // time limits (host)
    if (this.role !== 'client' && !R.over && T > (L.timeLimit || 150)) this.hostEnd();
    this.follow(dt, inp);
    this.hud(T);
  }
  // falling, checkpoints, finishing, tiles: each peer checks the beans it moves
  rules(e, T) {
    const R = this.round, L = R.L, b = e.body;
    if (R.D.type === 'race') {
      if (!e.done) { const cps = L.checkpoints; while (e.cp < cps.length - 1 && b.pos.z > cps[e.cp + 1].z) e.cp++; }
      if (b.pos.y < L.killY) { const at = L.checkpoints[e.cp].at; b.pos.set(at[0] + (Math.random() - 0.5) * 3, at[1] + 1, at[2]); b.vel.set(0, 0, 0); b.stun = 0; b.dive = 0; if (e.mine) { this.snd.sfx('fall'); this.camYaw = 0; } }
      if (!e.done && !R.over && b.pos.z > L.finishZ && b.pos.y > L.finishY) { e.done = true; if (this.role === 'client') this.net.send({ t: 'fin' }); else this.markQual(e.id); }
    } else {
      if (!e.done && !R.over && b.pos.y < L.killY) { e.done = true; if (e.mine) this.snd.sfx('fall'); if (this.role === 'client') this.net.send({ t: 'out' }); else this.markOut(e.id); }
      if (L.tiles && b.grounded && b.ground?.tag === 'hex' && !b.ground.fallAt && T >= 0) {
        const c = b.ground; if (this.role === 'client') { c.fallAt = T + 0.6; this.net.send({ t: 'tile', i: c.id }); } else this.dropTile(c.id);
        if (e.mine) this.snd.sfx('tile');
      }
    }
  }
  follow(dt, inp) {
    const R = this.round;
    let e = this.ents.get(this.myId);
    const watching = !e || (e.done && R.D.type === 'survival') || this.mode === 'champ';
    if (this.mode === 'champ' && this.champ) e = this.ents.get(this.champ);
    else if (watching) {
      const live = [...this.ents.values()].filter(x => !x.done || R.D.type === 'race');
      if (inp.jumpP && live.length) this.spec++;
      e = live[this.spec % Math.max(1, live.length)] || e;
    }
    $('#spec').style.display = watching && this.mode !== 'champ' && e ? '' : 'none';
    if (watching && e) $('#spec').innerHTML = `觀戰中：<b>${esc(e.name)}</b>　${this.input.touchy ? '點跳躍' : '按空白鍵'}換人`;
    if (!e) return;
    const p = e.body.pos;
    const target = new THREE.Vector3(p.x, p.y + 1.3, p.z);
    this.camLook.lerp(target, 1 - Math.exp(-dt * 10));
    const d = this.mode === 'champ' ? 5 : this.camDist, pitch = this.mode === 'champ' ? 0.25 : this.camPitch, yaw = this.mode === 'champ' ? e.body.yaw + Math.PI : this.camYaw;
    const want = new THREE.Vector3(this.camLook.x - Math.sin(yaw) * Math.cos(pitch) * d, this.camLook.y + Math.sin(pitch) * d, this.camLook.z - Math.cos(yaw) * Math.cos(pitch) * d);
    this.camPos.lerp(want, 1 - Math.exp(-dt * 8));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    this.sun.position.set(p.x + 12, p.y + 30, p.z + 8); this.sun.target.position.set(p.x, p.y, p.z);
  }
  hud(T) {
    const R = this.round; if (!R) return;
    const total = this.ents.size;
    let s;
    if (R.D.type === 'race') s = `晉級 <b>${R.qual.length}</b> / ${R.q}`;
    else { const alive = total - R.out.length; s = R.D.final ? `剩下 <b>${alive}</b> 人` : `剩下 <b>${alive}</b> 人・目標 ${R.q}`; }
    const left = Math.max(0, Math.ceil((R.L.timeLimit || 150) - Math.max(0, T || 0)));
    const html = `<span class="h-name">${R.D.icon} ${R.D.name}</span><span class="h-stat">${s}</span><span class="h-time">⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span>`;
    if (html !== this.hudHtml) { $('#hud-top').innerHTML = html; this.hudHtml = html; }
  }
  big(text, color, ms = 1400) { const b = $('#big'); b.textContent = text; b.style.color = color; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); clearTimeout(this.bigT); this.bigT = setTimeout(() => b.classList.remove('on'), ms); }
  feed(t) { const d = document.createElement('div'); d.textContent = t; $('#feed').prepend(d); setTimeout(() => d.remove(), 3000); while ($('#feed').children.length > 4) $('#feed').lastChild.remove(); }
  // confetti bursts
  confetti(pos, color) {
    const n = 70, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 3), v = [];
    const cols = [color, '#ffffff', '#ffd23a', '#6ad0ff', '#ff6ab0'].map(x => new THREE.Color(x));
    for (let i = 0; i < n; i++) { p.set([pos.x, pos.y + 1.5, pos.z], i * 3); const k = cols[i % cols.length]; c.set([k.r, k.g, k.b], i * 3); v.push([(Math.random() - 0.5) * 9, 5 + Math.random() * 8, (Math.random() - 0.5) * 9]); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.28, vertexColors: true })); this.scene.add(pts);
    this.fx.push({ pts, v, life: 2.5 });
  }
  stepFx(f, dt) {
    f.life -= dt; const a = f.pts.geometry.attributes.position.array;
    for (let i = 0; i < f.v.length; i++) { const v = f.v[i]; v[1] -= 12 * dt; v[0] *= 0.98; v[2] *= 0.98; a[i * 3] += v[0] * dt; a[i * 3 + 1] += v[1] * dt; a[i * 3 + 2] += v[2] * dt; }
    f.pts.geometry.attributes.position.needsUpdate = true;
  }
}

new Game();
