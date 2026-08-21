/* ═══════════════════════════════════════════════════════════════════════
   case-strip.js — «лента оттисков»

   Портирован на чистый JS с React-компонента hero-carousel (21st.dev).
   Сохранено главное: вся геометрия измеряется, а не задана в пикселях —
   один ResizeObserver читает сцену, и каждый размер ниже это доля от неё,
   поэтому лента одинакова и в узкой колонке, и на большом экране. Сохранены
   общий верхний обрез у всех карточек, полная высота только у выбранной,
   пружина на подъезде ленты, бросок с учётом скорости, шаг колесом по обеим
   осям с передачей прокрутки странице на краях, перекраска фона под выбранный
   оттиск и построчный вылет заголовка.

   Отличия от оригинала — по делу, а не по вкусу:
   · Соседние карточки обрезаются clip-path, а не анимацией высоты. Высота
     это раскладка, её пересчёт каждый кадр дорог; clip-path живёт в
     композиторе и даёт тот же общий верхний обрез.
   · Карточка не портретная 3:4, а 2:1 — под снимки первых экранов. Кадр
     прижат к верхнему краю, поэтому у обрезанной карточки видно шапку и
     заголовок сайта, то есть самое узнаваемое.
   · Краска одна на все оттиски. В оригинале у каждого слайда свой accent и
     фон перекрашивается на каждом шаге; здесь фон всегда сводится к
     печатной краске из токенов — в этой системе краска одна.

   Разметка: <div class="strip" data-case-strip> … </div>
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Доли от коробки сцены — как в оригинале, но под наш формат снимков */
  var CARD_H   = 0.40;   // высота выбранной карточки ÷ высота сцены
  var CARD_AR  = 2.0;    // карточка 2:1 — пропорция наших снимков
  var GAP      = 0.038;  // просвет ÷ ширина карточки
  var STRIP_TOP = 0.46;  // общий верхний обрез ленты, доля высоты сцены
  var RAIL     = 0.22;   // ширина шкалы ÷ ширина сцены

  var WHEEL_THRESHOLD = 60;   // накопленная прокрутка, после которой шаг
  var WHEEL_COOLDOWN  = 420;  // мс блокировки после шага

  /* Пружина оригинала: жёсткость 260, затухание 34, масса 0.9 */
  var K = 260, C = 34, M = 0.9;

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function build(root) {
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-case]'));
    if (slides.length < 2) return;

    var stage   = root.querySelector('.strip-stage');
    var track   = root.querySelector('.strip-track');
    var titleEl = root.querySelector('[data-strip-title]');
    var metaEl  = root.querySelector('[data-strip-meta]');
    var creditEl = root.querySelector('[data-strip-credit]');
    var railNow = root.querySelector('[data-strip-now]');
    var railAll = root.querySelector('[data-strip-all]');
    var railBar = root.querySelector('[data-strip-bar]');
    var bgA     = root.querySelector('[data-strip-bg="a"]');
    var bgB     = root.querySelector('[data-strip-bg="b"]');
    var liveEl  = root.querySelector('[data-strip-live]');
    if (!stage || !track) return;

    var last = slides.length - 1;
    var index = 0;
    var box = { w: 0, h: 0 };
    var fullH = 0, cardW = 0, gap = 0, step = 0;

    var x = 0, vx = 0, target = 0;
    var raf = null, lastT = 0;
    var drag = null;
    var frontIsA = true;

    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    root.classList.add('is-live');
    if (railAll) railAll.textContent = String(slides.length).padStart(2, '0');

    /* ── Измерение: единственный источник всех размеров ────────────── */
    function measure() {
      box.w = stage.clientWidth;
      box.h = stage.clientHeight;
      // Высота задаётся сценой, но на узком экране карточка 2:1 вылезает
      // за края — там ограничение по ширине становится главным.
      fullH = Math.min(clamp(box.h * CARD_H, 96, 360), (box.w * 0.82) / CARD_AR);
      cardW = fullH * CARD_AR;
      gap = Math.max(4, Math.round(cardW * GAP));
      step = cardW + gap;

      track.style.gap = gap + 'px';
      track.style.top = (STRIP_TOP * 100) + '%';
      track.style.height = fullH + 'px';
      for (var i = 0; i < slides.length; i++) {
        slides[i].style.width = cardW + 'px';
        slides[i].style.height = fullH + 'px';
      }
      target = xFor(index);
      x = target;
      paint();
    }

    /* Выбранная карточка встаёт в центр — едет лента, а не карточка */
    function xFor(i) { return box.w / 2 - (i * step + cardW / 2); }

    function paint() {
      track.style.transform = 'translate3d(' + x + 'px,0,0)';
    }

    /* ── Пружина: та же, что в оригинале, только руками ─────────────── */
    function frame(now) {
      var dt = Math.min((now - lastT) / 1000, 0.032);
      lastT = now;

      var a = (-K * (x - target) - C * vx) / M;
      vx += a * dt;
      x += vx * dt;

      if (Math.abs(x - target) < 0.15 && Math.abs(vx) < 0.15) {
        x = target; vx = 0; paint(); raf = null; return;
      }
      paint();
      raf = requestAnimationFrame(frame);
    }

    function settle() {
      if (reduced) { x = target; vx = 0; paint(); return; }
      if (raf === null) { lastT = performance.now(); raf = requestAnimationFrame(frame); }
    }

    /* ── Смена выбранного оттиска ──────────────────────────────────── */
    function go(next, silent) {
      var clamped = clamp(Math.round(next), 0, last);
      var changed = clamped !== index;
      index = clamped;
      target = xFor(index);
      settle();
      if (changed || silent === undefined) render();
    }

    function render() {
      var card = slides[index];

      for (var i = 0; i < slides.length; i++) {
        var on = i === index;
        slides[i].classList.toggle('is-on', on);
        slides[i].setAttribute('aria-current', on ? 'true' : 'false');
        slides[i].tabIndex = on ? 0 : -1;
      }

      // Фон: два слоя по очереди, чтобы смена шла перекрытием, а не миганием
      var next = frontIsA ? bgB : bgA;
      var prev = frontIsA ? bgA : bgB;
      if (next && prev) {
        var img = next.querySelector('img');
        img.src = card.getAttribute('data-image');
        next.classList.remove('is-zoomed');
        void next.offsetWidth;              // перезапуск наезда камеры
        next.classList.add('is-front', 'is-zoomed');
        prev.classList.remove('is-front');
        frontIsA = !frontIsA;
      }

      if (titleEl) {
        titleEl.innerHTML = '';
        var lines = (card.getAttribute('data-title') || '').split('|');
        for (var l = 0; l < lines.length; l++) {
          var mask = document.createElement('span');
          mask.className = 'strip-line';
          var inner = document.createElement('span');
          inner.textContent = lines[l].trim();
          inner.style.animationDelay = (l * 70) + 'ms';
          mask.appendChild(inner);
          titleEl.appendChild(mask);
        }
      }

      if (creditEl) creditEl.textContent = card.getAttribute('data-credit') || '';

      if (metaEl) {
        metaEl.innerHTML = '';
        var facts = (card.getAttribute('data-meta') || '').split('|');
        for (var f = 0; f < facts.length; f++) {
          if (!facts[f].trim()) continue;
          var s = document.createElement('span');
          s.textContent = facts[f].trim();
          s.style.animationDelay = (120 + f * 60) + 'ms';
          metaEl.appendChild(s);
        }
      }

      if (railNow) railNow.textContent = String(index + 1).padStart(2, '0');
      if (railBar) {
        // Сначала сжимаем полосу до одной девятой, потом сдвигаем — обе
        // операции живут в композиторе, раскладка не пересчитывается.
        railBar.style.transform = 'translateX(' + (index / slides.length * 100) + '%) ' +
                                  'scaleX(' + (1 / slides.length) + ')';
      }
      if (liveEl) {
        liveEl.textContent = 'Работа ' + (index + 1) + ' из ' + slides.length +
          '. ' + (card.getAttribute('data-title') || '').replace(/\|/g, ' ');
      }
    }

    /* ── Перетаскивание ────────────────────────────────────────────── */
    track.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      track.setPointerCapture(e.pointerId);
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      drag = { id: e.pointerId, x: e.clientX, start: x, v: 0, t: performance.now(), moved: false };
      root.classList.add('is-dragging');
    });

    track.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var now = performance.now();
      var prev = x;
      x = drag.start + (e.clientX - drag.x);
      // Тянуть за край можно, но с сопротивлением
      var min = xFor(last), max = xFor(0);
      if (x > max) x = max + (x - max) * 0.08;
      if (x < min) x = min + (x - min) * 0.08;
      if (Math.abs(e.clientX - drag.x) > 4) drag.moved = true;
      drag.v = (x - prev) / Math.max(now - drag.t, 1) * 1000;
      drag.t = now;
      paint();
    });

    function endDrag(e) {
      if (!drag || drag.id !== e.pointerId) return;
      var moved = drag.moved;
      // Бросок доносит ленту дальше — как в оригинале, по скорости отпускания
      var thrown = x + drag.v * 0.12;
      drag = null;
      root.classList.remove('is-dragging');
      vx = 0;
      go((box.w / 2 - thrown - cardW / 2) / step);
      if (moved) {
        track.addEventListener('click', function stopOnce(ev) {
          ev.preventDefault(); ev.stopPropagation();
          track.removeEventListener('click', stopOnce, true);
        }, true);
      }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    /* ── Тачпад: только горизонтальный жест ────────────────────────────
       В оригинале лента шагает по обеим осям, потому что там она занимает
       весь экран и других задач у прокрутки нет. Здесь под лентой лежит
       опись работ, и перехват вертикали означал бы, что до неё надо
       прокрутить девять карточек. Вертикаль отдаём странице целиком. */
    var acc = 0, until = 0;
    stage.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // это прокрутка страницы
      var delta = e.deltaX;
      // На краю ленты жест возвращается странице, иначе блок стал бы ловушкой
      var stuck = (delta > 0 && index === last) || (delta < 0 && index === 0);
      if (stuck) { acc = 0; return; }
      e.preventDefault();
      if (e.timeStamp < until) return;
      acc += delta;
      if (Math.abs(acc) < WHEEL_THRESHOLD) return;
      go(index + (acc > 0 ? 1 : -1));
      acc = 0;
      until = e.timeStamp + WHEEL_COOLDOWN;
    }, { passive: false });

    /* ── Клавиатура и выбор карточки ───────────────────────────────── */
    stage.addEventListener('keydown', function (e) {
      var map = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: last };
      if (!(e.key in map)) return;
      e.preventDefault();
      go(map[e.key]);
    });

    slides.forEach(function (card, i) {
      card.addEventListener('click', function () { go(i); });
    });

    if (window.ResizeObserver) new ResizeObserver(measure).observe(stage);
    else window.addEventListener('resize', measure, { passive: true });

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener('load', measure);

    measure();
    render();
  }

  function init() {
    var roots = document.querySelectorAll('[data-case-strip]');
    for (var i = 0; i < roots.length; i++) build(roots[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
