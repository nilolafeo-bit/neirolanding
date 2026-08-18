/* ═══════════════════════════════════════════════════════════════════════
   press-grid.js — «лист под прессом»

   Портирован на чистый JS с React-компонента kinetic-grid (21st.dev).
   Сохранена вся механика оригинала: краевое закрепление сетки, колоколообразное
   затухание деформации у курсора, кольцевые волны по клику, smoothstep на
   яркости линий и узлов. Добавлено сверх оригинала: масштабирование под DPR,
   привязка к своему контейнеру вместо всего окна, остановка кадров вне
   экрана и статичный кадр при prefers-reduced-motion.

   Разметка:  <div class="press-grid" data-press-grid></div>
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var CELL_SIZE        = 58;   // шаг сетки, px
  var INFLUENCE_RADIUS = 250;  // радиус влияния курсора
  var MAX_WARP         = 24;   // максимальный увод узла
  var DOT_SPACING      = 28;   // фоновая точечная растровка
  var LERP_SPEED       = 0.085;// сглаживание курсора
  var WAVE_WIDTH       = 55;
  var WAVE_SPEED       = 420;  // px/с — скорость расхождения волны
  var NODE_R           = 1.7;
  var NODE_R_ACTIVE    = 3.1;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function smoothstep(t) { return t * t * (3 - 2 * t); }

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }

  function mixColor(base, active, t, baseA, activeA) {
    return 'rgba(' +
      Math.round(lerp(base[0], active[0], t)) + ',' +
      Math.round(lerp(base[1], active[1], t)) + ',' +
      Math.round(lerp(base[2], active[2], t)) + ',' +
      lerp(baseA, activeA, t).toFixed(3) + ')';
  }

  /** #RRGGBB → [r,g,b]; при неудаче возвращает fallback. */
  function parseHex(value, fallback) {
    if (!value) return fallback;
    var hex = value.trim().replace(/^#/, '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }

  function create(host) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Краски берём из дизайн-системы, чтобы холст не жил своей жизнью
    var css      = getComputedStyle(document.documentElement);
    var paper    = parseHex(css.getPropertyValue('--proof'), [243, 240, 234]);
    var ink      = parseHex(css.getPropertyValue('--ink'),   [255, 45, 120]);

    var W = 0, H = 0, dpr = 1;
    var mouse  = { x: -9999, y: -9999 };
    var target = { x: -9999, y: -9999 };
    var waves  = [];
    var raf = null;
    var visible = true;

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      var rect = host.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    /* Смещение одного узла: краевое закрепление + волны + увод к курсору. */
    function warp(gx, gy, col, row, cols, rows) {
      // Края листа приколоты — сетка не отрывается от границ кадра
      var margin = 1.5;
      var colPin = Math.min(col / margin, (cols - 1 - col) / margin, 1);
      var rowPin = Math.min(row / margin, (rows - 1 - row) / margin, 1);
      var pin = colPin * colPin * rowPin * rowPin;

      var dx = gx - mouse.x;
      var dy = gy - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var proximity = Math.max(0, 1 - dist / INFLUENCE_RADIUS) * pin;

      var rx = 0, ry = 0;
      for (var i = 0; i < waves.length; i++) {
        var w = waves[i];
        var wdx = gx - w.x;
        var wdy = gy - w.y;
        var wdist = Math.sqrt(wdx * wdx + wdy * wdy);
        var diff = wdist - w.radius;
        if (Math.abs(diff) < WAVE_WIDTH) {
          var strength = (1 - Math.abs(diff) / WAVE_WIDTH) * w.opacity * 18 * pin;
          var a = Math.atan2(wdy, wdx);
          var sign = diff < 0 ? 1 : -1;
          rx += Math.cos(a) * strength * sign;
          ry += Math.sin(a) * strength * sign;
        }
      }

      if (dist < INFLUENCE_RADIUS && dist > 0 && pin > 0) {
        var t = dist / INFLUENCE_RADIUS;
        var eased = t < 0.01 ? 0 : (1 - t) * (1 - t) * Math.min(1, dist / 60);
        var amt = eased * MAX_WARP * pin;
        var ang = Math.atan2(dy, dx);
        return {
          x: gx - Math.cos(ang) * amt + rx,
          y: gy - Math.sin(ang) * amt + ry,
          p: proximity
        };
      }
      return { x: gx + rx, y: gy + ry, p: proximity };
    }

    function draw(now) {
      if (!W || !H) return;
      ctx.clearRect(0, 0, W, H);

      // Растровая точка — фактура бумаги под сеткой
      ctx.fillStyle = rgba(paper, 0.075);
      for (var px = DOT_SPACING / 2; px < W; px += DOT_SPACING) {
        for (var py = DOT_SPACING / 2; py < H; py += DOT_SPACING) {
          ctx.beginPath();
          ctx.arc(px, py, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (var i = waves.length - 1; i >= 0; i--) {
        var age = (now - waves[i].born) / 1000;
        waves[i].radius = Math.max(0, age * WAVE_SPEED);
        waves[i].opacity = Math.max(0, 1 - age * 1.15);
        if (waves[i].opacity <= 0) waves.splice(i, 1);
      }

      var cols = Math.max(2, Math.ceil(W / CELL_SIZE)) + 1;
      var rows = Math.max(2, Math.ceil(H / CELL_SIZE)) + 1;
      var cellW = W / (cols - 1);
      var cellH = H / (rows - 1);

      var pts = [];
      for (var r = 0; r < rows; r++) {
        pts[r] = [];
        for (var c = 0; c < cols; c++) {
          pts[r][c] = warp(c * cellW, r * cellH, c, r, cols, rows);
        }
      }

      function segment(a, b) {
        var t = smoothstep((a.p + b.p) / 2);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = mixColor(paper, ink, t, 0.15, 0.85);
        ctx.lineWidth = lerp(0.7, 1.4, t);
        ctx.stroke();
      }

      ctx.lineCap = 'butt';
      for (var r2 = 0; r2 < rows; r2++)
        for (var c2 = 0; c2 < cols - 1; c2++) segment(pts[r2][c2], pts[r2][c2 + 1]);
      for (var c3 = 0; c3 < cols; c3++)
        for (var r3 = 0; r3 < rows - 1; r3++) segment(pts[r3][c3], pts[r3 + 1][c3]);

      // Приводочные узлы на пересечениях
      for (var r4 = 0; r4 < rows; r4++) {
        for (var c4 = 0; c4 < cols; c4++) {
          var p = pts[r4][c4];
          var t2 = smoothstep(p.p);
          var rad = lerp(NODE_R, NODE_R_ACTIVE, t2);

          if (t2 > 0.3) {
            var glowR = rad + lerp(0, 7, (t2 - 0.3) / 0.7);
            var grd = ctx.createRadialGradient(p.x, p.y, rad * 0.5, p.x, p.y, glowR);
            grd.addColorStop(0, rgba(ink, t2 * 0.32));
            grd.addColorStop(1, rgba(ink, 0));
            ctx.beginPath();
            ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
          ctx.fillStyle = mixColor(paper, ink, t2, 0.3, 1);
          ctx.fill();
        }
      }

      for (var wi = 0; wi < waves.length; wi++) {
        ctx.beginPath();
        ctx.arc(waves[wi].x, waves[wi].y, Math.max(0, waves[wi].radius), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(ink, waves[wi].opacity * 0.26);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    function frame(now) {
      mouse.x = lerp(mouse.x, target.x, LERP_SPEED);
      mouse.y = lerp(mouse.y, target.y, LERP_SPEED);
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    /* Холостой ход пресса: лист прокатывается сам, без участия указателя —
       иначе на телефоне и при неподвижном курсоре кинетики нет вообще. */
    var idleTimer = null;
    function press() {
      if (document.hidden || !visible) return;
      waves.push({
        x: W * (0.18 + Math.random() * 0.64),
        y: H * (0.22 + Math.random() * 0.56),
        radius: 0,
        opacity: 0.62,
        born: performance.now()
      });
      if (waves.length > 6) waves.shift();
      if (reduced) draw(performance.now());
    }

    function start() {
      if (raf === null && !reduced) raf = requestAnimationFrame(frame);
      if (idleTimer === null) idleTimer = setInterval(press, 5200);
    }
    function stop() {
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      if (idleTimer !== null) { clearInterval(idleTimer); idleTimer = null; }
    }

    function pointFrom(event) {
      var rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    // Слушаем документ, а не холст: холст лежит под содержимым разворота и
    // сам событий не получает, иначе сетка замирала бы под заголовком.
    function inside(p) { return p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H; }

    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;   // палец не «водит» сеткой — он скроллит
      var p = pointFrom(e);
      target = inside(p) ? p : { x: -9999, y: -9999 };
    }, { passive: true });

    document.addEventListener('pointerdown', function (e) {
      var p = pointFrom(e);
      if (!inside(p)) return;
      waves.push({ x: p.x, y: p.y, radius: 0, opacity: 1, born: performance.now() });
      if (waves.length > 6) waves.shift();
      if (reduced) draw(performance.now());
    }, { passive: true });

    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(host);
    } else {
      window.addEventListener('resize', resize, { passive: true });
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0 }).observe(host);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (visible) start();
    });

    resize();
    start();
    setTimeout(press, 900);   // первый оттиск сразу, чтобы разворот не начинался мёртвым
  }

  function init() {
    var hosts = document.querySelectorAll('[data-press-grid]');
    for (var i = 0; i < hosts.length; i++) create(hosts[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
