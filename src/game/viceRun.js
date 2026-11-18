// Vice Run: a small top-down shooter for the "VI" sidebar button (src/components/ViceRunOverlay.tsx).
// No libraries; one requestAnimationFrame loop that exists only between start() and stop().

const WORLD_W = 3200;
const WORLD_H = 2200;
const BLOCK = 300; // city block + street pitch
const STREET = 110;
const BEACH_X = 2500; // sand from here, ocean from OCEAN_X
const OCEAN_X = 2700;
const BEST_KEY = 'freedom_vicerun_best';

const C = {
  purple: '#1a0b3b',
  pink: '#ff2e88',
  orange: '#ff8a3d',
  teal: '#18e0d0',
  asphalt: '#2a1850',
  sand: '#e8b77a',
  ocean: '#0d4f7a',
};

const SIGNS = ['MALIBU', 'OCEAN', 'NEON', 'PINK', 'TROPIC', 'DISCO', 'VICE', 'SUNSET', 'CLUB'];
const MAG = 12;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** City layout: buildings (solid), palms and neon signs (decor). Generated once per game. */
function buildCity() {
  const buildings = [];
  const signs = [];
  const palms = [];
  for (let bx = 0; bx + BLOCK <= BEACH_X; bx += BLOCK) {
    for (let by = 0; by + BLOCK <= WORLD_H; by += BLOCK) {
      const x = bx + STREET / 2;
      const y = by + STREET / 2;
      const s = BLOCK - STREET;
      if (Math.random() < 0.12) {
        // a small park instead of a building
        for (let i = 0; i < 3; i++) palms.push({ x: x + rand(20, s - 20), y: y + rand(20, s - 20), r: rand(16, 22) });
        continue;
      }
      // one or two buildings per block
      if (Math.random() < 0.5) {
        buildings.push({ x, y, w: s, h: s, hue: Math.random() });
      } else {
        const half = s / 2 - 6;
        buildings.push({ x, y, w: s, h: half, hue: Math.random() });
        buildings.push({ x, y: y + half + 12, w: s, h: half, hue: Math.random() });
      }
      if (Math.random() < 0.55) {
        signs.push({ x: x + s / 2, y: y + 14, text: SIGNS[Math.floor(Math.random() * SIGNS.length)], color: Math.random() < 0.5 ? C.pink : C.teal });
      }
    }
  }
  for (let y = 60; y < WORLD_H; y += 140) palms.push({ x: BEACH_X + rand(40, 160), y: y + rand(-30, 30), r: rand(16, 22) });
  return { buildings, signs, palms };
}

function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  return false;
}

/** Moves a circle, sliding along walls instead of stopping dead. */
function move(city, o, dx, dy) {
  const nx = clamp(o.x + dx, o.r, WORLD_W - o.r);
  if (!hitsBuilding(city, nx, o.y, o.r)) o.x = nx;
  const ny = clamp(o.y + dy, o.r, WORLD_H - o.r);
  if (!hitsBuilding(city, o.x, ny, o.r)) o.y = ny;
}

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(v) {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage unavailable: the record lives for this session only */
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ labels?: Record<string, string> }} [opts]
 */
export function createViceRun(canvas, opts = {}) {
  const L = {
    health: 'HP',
    ammo: 'AMMO',
    score: 'SCORE',
    wave: 'WAVE',
    best: 'BEST',
    reloading: 'RELOADING…',
    gameOver: 'WASTED',
    playAgain: 'Play again',
    hint: 'WASD — move · mouse — aim/shoot · R — reload · Esc — exit',
    ...opts.labels,
  };
  const ctx = canvas.getContext('2d');
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let raf = 0;
  let last = 0;
  let running = false;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let state;
  let againBtn = null;

  function reset() {
    state = {
      city: buildCity(),
      player: { x: BEACH_X - 60, y: WORLD_H / 2, r: 12, hp: 100, mag: MAG, reserve: 48, reload: 0, cooldown: 0, hurt: 0 },
      enemies: [],
      bullets: [],
      pickups: [],
      particles: [],
      score: 0,
      wave: 0,
      waveDelay: 1.2,
      best: readBest(),
      over: false,
      cam: { x: 0, y: 0 },
    };
    // never start inside a wall
    while (hitsBuilding(state.city, state.player.x, state.player.y, state.player.r)) state.player.y += 20;
  }

  /** A free street point away from the player. */
  function spawnPoint(minDist) {
    const p = state.player;
    for (let i = 0; i < 60; i++) {
      const x = rand(30, BEACH_X + 150);
      const y = rand(30, WORLD_H - 30);
      if ((x - p.x) ** 2 + (y - p.y) ** 2 < minDist * minDist) continue;
      if (!hitsBuilding(state.city, x, y, 16)) return { x, y };
    }
    return { x: 40, y: 40 };
  }

  function startWave() {
    state.wave += 1;
    const n = 2 + state.wave * 2;
    for (let i = 0; i < n; i++) {
      const pt = spawnPoint(520);
      state.enemies.push({
        ...pt,
        r: 12,
        hp: 30 + state.wave * 6,
        speed: 105 + state.wave * 7 + rand(-10, 10),
        cooldown: rand(0.8, 2),
        hurt: 0,
      });
    }
    for (let i = 0; i < 2; i++) {
      state.pickups.push({ ...spawnPoint(150), kind: i === 0 ? 'ammo' : 'health' });
    }
  }

  function shoot(from, tx, ty, enemy) {
    const a = Math.atan2(ty - from.y, tx - from.x) + rand(-0.05, 0.05) * (enemy ? 2 : 1);
    const speed = enemy ? 420 : 760;
    state.bullets.push({ x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1.1, enemy });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 180);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.5), color });
    }
  }

  function startReload() {
    const p = state.player;
    if (p.reload > 0 || p.mag === MAG || p.reserve === 0) return;
    p.reload = 1.1;
  }

  function update(dt) {
    const s = state;
    const p = s.player;
    s.particles = s.particles.filter((q) => (q.life -= dt) > 0);
    for (const q of s.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    if (s.over) return;

    // player
    const mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    const len = Math.hypot(mx, my) || 1;
    const swim = p.x > OCEAN_X ? 0.5 : 1;
    move(s.city, p, (mx / len) * 230 * swim * dt, (my / len) * 230 * swim * dt);
    p.hurt = Math.max(0, p.hurt - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) {
        const take = Math.min(MAG - p.mag, p.reserve);
        p.mag += take;
        p.reserve -= take;
        p.reload = 0;
      }
    }
    const aimX = mouse.x + s.cam.x;
    const aimY = mouse.y + s.cam.y;
    if (mouse.down && p.cooldown === 0 && p.reload === 0) {
      if (p.mag > 0) {
        shoot(p, aimX, aimY, false);
        p.mag -= 1;
        p.cooldown = 0.16;
        if (p.mag === 0) startReload();
      } else {
        startReload();
      }
    }

    // enemies chase and shoot back
    for (const e of s.enemies) {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.hurt = Math.max(0, e.hurt - dt);
      if (d > 140) move(s.city, e, (dx / d) * e.speed * dt, (dy / d) * e.speed * dt);
      e.cooldown -= dt;
      if (e.cooldown <= 0 && d < 430) {
        shoot(e, p.x, p.y, true);
        e.cooldown = Math.max(0.55, 1.7 - s.wave * 0.09) + rand(0, 0.5);
      }
    }

    // bullets
    for (const b of s.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (hitsBuilding(s.city, b.x, b.y, 2)) {
        b.life = 0;
        burst(b.x, b.y, C.orange, 3);
        continue;
      }
      if (b.enemy) {
        if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < p.r * p.r) {
          b.life = 0;
          p.hp -= 8 + s.wave;
          p.hurt = 0.25;
          burst(p.x, p.y, C.pink, 6);
        }
      } else {
        for (const e of s.enemies) {
          if (e.hp > 0 && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < e.r * e.r) {
            b.life = 0;
            e.hp -= 20;
            e.hurt = 0.15;
            burst(e.x, e.y, C.teal, 5);
            if (e.hp <= 0) {
              s.score += 100 + s.wave * 10;
              burst(e.x, e.y, C.orange, 14);
              if (Math.random() < 0.3) s.pickups.push({ x: e.x, y: e.y, kind: Math.random() < 0.5 ? 'ammo' : 'health' });
            }
            break;
          }
        }
      }
    }
    s.bullets = s.bullets.filter((b) => b.life > 0);
    s.enemies = s.enemies.filter((e) => e.hp > 0);

    // pickups
    s.pickups = s.pickups.filter((k) => {
      if ((k.x - p.x) ** 2 + (k.y - p.y) ** 2 > 26 * 26) return true;
      if (k.kind === 'health') p.hp = Math.min(100, p.hp + 35);
      else p.reserve += 24;
      return false;
    });

    if (p.hp <= 0) {
      p.hp = 0;
      s.over = true;
      if (s.score > s.best) {
        s.best = s.score;
        writeBest(s.score);
      }
      return;
    }

    if (s.enemies.length === 0) {
      s.waveDelay -= dt;
      if (s.waveDelay <= 0) {
        startWave();
        s.waveDelay = 2;
      }
    }

    s.cam.x = clamp(p.x - w / 2, 0, Math.max(0, WORLD_W - w));
    s.cam.y = clamp(p.y - h / 2, 0, Math.max(0, WORLD_H - h));
  }

  function drawPalm(x, y, r) {
    ctx.fillStyle = '#3b2412';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f9e6e';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.6, r * 0.22, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    const s = state;
    const p = s.player;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.purple;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-Math.round(s.cam.x), -Math.round(s.cam.y));

    // ground: asphalt, beach, ocean
    ctx.fillStyle = C.asphalt;
    ctx.fillRect(0, 0, BEACH_X, WORLD_H);
    ctx.fillStyle = C.sand;
    ctx.fillRect(BEACH_X, 0, OCEAN_X - BEACH_X, WORLD_H);
    ctx.fillStyle = C.ocean;
    ctx.fillRect(OCEAN_X, 0, WORLD_W - OCEAN_X, WORLD_H);
    ctx.strokeStyle = 'rgba(24,224,208,0.35)';
    ctx.lineWidth = 2;
    const t = performance.now() / 1000;
    for (let y = 20; y < WORLD_H; y += 46) {
      ctx.beginPath();
      for (let x = OCEAN_X; x <= WORLD_W; x += 40) ctx.lineTo(x, y + Math.sin(x / 60 + t * 2 + y) * 5);
      ctx.stroke();
    }
    // lane markings
    ctx.strokeStyle = 'rgba(255,138,61,0.35)';
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    for (let x = 0; x <= BEACH_X; x += BLOCK) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
    }
    for (let y = 0; y <= WORLD_H; y += BLOCK) {
      ctx.moveTo(0, y);
      ctx.lineTo(BEACH_X, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // buildings (only those in view)
    const vx0 = s.cam.x - 50;
    const vy0 = s.cam.y - 50;
    const vx1 = s.cam.x + w + 50;
    const vy1 = s.cam.y + h + 50;
    for (const b of s.city.buildings) {
      if (b.x > vx1 || b.y > vy1 || b.x + b.w < vx0 || b.y + b.h < vy0) continue;
      ctx.fillStyle = b.hue < 0.33 ? '#3a1d6e' : b.hue < 0.66 ? '#4a1a5c' : '#24305e';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = b.hue < 0.5 ? 'rgba(255,46,136,0.6)' : 'rgba(24,224,208,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    }
    for (const k of s.city.palms) if (k.x > vx0 && k.x < vx1 && k.y > vy0 && k.y < vy1) drawPalm(k.x, k.y, k.r);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    for (const g of s.city.signs) {
      if (g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = g.color;
      ctx.fillText(g.text, g.x, g.y);
    }
    ctx.shadowBlur = 0;

    // pickups
    for (const k of s.pickups) {
      ctx.fillStyle = k.kind === 'health' ? '#ffffff' : C.orange;
      ctx.fillRect(k.x - 9, k.y - 9, 18, 18);
      ctx.fillStyle = k.kind === 'health' ? C.pink : C.purple;
      if (k.kind === 'health') {
        ctx.fillRect(k.x - 2, k.y - 6, 4, 12);
        ctx.fillRect(k.x - 6, k.y - 2, 12, 4);
      } else {
        ctx.fillRect(k.x - 5, k.y - 5, 3, 10);
        ctx.fillRect(k.x - 1, k.y - 5, 3, 10);
        ctx.fillRect(k.x + 3, k.y - 5, 3, 10);
      }
    }

    // enemies
    for (const e of s.enemies) {
      ctx.fillStyle = e.hurt > 0 ? '#ffffff' : C.orange;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18);
      ctx.stroke();
    }

    // player
    const aim = Math.atan2(mouse.y + s.cam.y - p.y, mouse.x + s.cam.x - p.x);
    ctx.shadowColor = C.teal;
    ctx.shadowBlur = 14;
    ctx.fillStyle = p.hurt > 0 ? C.pink : C.teal;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(aim) * 20, p.y + Math.sin(aim) * 20);
    ctx.stroke();

    // bullets and particles
    for (const b of s.bullets) {
      ctx.fillStyle = b.enemy ? C.pink : '#fff6a8';
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    }
    for (const q of s.particles) {
      ctx.globalAlpha = Math.min(1, q.life * 3);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - 2, q.y - 2, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    drawHud();
    if (!s.over) {
      // crosshair
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2);
      ctx.moveTo(mouse.x - 13, mouse.y);
      ctx.lineTo(mouse.x - 4, mouse.y);
      ctx.moveTo(mouse.x + 4, mouse.y);
      ctx.lineTo(mouse.x + 13, mouse.y);
      ctx.moveTo(mouse.x, mouse.y - 13);
      ctx.lineTo(mouse.x, mouse.y - 4);
      ctx.moveTo(mouse.x, mouse.y + 4);
      ctx.lineTo(mouse.x, mouse.y + 13);
      ctx.stroke();
    }
  }

  function drawHud() {
    const s = state;
    const p = s.player;
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = 'rgba(26,11,59,0.75)';
    ctx.fillRect(12, 12, 230, 74);
    // health bar
    ctx.fillStyle = '#3a1d6e';
    ctx.fillRect(22, 22, 150, 12);
    const grad = ctx.createLinearGradient(22, 0, 172, 0);
    grad.addColorStop(0, C.orange);
    grad.addColorStop(1, C.pink);
    ctx.fillStyle = grad;
    ctx.fillRect(22, 22, (150 * p.hp) / 100, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${L.health} ${Math.ceil(p.hp)}`, 180, 33);
    ctx.fillStyle = p.mag === 0 ? C.pink : C.teal;
    ctx.fillText(p.reload > 0 ? L.reloading : `${L.ammo} ${p.mag}/${p.reserve}`, 22, 56);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${L.wave} ${s.wave}`, 22, 77);

    ctx.textAlign = 'right';
    ctx.font = 'bold 22px sans-serif';
    ctx.shadowColor = C.pink;
    ctx.shadowBlur = 10;
    ctx.fillStyle = C.pink;
    ctx.fillText(String(s.score).padStart(6, '0'), w - 60, 38);
    ctx.shadowBlur = 0;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`${L.best} ${s.best}`, w - 60, 56);
    ctx.textAlign = 'center';
    ctx.fillText(L.hint, w / 2, h - 14);

    againBtn = null;
    if (s.over) {
      ctx.fillStyle = 'rgba(26,11,59,0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 64px sans-serif';
      ctx.shadowColor = C.pink;
      ctx.shadowBlur = 24;
      ctx.fillStyle = C.pink;
      ctx.fillText(L.gameOver, w / 2, h / 2 - 50);
      ctx.shadowBlur = 0;
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${L.score} ${s.score} · ${L.best} ${s.best}`, w / 2, h / 2);
      againBtn = { x: w / 2 - 90, y: h / 2 + 28, w: 180, h: 44 };
      const g = ctx.createLinearGradient(againBtn.x, 0, againBtn.x + againBtn.w, 0);
      g.addColorStop(0, C.orange);
      g.addColorStop(1, C.pink);
      ctx.fillStyle = g;
      ctx.fillRect(againBtn.x, againBtn.y, againBtn.w, againBtn.h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(L.playAgain, w / 2, againBtn.y + 28);
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  // Physical keys (e.code), so WASD and R work on any layout (Cyrillic "цфыв" too)
  const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyR', 'Enter', 'NumpadEnter', 'Space'];
  const onKeyDown = (e) => {
    if (!GAME_KEYS.includes(e.code) || e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault();
    keys.add(e.code);
    if (e.code === 'KeyR' && !state.over) startReload();
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && state.over) reset();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  };
  const onDown = (e) => {
    if (e.button !== 0) return;
    onMove(e);
    canvas.focus();
    if (state.over) {
      const b = againBtn;
      if (b && mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h) reset();
      return;
    }
    mouse.down = true;
  };
  const onUp = () => {
    mouse.down = false;
  };
  const onBlur = () => {
    keys.clear();
    mouse.down = false;
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;

  reset();

  return {
    start() {
      if (running) return;
      running = true;
      resize();
      ro?.observe(canvas);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('blur', onBlur);
      canvas.focus();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    /** Stops the loop and drops every listener: a closed game costs nothing. */
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onBlur);
      onBlur();
    },
  };
}
