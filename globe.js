/* ======================================================
   TrustOrbit — globe.js
   Three.js r134 interactive 3D globe for the hero section.

   Features:
   · Wireframe sphere (violet-blue glow)
   · Atmosphere halo (additive back-face sphere)
   · 40 surface detection dots via Fibonacci lattice
     – 6 fire-alert dots (orange/red) that pulse + expand
   · Low-poly satellite (body + solar wings + antenna)
     orbiting on a tilted plane
   · Auto-rotation (Y axis) + smooth mouse-tilt response
   · Delta-time-capped RAF loop → stays smooth at any FPS
   · prefers-reduced-motion → scene still renders but
     animation speed is reduced 10×
   · Hides itself on resize below 1100 px breakpoint

   ======================================================
   No module system — THREE is loaded globally from cdnjs.
   ====================================================== */

(function initGlobe () {
  'use strict';

  /* ── guards ─────────────────────────────────────── */
  const BREAKPOINT = 1100;           // px — hide below this
  if (window.innerWidth < BREAKPOINT) return;
  if (!window.THREE) {
    console.warn('[TrustOrbit Globe] Three.js not available.');
    return;
  }

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEED   = REDUCED ? 0.1 : 1.0;  // global speed multiplier

  /* ── DOM ─────────────────────────────────────────── */
  const wrap   = document.getElementById('heroGlobe');
  const canvas = document.getElementById('globeCanvas');
  if (!wrap || !canvas) return;

  /* ── Size helper ─────────────────────────────────── */
  function getSize () {
    // Actual rendered size matches the wrapper's CSS dimensions
    return Math.round(wrap.getBoundingClientRect().width) || 420;
  }
  let SIZE = getSize();

  /* ── Renderer ────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha:            true,   // transparent background
    antialias:        true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap DPR
  renderer.setSize(SIZE, SIZE, false); // false = don't update CSS style
  renderer.setClearColor(0x000000, 0); // fully transparent clear

  /* ── Scene + Camera ──────────────────────────────── */
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.z = 3.65;

  /* ── Master group (everything rotates together) ── */
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  /* ─────────────────────────────────────────────────
     GLOBE GEOMETRY — shared base sphere
  ───────────────────────────────────────────────── */
  const SEGS    = 28;     // longitude & latitude segments
  const RADIUS  = 1.0;
  const sphereGeo = new THREE.SphereGeometry(RADIUS, SEGS, SEGS);

  /* Dark interior fill — occludes back-face wireframe lines
     so the globe reads as a solid object, not a cage */
  const fillMesh = new THREE.Mesh(
    sphereGeo,
    new THREE.MeshBasicMaterial({
      color:       0x07091a,
      transparent: true,
      opacity:     0.92,
    })
  );
  globeGroup.add(fillMesh);

  /* Wireframe lines — soft violet-blue */
  const wireMat = new THREE.LineBasicMaterial({
    color:       0x7c3aed,
    transparent: true,
    opacity:     0.20,
  });
  const wireLines = new THREE.LineSegments(
    new THREE.WireframeGeometry(sphereGeo),
    wireMat
  );
  globeGroup.add(wireLines);

  /* Atmosphere halo — rendered on the BACK face of a slightly
     larger sphere, giving a soft glow rim around the globe */
  const atmosMesh = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS * 1.10, 24, 24),
    new THREE.MeshBasicMaterial({
      color:       0x6d28d9,
      transparent: true,
      opacity:     0.07,
      side:        THREE.BackSide,
    })
  );
  globeGroup.add(atmosMesh);

  /* ─────────────────────────────────────────────────
     DETECTION DOTS — Fibonacci lattice (even spacing)
  ───────────────────────────────────────────────── */
  const TOTAL_DOTS = 42;
  // These indices will be styled as active fire-alert points
  const FIRE_SET   = new Set([1, 5, 9, 16, 24, 33]);
  const DOT_R      = RADIUS * 1.014; // sit just above the surface

  const dotMeshes = [];  // all dots (for pulsing loop)
  const fireHalos = [];  // {mesh, phase} — expanding halo rings

  for (let i = 0; i < TOTAL_DOTS; i++) {
    // Fibonacci sphere formula → uniform surface distribution
    const phi   = Math.acos(1 - 2 * (i + 0.5) / TOTAL_DOTS);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;

    const nx = Math.sin(phi) * Math.cos(theta);
    const ny = Math.cos(phi);
    const nz = Math.sin(phi) * Math.sin(theta);

    const isFire = FIRE_SET.has(i);
    const phase  = (i / TOTAL_DOTS) * Math.PI * 2;  // stagger pulses

    /* Dot sphere */
    const dotGeo = new THREE.SphereGeometry(
      isFire ? 0.026 : 0.013,
      6, 6
    );
    const dotMat = new THREE.MeshBasicMaterial({
      color:       isFire ? 0xf97316 : 0x8b5cf6,
      transparent: true,
      opacity:     isFire ? 1.0 : 0.55,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.set(nx * DOT_R, ny * DOT_R, nz * DOT_R);
    dot.userData = { isFire, phase };
    globeGroup.add(dot);
    dotMeshes.push(dot);

    /* Fire-alert halo — a larger translucent sphere that
       scales outward and fades, simulating a pulse wave */
    if (isFire) {
      const haloMat = new THREE.MeshBasicMaterial({
        color:       0xef4444,
        transparent: true,
        opacity:     0.0,
      });
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.050, 8, 8),
        haloMat
      );
      halo.position.set(nx * DOT_R, ny * DOT_R, nz * DOT_R);
      globeGroup.add(halo);
      fireHalos.push({ halo, phase });
    }
  }

  /* ─────────────────────────────────────────────────
     SATELLITE — low-poly shape: box body + two wings
  ───────────────────────────────────────────────── */
  const satGroup = new THREE.Group(); // satellite body assembly

  /* Main body — silver rectangular box */
  const bodyGeo = new THREE.BoxGeometry(0.090, 0.062, 0.062);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0xbcc8d8 });
  const body    = new THREE.Mesh(bodyGeo, bodyMat);
  satGroup.add(body);

  /* Bright edge highlight on body */
  satGroup.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(bodyGeo),
    new THREE.LineBasicMaterial({
      color: 0xdde8ff, transparent: true, opacity: 0.75,
    })
  ));

  /* Solar panel geometry — thin flat box */
  const wingGeo = new THREE.BoxGeometry(0.130, 0.003, 0.055);
  const wingMat = new THREE.MeshBasicMaterial({ color: 0x1e3a8a });

  [-0.112, 0.112].forEach((xOff) => {
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.x = xOff;
    satGroup.add(wing);

    /* Blue grid lines on each panel */
    const edgeMesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(wingGeo),
      new THREE.LineBasicMaterial({
        color: 0x60a5fa, transparent: true, opacity: 0.65,
      })
    );
    edgeMesh.position.x = xOff;
    satGroup.add(edgeMesh);
  });

  /* Antenna — thin vertical cylinder */
  satGroup.add(Object.assign(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.0018, 0.0018, 0.048, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    ),
    { position: new THREE.Vector3(0, 0.055, 0) }
  ));

  /* Orbit setup:
     · satPivot lives inside globeGroup so it tilts with mouse
     · satGroup is a child of satPivot at orbit radius
     · rotating satPivot.rotation.y moves the satellite in orbit */
  const satPivot = new THREE.Group();
  satPivot.rotation.z = 0.50;   // ~28° orbit inclination
  satPivot.rotation.x = 0.18;
  globeGroup.add(satPivot);

  const ORBIT_RADIUS = 1.60;
  satGroup.position.set(ORBIT_RADIUS, 0, 0);
  satPivot.add(satGroup);

  /* ─────────────────────────────────────────────────
     MOUSE TRACKING
  ───────────────────────────────────────────────── */
  let mouseNX = 0; // normalised X  –1..+1
  let mouseNY = 0; // normalised Y  –1..+1

  document.addEventListener('mousemove', (e) => {
    mouseNX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouseNY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // Touch support — track first touch point
  document.addEventListener('touchmove', (e) => {
    if (!e.touches.length) return;
    mouseNX = (e.touches[0].clientX / window.innerWidth  - 0.5) * 2;
    mouseNY = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* ─────────────────────────────────────────────────
     ROTATION STATE
  ───────────────────────────────────────────────── */
  let autoY    = 0;   // cumulative auto-rotation angle
  let tiltX    = 0;   // current smooth X tilt (mouse Y)
  let tiltY    = 0;   // current smooth Y tilt (mouse X)
  let orbitAng = 0;   // current satellite orbit angle
  let t        = 0;   // global time accumulator

  /* ─────────────────────────────────────────────────
     RESIZE HANDLER
  ───────────────────────────────────────────────── */
  let killed = false;

  function onResize () {
    if (window.innerWidth < BREAKPOINT) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    SIZE = getSize();
    renderer.setSize(SIZE, SIZE, false);
  }
  window.addEventListener('resize', onResize, { passive: true });

  /* ─────────────────────────────────────────────────
     ANIMATION LOOP (delta-time capped at 50 ms)
  ───────────────────────────────────────────────── */
  let prevTime = performance.now();

  function animate (now) {
    if (killed) return;
    requestAnimationFrame(animate);

    const raw   = (now - prevTime) / 1000;   // seconds since last frame
    const delta = Math.min(raw, 0.05) * SPEED; // cap + apply speed scale
    prevTime = now;
    t += delta;

    /* ── Globe auto-rotation ── */
    autoY += delta * 0.175;   // ~1 full revolution per 36 s

    /* ── Smooth mouse tilt (exponential ease toward target) ── */
    const TILT_MAX   = 0.26;  // max tilt in radians (~15°)
    const TILT_SPEED = 0.045;
    tiltX += (-mouseNY * TILT_MAX - tiltX) * TILT_SPEED;
    tiltY += ( mouseNX * TILT_MAX - tiltY) * TILT_SPEED;

    globeGroup.rotation.x = tiltX;
    globeGroup.rotation.y = autoY + tiltY;

    /* ── Satellite orbit ── */
    orbitAng += delta * 0.38;  // ~full orbit per 16.5 s
    satPivot.rotation.y = orbitAng;

    // Keep satellite body oriented tangentially (facing travel direction)
    satGroup.rotation.y = -orbitAng * 0.4;

    /* ── Breathe wireframe opacity ── */
    wireMat.opacity = 0.17 + 0.06 * Math.sin(t * 0.35);

    /* ── Pulse fire detection dots ── */
    for (const dot of dotMeshes) {
      if (!dot.userData.isFire) continue;
      const p = (Math.sin(t * 2.4 + dot.userData.phase) + 1) * 0.5; // 0..1
      dot.material.opacity = 0.5 + p * 0.5;
      dot.scale.setScalar(0.72 + p * 0.58);
    }

    /* ── Expand & fade fire halos ── */
    for (const { halo, phase } of fireHalos) {
      const p = (Math.sin(t * 2.4 + phase + 0.6) + 1) * 0.5;
      halo.material.opacity = (1 - p) * 0.30;
      halo.scale.setScalar(1 + p * 1.60);
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);

  /* ─────────────────────────────────────────────────
     CLEAN UP if hero scrolls out of view (IntersectionObserver)
     Pausing RAF when invisible saves ~100% GPU idle cost.
  ───────────────────────────────────────────────── */
  let paused = false;
  const heroEl = document.getElementById('home');

  if (heroEl && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      ([entry]) => {
        paused = !entry.isIntersecting;
        if (!paused && killed) {
          killed = false;
          prevTime = performance.now();
          requestAnimationFrame(animate);
        } else if (paused) {
          killed = true; // RAF guard stops the loop
        }
      },
      { threshold: 0.01 }
    );
    io.observe(heroEl);
  }

})(); // end IIFE
