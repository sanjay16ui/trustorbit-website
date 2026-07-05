/* ======================================================
   TrustOrbit — Premium App JS
   All original functionality preserved.
   Added: animated gradient BG, mouse-reactive particles,
          scroll-reveal, skeleton loading, spring results,
          drop pulse, prefers-reduced-motion guard.
   ====================================================== */

'use strict';

const API_URL = 'https://fireapi-production-304a.up.railway.app/predict';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════════════════════════════════════════════
   DOM REFS (identical to original)
══════════════════════════════════════════════════════ */
const navbar          = document.getElementById('navbar');
const uploadZone      = document.getElementById('uploadZone');
const fileInput       = document.getElementById('fileInput');
const uploadIdle      = document.getElementById('uploadIdle');
const uploadPreview   = document.getElementById('uploadPreview');
const previewImg      = document.getElementById('previewImg');
const fileNameEl      = document.getElementById('fileName');
const changeBtn       = document.getElementById('changeBtn');
const analyzeBtn      = document.getElementById('analyzeBtn');
const btnText         = analyzeBtn.querySelector('.btn-text');
const btnLoading      = analyzeBtn.querySelector('.btn-loading');

const resultsPlaceholder = document.getElementById('resultsPlaceholder');
const resultsSkeleton    = document.getElementById('resultsSkeleton');
const resultsError       = document.getElementById('resultsError');
const resultsContent     = document.getElementById('resultsContent');
const errorMsg           = document.getElementById('errorMsg');
const retryBtn           = document.getElementById('retryBtn');
const newAnalysisBtn     = document.getElementById('newAnalysisBtn');

const predictionBadge = document.getElementById('predictionBadge');
const predictionIcon  = document.getElementById('predictionIcon');
const predictionLabel = document.getElementById('predictionLabel');
const alertBadge      = document.getElementById('alertBadge');
const alertDot        = document.getElementById('alertDot');
const alertLabel      = document.getElementById('alertLabel');
const confValue       = document.getElementById('confValue');
const confBarFill     = document.getElementById('confBarFill');
const confBarTrack    = document.getElementById('confBarTrack');
const reasoningText   = document.getElementById('reasoningText');
const ledgerHash      = document.getElementById('ledgerHash');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundOnIcon    = soundToggleBtn?.querySelector('.sound-on-icon');
const soundOffIcon   = soundToggleBtn?.querySelector('.sound-off-icon');
const soundLabel     = document.getElementById('soundToggleLabel');

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let selectedFile = null;
let isMuted      = false;

/* ══════════════════════════════════════════════════════
   1. ANIMATED GRADIENT BACKGROUND CANVAS
══════════════════════════════════════════════════════ */
(function initGradient() {
  const canvas = document.getElementById('gradientCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let w, h, t = 0;

  function resize() {
    w = canvas.width  = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Color stops that slowly cycle: navy → deep purple → dark crimson → back
  const stops = [
    { r: 5,   g: 8,   b: 28  },   // deep navy
    { r: 12,  g: 5,   b: 30  },   // deep violet
    { r: 20,  g: 4,   b: 20  },   // dark purple
    { r: 25,  g: 6,   b: 10  },   // dark crimson
    { r: 10,  g: 5,   b: 22  },   // back to violet
  ];

  function lerpColor(a, b, t) {
    return {
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t,
    };
  }

  function getColor(progress) {
    const n   = stops.length;
    const raw = progress * n;
    const i   = Math.floor(raw) % n;
    const frac = raw - Math.floor(raw);
    return lerpColor(stops[i], stops[(i + 1) % n], frac);
  }

  function draw() {
    if (REDUCED) { ctx.fillStyle = '#07091a'; ctx.fillRect(0, 0, w, h); return; }

    t += 0.0008;

    const c1 = getColor(t % 1);
    const c2 = getColor((t + 0.35) % 1);
    const c3 = getColor((t + 0.6)  % 1);

    // Base gradient
    const grad = ctx.createRadialGradient(w * .3, h * .25, 0, w * .5, h * .5, w * .9);
    grad.addColorStop(0, `rgb(${c1.r|0},${c1.g|0},${c1.b|0})`);
    grad.addColorStop(0.5, `rgb(${c2.r|0},${c2.g|0},${c2.b|0})`);
    grad.addColorStop(1,   `rgb(${c3.r|0},${c3.g|0},${c3.b|0})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle fire accent orb top-right
    const ox = w * (.7 + .08 * Math.sin(t * 1.3));
    const oy = h * (.2 + .06 * Math.cos(t * .9));
    const orb = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * .35);
    orb.addColorStop(0,   `rgba(200,60,10,${.1 + .04 * Math.sin(t * 2)})`);
    orb.addColorStop(0.5, 'rgba(100,20,50,.04)');
    orb.addColorStop(1,   'transparent');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, w, h);

    // Subtle violet orb bottom-left
    const vx = w * (.15 + .05 * Math.cos(t * .7));
    const vy = h * (.75 + .06 * Math.sin(t * 1.1));
    const vorb = ctx.createRadialGradient(vx, vy, 0, vx, vy, w * .3);
    vorb.addColorStop(0,   `rgba(80,20,160,${.08 + .03 * Math.cos(t * 1.8)})`);
    vorb.addColorStop(1,   'transparent');
    ctx.fillStyle = vorb;
    ctx.fillRect(0, 0, w, h);
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* ══════════════════════════════════════════════════════
   2. MOUSE-REACTIVE PARTICLE CANVAS (hero only)
══════════════════════════════════════════════════════ */
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas || REDUCED) return;

  const ctx  = canvas.getContext('2d');
  const hero = canvas.closest('.hero') || document.querySelector('.hero');

  let W, H;
  function resize() {
    W = canvas.width  = hero ? hero.offsetWidth  : window.innerWidth;
    H = canvas.height = hero ? hero.offsetHeight : window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Mouse tracking (relative to hero)
  let mouse = { x: W / 2, y: H / 2 };
  document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }, { passive: true });

  // Particle pool
  const PALETTE = [
    [249, 115,  22],   // fire orange
    [251, 146,  60],   // lighter orange
    [245, 158,  11],   // amber
    [239,  68,  68],   // red
    [139,  92, 246],   // violet
    [255, 255, 255],   // white spark
  ];

  class Particle {
    constructor() { this.reset(true); }

    reset(initial = false) {
      this.x    = Math.random() * W;
      this.y    = initial ? Math.random() * H : H + 10;
      this.size = Math.random() * 2.8 + 0.8;
      this.vx   = (Math.random() - 0.5) * 0.4;
      this.vy   = -(Math.random() * 0.9 + 0.3);
      this.life = 0;
      this.maxLife = Math.random() * 220 + 120;
      this.col  = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      this.drift = (Math.random() - 0.5) * 0.008;
    }

    update() {
      this.life++;
      this.x += this.vx;
      this.y += this.vy;
      this.vx += this.drift;

      // Faint attraction toward mouse (within radius)
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 160) {
        const force = (160 - dist) / 160 * 0.012;
        this.vx += dx / dist * force;
        this.vy += dy / dist * force;
      }

      if (this.life >= this.maxLife || this.y < -20) this.reset();
    }

    draw(ctx) {
      const progress = this.life / this.maxLife;
      let alpha;
      if (progress < 0.15)      alpha = progress / 0.15;
      else if (progress > 0.75) alpha = 1 - (progress - 0.75) / 0.25;
      else                       alpha = 1;
      alpha *= 0.65;

      const [r, g, b] = this.col;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();

      // Tiny glow
      if (this.size > 1.8) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.15})`;
        ctx.fill();
      }
    }
  }

  const COUNT = 55;
  const particles = Array.from({ length: COUNT }, () => new Particle());

  function loop() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) { p.update(); p.draw(ctx); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* ══════════════════════════════════════════════════════
   3. NAVBAR SCROLL
══════════════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ══════════════════════════════════════════════════════
   4. SCROLL-REVEAL (IntersectionObserver) & STATS COUNTER
══════════════════════════════════════════════════════ */
(function initReveal() {
  const statsEls = document.querySelectorAll('.stat-num');

  // Handle stats counter animation
  function animateStats() {
    statsEls.forEach((el) => {
      const target = parseFloat(el.dataset.target);
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      if (isNaN(target)) return;

      if (REDUCED) {
        el.innerHTML = `${prefix}${target}${suffix ? `<span class="stat-unit">${suffix}</span>` : ''}`;
        return;
      }

      let current = 0;
      const duration = 1600; // 1.6s
      const startTime = performance.now();
      const isFloat = el.dataset.target.includes('.');

      function update(timestamp) {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        current = progress * target;
        
        const displayVal = isFloat ? current.toFixed(1) : Math.floor(current);
        el.innerHTML = `${prefix}${displayVal}${suffix ? `<span class="stat-unit">${suffix}</span>` : ''}`;

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.innerHTML = `${prefix}${target}${suffix ? `<span class="stat-unit">${suffix}</span>` : ''}`;
        }
      }
      requestAnimationFrame(update);
    });
  }

  if (REDUCED) {
    // If reduced motion, populate stats directly and skip reveal effects
    animateStats();
    return;
  }

  const revealEls = document.querySelectorAll('.reveal-up, .reveal-fade');
  if (!revealEls.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el    = entry.target;
        const delay = parseInt(el.dataset.delay || 0, 10);
        setTimeout(() => {
          el.classList.add('revealed');
          // If the stats container itself is revealed, trigger count up
          if (el.classList.contains('hero-stats')) {
            animateStats();
          }
        }, delay);
        io.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
  );

  revealEls.forEach((el) => io.observe(el));
})();

/* ══════════════════════════════════════════════════════
   5. UPLOAD ZONE — interactions
══════════════════════════════════════════════════════ */
uploadZone.addEventListener('click', (e) => {
  if (e.target === changeBtn || changeBtn.contains(e.target)) return;
  fileInput.click();
});
uploadZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
changeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
});

// Drag & Drop
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', (e) => {
  if (!uploadZone.contains(e.relatedTarget)) uploadZone.classList.remove('drag-over');
});
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  // Satisfying pulse on drop
  uploadZone.classList.add('dropped');
  uploadZone.addEventListener('animationend', () => uploadZone.classList.remove('dropped'), { once: true });

  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith('image/')) handleFile(file);
});

function handleFile(file) {
  selectedFile = file;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  fileNameEl.textContent = file.name.length > 30 ? file.name.slice(0, 28) + '…' : file.name;

  uploadIdle.classList.add('hidden');
  uploadPreview.classList.remove('hidden');
  analyzeBtn.disabled = false;

  showPanel('placeholder');
}

/* ══════════════════════════════════════════════════════
   6. ANALYZE — unchanged API logic, skeleton added
══════════════════════════════════════════════════════ */
analyzeBtn.addEventListener('click', runAnalysis);
retryBtn.addEventListener('click',   runAnalysis);

async function runAnalysis() {
  if (!selectedFile) return;

  setLoading(true);
  showPanel('skeleton'); // show shimmer skeleton instead of blank placeholder

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    const res = await fetch(API_URL, { method: 'POST', body: formData });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Server error ${res.status}${errBody ? ': ' + errBody : ''}`);
    }

    const data = await res.json();
    renderResults(data);
  } catch (err) {
    console.error('Analysis error:', err);
    showError(
      err.message.includes('Failed to fetch')
        ? 'Could not connect to the detection server. Please check your connection and try again.'
        : err.message
    );
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  analyzeBtn.disabled = on;
  btnText.classList.toggle('hidden', on);
  btnLoading.classList.toggle('hidden', !on);
}

/* ══════════════════════════════════════════════════════
   7. RESULT RENDERING — same data parsing, upgraded presentation
══════════════════════════════════════════════════════ */
function renderResults(data) {
  const prediction = (data.prediction || data.label || 'unknown').toLowerCase().trim();

  // ── Handle unrecognized / out-of-scope images ──
  if (prediction === 'unrecognized') {
    predictionIcon.textContent = '⚠️';
    predictionLabel.textContent = 'UNRECOGNIZED';
    predictionBadge.className = 'prediction-badge pop-in unrecognized';

    alertBadge.className = 'alert-badge pop-in none';
    alertLabel.textContent = 'N/A';

    const pctUnknown = capPct(parseFloat(data.confidence ?? 0));
    setConfBar(pctUnknown, 'grey');

    reasoningText.textContent = data.reasoning ||
      'This image does not clearly match fire, smoke, or safe-area categories. The system avoided forcing a guess.';
    ledgerHash.textContent = 'Not logged — no reliable detection made.';

    showPanel('results');
    scrollToResultsMobile();
    return;
  }

  // Normalise keys
  const confidence = parseFloat(data.confidence ?? data.score ?? 0);
  const alertLevel = (data.alert_level || data.alertLevel || data.alert || 'none').toLowerCase().trim();
  const reasoning  = data.reasoning || data.explanation || data.reason || 'No reasoning provided.';
  const hash       = data.ledger_hash || data.hash || data.id || 'N/A';

  // ── Prediction badge ──
  const iconMap = { fire: '🔥', smoke: '💨', nofire: '✅', 'no fire': '✅', safe: '✅' };
  const normalKey = prediction.replace(/\s+/g, '');
  predictionIcon.textContent = iconMap[normalKey] || iconMap[prediction] || '🔍';

  const displayPred = prediction === 'nofire' ? 'NO FIRE' : prediction.toUpperCase();
  predictionLabel.textContent = displayPred;

  // Force re-trigger pop-in by removing and re-adding class
  reAnimate(predictionBadge, 'prediction-badge pop-in ' + normalKey);

  // ── Alert Badge ──
  const alertKey = alertLevel.replace(/\s+/g, '-');
  reAnimate(alertBadge, 'alert-badge pop-in ' + (alertKey || 'none'));
  alertLabel.textContent = alertLevel.toUpperCase() || 'NONE';

  // ── Confidence ──
  const pct = capPct(isNaN(confidence) ? 0 : confidence > 1 ? confidence : confidence * 100);
  confValue.textContent = pct.toFixed(1) + '%';
  confBarTrack.setAttribute('aria-valuenow', Math.round(pct));

  const colourKey = pct >= 85 ? 'green' : pct >= 55 ? 'orange' : 'red';
  setConfBar(pct, colourKey);

  // ── Reasoning ──
  reasoningText.textContent = reasoning;

  // ── Ledger Hash ──
  ledgerHash.textContent = hash;

  // ── Sound Alarm Trigger ──
  if (pct > 80 && (alertLevel === 'critical' || alertLevel === 'high')) {
    playEmergencyAlert();
  }

  showPanel('results');
  scrollToResultsMobile();
}

/* ── Helpers ── */
function capPct(v) { return Math.min(100, Math.max(0, v > 1 ? v : v * 100)); }

function setConfBar(pct, colour) {
  const gradients = {
    green:  'linear-gradient(90deg, #059669, #10b981, #34d399)',
    orange: 'linear-gradient(90deg, #ea580c, #f97316, #fbbf24)',
    red:    'linear-gradient(90deg, #b91c1c, #ef4444, #f97316)',
    grey:   'linear-gradient(90deg, #4b5563, #6b7280, #9ca3af)',
  };
  const glows = {
    green:  'rgba(16,185,129,.6)',
    orange: 'rgba(249,115,22,.6)',
    red:    'rgba(239,68,68,.6)',
    grey:   'rgba(107,114,128,.4)',
  };

  confBarFill.style.background  = gradients[colour];
  confBarFill.style.boxShadow   = `0 0 14px ${glows[colour]}`;

  // Reset then animate (works even when re-rendering)
  confBarFill.style.width = '0%';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      confBarFill.style.width = pct + '%';
    });
  });
}

function reAnimate(el, newClass) {
  // Strip and re-add the pop-in class to restart animation
  el.className = '';
  void el.offsetWidth; // force reflow
  el.className = newClass;
}

function scrollToResultsMobile() {
  if (window.innerWidth < 900) {
    setTimeout(() => resultsContent.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }
}

/* ══════════════════════════════════════════════════════
   8. PANEL SWITCHING (updated to include skeleton)
══════════════════════════════════════════════════════ */
function showPanel(which) {
  resultsPlaceholder.classList.add('hidden');
  resultsSkeleton.classList.add('hidden');
  resultsError.classList.add('hidden');
  resultsContent.classList.add('hidden');

  switch (which) {
    case 'results':     resultsContent.classList.remove('hidden');     break;
    case 'error':       resultsError.classList.remove('hidden');       break;
    case 'skeleton':    resultsSkeleton.classList.remove('hidden');    break;
    default:            resultsPlaceholder.classList.remove('hidden'); break;
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  showPanel('error');
}

/* ══════════════════════════════════════════════════════
   9. NEW ANALYSIS RESET
══════════════════════════════════════════════════════ */
newAnalysisBtn.addEventListener('click', resetUI);

function resetUI() {
  selectedFile = null;
  fileInput.value = '';
  previewImg.src = '';

  uploadIdle.classList.remove('hidden');
  uploadPreview.classList.add('hidden');
  analyzeBtn.disabled = true;

  showPanel('placeholder');
  uploadZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ══════════════════════════════════════════════════════
   10. SOUND TOGGLE & ALERTS
══════════════════════════════════════════════════════ */
function playEmergencyAlert() {
  if (isMuted) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // synthesized clean alarm sound: alternating 2 beeps
    const duration = 1.0;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Frequency alternation: A5 (880Hz) to E5 (660Hz) to simulate alert
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.25);
    osc.frequency.setValueAtTime(880, now + 0.5);
    osc.frequency.setValueAtTime(660, now + 0.75);
    
    // Volume envelopes for 4 discrete short pulses
    gainNode.gain.setValueAtTime(0.12, now);
    gainNode.gain.setValueAtTime(0.001, now + 0.2);
    
    gainNode.gain.setValueAtTime(0.12, now + 0.25);
    gainNode.gain.setValueAtTime(0.001, now + 0.45);
    
    gainNode.gain.setValueAtTime(0.12, now + 0.5);
    gainNode.gain.setValueAtTime(0.001, now + 0.7);
    
    gainNode.gain.setValueAtTime(0.12, now + 0.75);
    gainNode.gain.setValueAtTime(0.001, now + 0.95);
    
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    console.warn('AudioContext play blocked or error:', e);
  }
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    soundToggleBtn.classList.toggle('muted', isMuted);
    if (isMuted) {
      soundOnIcon?.classList.add('hidden');
      soundOffIcon?.classList.remove('hidden');
      if (soundLabel) soundLabel.textContent = 'Muted';
    } else {
      soundOnIcon?.classList.remove('hidden');
      soundOffIcon?.classList.add('hidden');
      if (soundLabel) soundLabel.textContent = 'Alerts On';
    }
  });
}

/* ══════════════════════════════════════════════════════
   11. SMOOTH ANCHOR SCROLL
══════════════════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});