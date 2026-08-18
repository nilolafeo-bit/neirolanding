/* ═══════════════════════════════════════════════════════════════════════
   samples.js — «веер образцов»

   Портирован на чистый JS с React-компонента coverflow-carousel (21st.dev).
   Математика оригинала сохранена целиком: дробная позиция как единственный
   источник истины, свёртка расстояния по кольцу (зацикливание без клонов),
   степенное затухание наклона и отдаления, срез у полуоборота, экспоненциальное
   доведение до целого кадра, бросок с ограничением в два образца.

   Разметка (работает и без JS — просто горизонтальная лента):
     <div class="samples" data-samples>
       <div class="samples-frame"><div class="samples-track">
         <figure class="sample">…</figure> …
       </div></div>
     </div>
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var ROTATE     = 42;    // наклон первого соседа, градусы
  var DEPTH      = 0.58;  // отдаление первого соседа, доли ширины
  var FALLOFF    = 0.56;  // показатель затухания: ниже 1 — рейк выполаживается
  var FADE       = 0.13;  // потеря непрозрачности на шаг
  var GAP        = 0.06;  // просвет между образцами, доли ширины
  var TILT_CAP   = 82;    // дальний образец не встаёт к зрителю ребром
  var SETTLE     = 0.16;  // доля остатка, съедаемая за кадр
  var EPS        = 0.0004;

  function build(root) {
    var frame = root.querySelector('.samples-frame');
    var track = root.querySelector('.samples-track');
    if (!frame || !track) return;

    var cards = Array.prototype.slice.call(track.querySelectorAll('.sample'));
    var count = cards.length;
    if (count < 2) return;

    var caption   = root.querySelector('[data-samples-caption]');
    var dotsHost  = root.querySelector('[data-samples-dots]');
    var prevBtn   = root.querySelector('[data-samples-prev]');
    var nextBtn   = root.querySelector('[data-samples-next]');
    var liveHost  = root.querySelector('[data-samples-live]');

    var pos = 0;          // дробный индекс в центре — единственный источник истины
    var aim = 0;          // куда идёт текущее доведение
    var width = 0;
    var raf = null;
    var drag = null;
    var selected = 0;
    var dots = [];

    root.classList.add('is-live');

    function indexAt(p) { return ((Math.round(p) % count) + count) % count; }

    /* Рисуем прямо в DOM: шестьдесят перерисовок в секунду через состояние
       компонента — это шестьдесят лишних пересборок ради чисел, которые
       никому, кроме стилей, не нужны. */
    function paint() {
      if (!width) return;
      var pitch = width * (1 + GAP);

      for (var i = 0; i < count; i++) {
        var offset = i - pos;
        // Свёртка в короткую сторону кольца — весь механизм зацикливания
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;

        var distance = Math.abs(offset);
        var ramp = Math.pow(distance, FALLOFF);
        var tilt = Math.min(ROTATE * ramp, TILT_CAP) * Math.sign(offset);

        cards[i].style.transform =
          'translateX(calc(-50% + ' + (offset * pitch) + 'px)) ' +
          'translateZ(' + (-DEPTH * width * ramp) + 'px) ' +
          'rotateY(' + (-tilt) + 'deg)';

        // Образец перебрасывается через кольцо ровно на полуобороте,
        // поэтому к этому моменту он обязан быть невидим
        var edge = Math.min(1, Math.max(0, count / 2 - distance));
        cards[i].style.opacity = String(Math.max(0, 1 - FADE * distance) * edge);
        cards[i].style.zIndex = String(100 - Math.round(distance));
        cards[i].setAttribute('aria-hidden', distance > 0.5 ? 'true' : 'false');
        cards[i].classList.toggle('is-active', distance <= 0.5);
      }
    }

    function syncMeta(index) {
      if (selected === index) return;
      selected = index;

      for (var d = 0; d < dots.length; d++) {
        var on = d === index;
        dots[d].classList.toggle('is-on', on);
        dots[d].setAttribute('aria-current', on ? 'true' : 'false');
      }

      if (caption) {
        var card = cards[index];
        var title = card.getAttribute('data-title') || '';
        var sub   = card.getAttribute('data-subtitle') || '';
        var meta  = card.getAttribute('data-meta') || '';
        caption.innerHTML = '';

        var h = document.createElement('p');
        h.className = 'samples-title font-display';
        h.textContent = title;
        caption.appendChild(h);

        if (sub) {
          var s = document.createElement('p');
          s.className = 'samples-subtitle';
          s.textContent = sub;
          caption.appendChild(s);
        }
        if (meta) {
          var dl = document.createElement('dl');
          dl.className = 'samples-meta';
          meta.split('|').forEach(function (row) {
            var parts = row.split(':');
            if (parts.length < 2) return;
            var wrap = document.createElement('div');
            var dt = document.createElement('dt');
            dt.textContent = parts[0].trim();
            var dd = document.createElement('dd');
            dd.textContent = parts.slice(1).join(':').trim();
            wrap.appendChild(dt); wrap.appendChild(dd);
            dl.appendChild(wrap);
          });
          caption.appendChild(dl);
        }
        caption.classList.remove('is-fresh');
        void caption.offsetWidth;          // перезапуск анимации подписи
        caption.classList.add('is-fresh');
      }

      if (liveHost) {
        liveHost.textContent = 'Образец ' + (index + 1) + ' из ' + count + '. ' +
          (cards[index].getAttribute('data-title') || '');
      }
    }

    function settle(to) {
      if (raf !== null) cancelAnimationFrame(raf);
      aim = to;
      syncMeta(indexAt(to));

      (function step() {
        var remaining = aim - pos;
        if (Math.abs(remaining) < EPS) {
          pos = aim;
          paint();
          raf = null;
          return;
        }
        pos += remaining * SETTLE;
        paint();
        raf = requestAnimationFrame(step);
      })();
    }

    function goTo(index) {
      // Идём короткой стороной кольца, а не разматываем его целиком
      settle(index + Math.round((aim - index) / count) * count);
    }

    function nudge(by) { settle(Math.round(aim) + by); }

    /* ── Перетаскивание ─────────────────────────────────────────────── */

    frame.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      frame.setPointerCapture(e.pointerId);
      aim = pos;
      drag = { id: e.pointerId, x: e.clientX, pos: pos, v: 0, t: performance.now(), moved: false };
    });

    frame.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var pitch = width * (1 + GAP);
      if (!pitch) return;

      var now = performance.now();
      var previous = pos;
      pos = drag.pos - (e.clientX - drag.x) / pitch;
      if (Math.abs(e.clientX - drag.x) > 4) drag.moved = true;

      drag.v = ((pos - previous) / Math.max(now - drag.t, 1)) * 1000;  // образцов в секунду
      drag.t = now;

      syncMeta(indexAt(pos));
      paint();
    });

    function endDrag(e) {
      if (!drag || drag.id !== e.pointerId) return;
      var v = drag.v;
      var moved = drag.moved;
      drag = null;
      // Бросок доносит, но не дальше двух образцов
      var carried = Math.max(-2, Math.min(2, v * 0.18));
      settle(Math.round(pos + carried));
      if (moved) {
        // Гасим клик по ссылке, если это был свайп, а не нажатие
        frame.addEventListener('click', function stopOnce(ev) {
          ev.preventDefault(); ev.stopPropagation();
          frame.removeEventListener('click', stopOnce, true);
        }, true);
      }
    }
    frame.addEventListener('pointerup', endDrag);
    frame.addEventListener('pointercancel', endDrag);

    frame.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); nudge(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
      if (e.key === 'Home')       { e.preventDefault(); goTo(0); }
      if (e.key === 'End')        { e.preventDefault(); goTo(count - 1); }
    });

    if (prevBtn) prevBtn.addEventListener('click', function () { nudge(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { nudge(1); });

    if (dotsHost) {
      dotsHost.innerHTML = '';
      for (var i = 0; i < count; i++) {
        (function (index) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'samples-dot';
          b.setAttribute('aria-label', 'Показать образец ' + (index + 1));
          b.addEventListener('click', function () { goTo(index); });
          dotsHost.appendChild(b);
          dots.push(b);
        })(i);
      }
    }

    /* Ширина образца задаёт шаг, глубину и перспективу — измеряем только её. */
    function measure() {
      width = cards[0].offsetWidth;
      paint();
    }

    if (window.ResizeObserver) new ResizeObserver(measure).observe(frame);
    else window.addEventListener('resize', measure, { passive: true });

    // Шрифты и картинки меняют раскладку уже после первого кадра
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener('load', measure);

    measure();
    selected = -1;
    syncMeta(0);
    paint();
  }

  function init() {
    var roots = document.querySelectorAll('[data-samples]');
    for (var i = 0; i < roots.length; i++) build(roots[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
